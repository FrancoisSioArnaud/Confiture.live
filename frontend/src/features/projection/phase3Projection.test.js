import { describe, expect, it } from 'vitest';
import { projectJamState } from './projectJamState.js';

const event = (type, payload, n, transactionId = `tx_${n}`) => ({ eventId: `event_${n}`, transactionId, type, payload, serverSequenceNumber: n });

function baseEvents() {
  return [
    event('jam_created', { jamId: 'jam_1', name: 'Jam' }, 1),
    event('instrument_added', { instrumentId: 'vocals', name: 'Chant', order: 0 }, 2),
    event('instrument_added', { instrumentId: 'guitar', name: 'Guitare', order: 1 }, 3),
    event('instrument_added', { instrumentId: 'drums', name: 'Batterie', order: 2 }, 4),
    event('participant_created', { participantId: 'sarah', name: 'Sarah' }, 5),
    event('participant_created', { participantId: 'nico', name: 'Nicolas' }, 6),
    event('participant_created', { participantId: 'jeremy', name: 'Jérémy' }, 7),
    event('participation_added', { participationId: 'sarah_vocals', participantId: 'sarah', instrumentId: 'vocals', baseOrderKey: '1000' }, 8),
    event('participation_added', { participationId: 'nico_guitar', participantId: 'nico', instrumentId: 'guitar', baseOrderKey: '3000' }, 9),
    event('participation_added', { participationId: 'jeremy_drums', participantId: 'jeremy', instrumentId: 'drums', baseOrderKey: '5000' }, 10),
    event('appearance_materialized', { appearanceId: 'app_sarah_vocals_1', participationId: 'sarah_vocals', participantId: 'sarah', instrumentId: 'vocals', appearanceIndex: 1, positionKey: '1000' }, 11),
    event('appearance_materialized', { appearanceId: 'app_nico_guitar_1', participationId: 'nico_guitar', participantId: 'nico', instrumentId: 'guitar', appearanceIndex: 1, positionKey: '3000' }, 12),
    event('appearance_materialized', { appearanceId: 'app_jeremy_drums_1', participationId: 'jeremy_drums', participantId: 'jeremy', instrumentId: 'drums', appearanceIndex: 1, positionKey: '5000' }, 13),
  ];
}

