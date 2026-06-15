import { describe, expect, it } from 'vitest';
import { projectJamState } from './projectJamState.js';

const event = (type, payload, n, transactionId = `tx_${n}`) => ({ eventId: `event_${n}`, transactionId, type, payload, serverSequenceNumber: n });

function linkedBase() {
  return [
    event('jam_created', { jamId: 'jam_1', name: 'Jam' }, 1),
    event('instrument_added', { instrumentId: 'vocals', name: 'Chant', order: 0 }, 2),
    event('instrument_added', { instrumentId: 'guitar', name: 'Guitare', order: 1 }, 3),
    event('instrument_added', { instrumentId: 'bass', name: 'Basse', order: 2 }, 4),
    event('participant_created', { participantId: 'lea', name: 'Léa' }, 5),
    event('participant_created', { participantId: 'nico', name: 'Nico' }, 6),
    event('participant_created', { participantId: 'paul', name: 'Paul' }, 7),
    event('participation_added', { participationId: 'lea_vocals', participantId: 'lea', instrumentId: 'vocals', baseOrderKey: '1000' }, 8),
    event('participation_added', { participationId: 'nico_guitar', participantId: 'nico', instrumentId: 'guitar', baseOrderKey: '3000' }, 9),
    event('participation_added', { participationId: 'paul_bass', participantId: 'paul', instrumentId: 'bass', baseOrderKey: '5000' }, 10),
    event('appearance_materialized', { appearanceId: 'app_lea', participationId: 'lea_vocals', participantId: 'lea', instrumentId: 'vocals', appearanceIndex: 1, positionKey: '1000' }, 11),
    event('appearance_materialized', { appearanceId: 'app_nico', participationId: 'nico_guitar', participantId: 'nico', instrumentId: 'guitar', appearanceIndex: 1, positionKey: '3000' }, 12),
    event('appearance_materialized', { appearanceId: 'app_paul', participationId: 'paul_bass', participantId: 'paul', instrumentId: 'bass', appearanceIndex: 1, positionKey: '5000' }, 13),
  ];
}

describe('group 4 projection hardening', () => {
  it('moves linked groups deterministically from the latest moved target', () => {
    const state = projectJamState({ events: [
      ...linkedBase(),
      event('link_created', { linkId: 'link_1', targets: [{ type: 'appearance', id: 'app_lea' }, { type: 'appearance', id: 'app_nico' }] }, 14),
      event('appearance_moved_between', { appearanceId: 'app_nico', positionKey: '7000', movedLinkedGroup: true }, 15),
    ] });

    expect(state.links.link_1.removed).toBe(false);
    expect(state.appearances.app_lea.orderKey).toBe('7000');
    expect(state.appearances.app_nico.orderKey).toBe('7000');
  });

  it('refuses links that contradict appearance or participation conflicts', () => {
    const state = projectJamState({ events: [
      ...linkedBase(),
      event('conflict_created', { conflictId: 'conflict_1', scope: 'participation', targetIds: ['lea_vocals', 'nico_guitar'], reason: 'manual' }, 14),
      event('link_created', { linkId: 'link_1', targets: [{ type: 'appearance', id: 'app_lea' }, { type: 'appearance', id: 'app_nico' }] }, 15),
    ] });

    expect(state.links.link_1.removed).toBe(true);
    expect(state.appearances.app_lea.orderKey).toBe('1000');
    expect(state.appearances.app_nico.orderKey).toBe('3000');
    expect(state.projectionWarnings).toContainEqual(expect.objectContaining({ type: 'link_ignored_conflicting_targets', linkId: 'link_1' }));
  });

  it('removes an existing link when a later conflict makes it invalid', () => {
    const state = projectJamState({ events: [
      ...linkedBase(),
      event('link_created', { linkId: 'link_1', targets: [{ type: 'appearance', id: 'app_lea' }, { type: 'appearance', id: 'app_nico' }] }, 14),
      event('conflict_created', { conflictId: 'conflict_1', scope: 'appearance', targetIds: ['app_lea', 'app_nico'], reason: 'manual' }, 15),
    ] });

    expect(state.links.link_1.removed).toBe(true);
    expect(state.projectionWarnings).toContainEqual(expect.objectContaining({ type: 'link_ignored_conflicting_targets', linkId: 'link_1' }));
  });

  it('refuses links with locked, played, missing, or duplicate-instrument targets via warnings', () => {
    const state = projectJamState({ events: [
      ...linkedBase(),
      event('appearance_locked', { appearanceId: 'app_lea' }, 14),
      event('plateau_played', { plateauIndex: 1, targets: [{ type: 'appearance', id: 'app_nico' }] }, 15),
      event('appearance_materialized', { appearanceId: 'app_lea_2', participationId: 'lea_vocals', participantId: 'lea', instrumentId: 'vocals', appearanceIndex: 2, positionKey: '2000' }, 16),
      event('link_created', { linkId: 'link_1', targets: [{ type: 'appearance', id: 'app_lea' }, { type: 'appearance', id: 'app_nico' }, { type: 'appearance', id: 'missing' }, { type: 'appearance', id: 'app_lea_2' }] }, 17),
    ] });

    expect(state.links.link_1.removed).toBe(true);
    expect(state.projectionWarnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'link_ignored_locked_target', linkId: 'link_1' }),
      expect.objectContaining({ type: 'link_ignored_played_target', linkId: 'link_1' }),
      expect.objectContaining({ type: 'link_ignored_missing_target', linkId: 'link_1' }),
      expect.objectContaining({ type: 'link_ignored_multiple_targets_same_instrument', linkId: 'link_1', instrumentId: 'vocals' }),
    ]));
  });

  it('keeps replacement skip as a forced delink and surfaces no hidden side effect', () => {
    const state = projectJamState({ events: [
      ...linkedBase(),
      event('link_created', { linkId: 'link_1', targets: [{ type: 'appearance', id: 'app_lea' }, { type: 'appearance', id: 'app_nico' }] }, 14),
      event('hole_added', { holeId: 'hole_replacement', instrumentId: 'guitar', appearanceIndex: 1, reason: 'call_drawer_without_musician', positionKey: '3000' }, 15),
      event('appearance_skipped', { appearanceId: 'app_nico', replacement: { mode: 'hole', holeId: 'hole_replacement' }, removedLinkIds: ['link_1'], confirmedDelink: true }, 16),
    ] });

    expect(state.links.link_1.removed).toBe(true);
    expect(state.appearances.app_nico.skipped).toBe(true);
    expect(state.holes.hole_replacement).toMatchObject({ reason: 'call_drawer_without_musician' });
    expect(state.columns.guitar.some((item) => item.appearanceId === 'app_nico')).toBe(false);
  });
});