describe('phase 3 projection scenarios', () => {
  it('projects multi-instrument participation conflicts', () => {
    const state = projectJamState({ events: [
      event('jam_created', { jamId: 'jam_1', name: 'Jam' }, 1),
      event('instrument_added', { instrumentId: 'guitar', name: 'Guitare' }, 2),
      event('instrument_added', { instrumentId: 'bass', name: 'Basse' }, 3),
      event('participant_created', { participantId: 'nico', name: 'Nicolas' }, 4),
      event('participation_added', { participationId: 'nico_guitar', participantId: 'nico', instrumentId: 'guitar' }, 5),
      event('participation_added', { participationId: 'nico_bass', participantId: 'nico', instrumentId: 'bass' }, 6),
      event('conflict_created', { conflictId: 'conflict_1', scope: 'participation', targetIds: ['nico_guitar', 'nico_bass'], reason: 'instrument_constraint' }, 7),
    ] });

    expect(state.conflicts.conflict_1).toMatchObject({ scope: 'participation', removed: false });
    expect(state.columns.guitar).toHaveLength(1);
    expect(state.columns.bass).toHaveLength(1);
  });

  it('reveals round 2 and adds late participants from the configured start round', () => {
    const state = projectJamState({ events: [
      event('jam_created', { jamId: 'jam_1', name: 'Jam' }, 1),
      event('instrument_added', { instrumentId: 'guitar', name: 'Guitare' }, 2),
      event('instrument_round_visibility_changed', { instrumentId: 'guitar', visibleRoundCount: 2 }, 3),
      event('participant_created', { participantId: 'paul', name: 'Paul' }, 4),
      event('participant_created', { participantId: 'julie', name: 'Julie' }, 5),
      event('participation_added', { participationId: 'paul_guitar', participantId: 'paul', instrumentId: 'guitar', baseOrderKey: '1000' }, 6),
      event('participation_added', { participationId: 'julie_guitar', participantId: 'julie', instrumentId: 'guitar', baseOrderKey: '1500', startAppearanceIndex: 2, insertionMode: 'between_targets' }, 7),
    ] });

    expect(state.columns.guitar.map((item) => item.appearanceIndex)).toEqual([1, 2, 2]);
    expect(state.columns.guitar.filter((item) => item.participantId === 'julie')).toHaveLength(1);
  });

  it('aligns links using move_to_first, move_to_last and average_position strategies', () => {
    const first = projectJamState({ events: [
      ...baseEvents(),
      event('link_created', { linkId: 'link_first', reorderStrategy: 'move_to_first', targets: [{ type: 'appearance', id: 'app_nico_guitar_1' }, { type: 'appearance', id: 'app_jeremy_drums_1' }] }, 14),
    ] });
    expect(first.appearances.app_nico_guitar_1.orderKey).toBe('3000');
    expect(first.appearances.app_jeremy_drums_1.orderKey).toBe('3000');

    const last = projectJamState({ events: [
      ...baseEvents(),
      event('link_created', { linkId: 'link_last', reorderStrategy: 'move_to_last', targets: [{ type: 'appearance', id: 'app_sarah_vocals_1' }, { type: 'appearance', id: 'app_nico_guitar_1' }] }, 14),
    ] });
    expect(last.appearances.app_sarah_vocals_1.orderKey).toBe('3000');
    expect(last.appearances.app_nico_guitar_1.orderKey).toBe('3000');

    const average = projectJamState({ events: [
      ...baseEvents(),
      event('link_created', { linkId: 'link_average', reorderStrategy: 'average_position', targets: [{ type: 'appearance', id: 'app_sarah_vocals_1' }, { type: 'appearance', id: 'app_jeremy_drums_1' }] }, 14),
    ] });
    expect(average.appearances.app_sarah_vocals_1.orderKey).toBe('3000');
    expect(average.appearances.app_jeremy_drums_1.orderKey).toBe('3000');
  });

  it('keeps locked and played targets immobile when move events arrive', () => {
    const locked = projectJamState({ events: [
      ...baseEvents(),
      event('appearance_locked', { appearanceId: 'app_nico_guitar_1' }, 14),
      event('appearance_moved_between', { appearanceId: 'app_nico_guitar_1', positionKey: '9000' }, 15),
    ] });
    expect(locked.appearances.app_nico_guitar_1.orderKey).toBe('3000');
    expect(locked.projectionWarnings).toContainEqual(expect.objectContaining({ type: 'move_ignored_locked_target' }));

    const playedHole = projectJamState({ events: [
      event('jam_created', { jamId: 'jam_1', name: 'Jam' }, 1),
      event('instrument_added', { instrumentId: 'drums', name: 'Batterie' }, 2),
      event('hole_added', { holeId: 'hole_1', instrumentId: 'drums', positionKey: '1000' }, 3),
      event('plateau_played', { plateauIndex: 1, targets: [{ type: 'hole', id: 'hole_1' }] }, 4),
      event('hole_moved_between', { holeId: 'hole_1', positionKey: '9000' }, 5),
    ] });
    expect(playedHole.holes.hole_1.orderKey).toBe('1000');
    expect(playedHole.projectionWarnings).toContainEqual(expect.objectContaining({ type: 'move_ignored_played_target' }));
  });

  it('models jouer sans as hole_added plus link_created', () => {
    const state = projectJamState({ events: [
      ...baseEvents(),
      event('hole_added', { holeId: 'hole_drums_without', instrumentId: 'drums', reason: 'play_without', positionKey: '3000' }, 14),
      event('link_created', { linkId: 'link_without', targets: [{ type: 'appearance', id: 'app_nico_guitar_1' }, { type: 'hole', id: 'hole_drums_without' }] }, 15),
    ] });

    expect(state.holes.hole_drums_without.reason).toBe('play_without');
    expect(state.columns.drums.find((item) => item.holeId === 'hole_drums_without')).toMatchObject({ type: 'hole', isLinked: true });
  });

  it('hides instruments without deleting history', () => {
    const state = projectJamState({ events: [
      ...baseEvents(),
      event('instrument_visibility_changed', { instrumentId: 'guitar', visible: false }, 14),
    ] });

    expect(state.instruments.guitar.isVisible).toBe(false);
    expect(state.columns.guitar).toBeUndefined();
    expect(state.appearances.app_nico_guitar_1).toBeDefined();
  });
});
