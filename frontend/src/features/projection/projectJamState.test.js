import { describe, expect, it } from 'vitest';
import { projectJamState } from './projectJamState.js';

const event = (type, payload, n, transactionId = `tx_${n}`) => ({ eventId: `event_${n}`, transactionId, type, payload, serverSequenceNumber: n });

describe('projectJamState', () => {
  it('projects a jam, instruments, participants and calculated first appearances deterministically', () => {
    const state = projectJamState({ events: [
      event('jam_created', { jamId: 'jam_1', name: 'Jam', indicativeDate: '2026-06-17' }, 1),
      event('instrument_added', { instrumentId: 'guitar', name: 'Guitare', order: 0 }, 2),
      event('participant_created', { participantId: 'lea', name: 'Léa' }, 3),
      event('participation_added', { participationId: 'lea_guitar', participantId: 'lea', instrumentId: 'guitar', baseOrderKey: 'a' }, 4),
    ] });
    expect(state.jam.name).toBe('Jam');
    expect(state.columns.guitar).toHaveLength(1);
    expect(state.columns.guitar[0]).toMatchObject({ type: 'appearance', participantId: 'lea', appearanceIndex: 1 });
  });

  it('materializes holes and links without creating participant state', () => {
    const state = projectJamState({ events: [
      event('jam_created', { jamId: 'jam_1', name: 'Jam' }, 1),
      event('instrument_added', { instrumentId: 'drums', name: 'Batterie' }, 2),
      event('hole_added', { holeId: 'hole_1', instrumentId: 'drums', appearanceIndex: 1, positionKey: 'b' }, 3),
      event('link_created', { linkId: 'link_1', targets: [{ type: 'hole', id: 'hole_1' }] }, 4),
    ] });
    expect(state.columns.drums[0]).toMatchObject({ type: 'hole', holeId: 'hole_1', isLinked: true });
    expect(state.links.link_1.removed).toBe(false);
  });

  it('supports linear undo by ignoring events from the last reverted transaction', () => {
    const events = [
      event('jam_created', { jamId: 'jam_1', name: 'Jam' }, 1, 'tx_1'),
      event('instrument_added', { instrumentId: 'bass', name: 'Basse' }, 2, 'tx_2'),
      event('transaction_reverted', { targetTransactionId: 'tx_2' }, 3, 'tx_3'),
    ];
    const state = projectJamState({ events });
    expect(state.instruments.bass).toBeUndefined();
    expect(state.revertedTransactionIds).toContain('tx_2');
    expect(state.projectionWarnings).toHaveLength(0);
  });

  it('warns and ignores non-linear undo attempts', () => {
    const state = projectJamState({ events: [
      event('jam_created', { jamId: 'jam_1', name: 'Jam' }, 1, 'tx_1'),
      event('instrument_added', { instrumentId: 'guitar', name: 'Guitare' }, 2, 'tx_2'),
      event('instrument_added', { instrumentId: 'bass', name: 'Basse' }, 3, 'tx_3'),
      event('transaction_reverted', { targetTransactionId: 'tx_2' }, 4, 'tx_4'),
    ] });

    expect(state.instruments.guitar).toBeDefined();
    expect(state.instruments.bass).toBeDefined();
    expect(state.projectionWarnings).toContainEqual(expect.objectContaining({ type: 'non_linear_undo_ignored', targetTransactionId: 'tx_2' }));
  });

  it('projects V0 event names, target-specific locks, played and unplayed targets', () => {
    const state = projectJamState({ events: [
      event('jam_created', { jamId: 'jam_1', name: 'Jam' }, 1),
      event('jam_updated', { name: 'Jam renommée' }, 2),
      event('jam_link_reorder_strategy_changed', { nextStrategy: 'average_position' }, 3),
      event('instrument_added', { instrumentId: 'guitar', name: 'Guitare', order: 0 }, 4),
      event('instrument_round_visibility_changed', { instrumentId: 'guitar', visibleRoundCount: 2 }, 5),
      event('participant_created', { participantId: 'lea', name: 'Léa' }, 6),
      event('participation_added', { participationId: 'lea_guitar', participantId: 'lea', instrumentId: 'guitar', baseOrderKey: 'a' }, 7),
      event('appearance_materialized', { appearanceId: 'app_1', participationId: 'lea_guitar', participantId: 'lea', instrumentId: 'guitar', appearanceIndex: 1, positionKey: 'a' }, 8),
      event('appearance_moved_between', { appearanceId: 'app_1', positionKey: 'z' }, 9),
      event('appearance_locked', { appearanceId: 'app_1' }, 10),
      event('appearance_unlocked', { appearanceId: 'app_1' }, 11),
      event('hole_added', { holeId: 'hole_1', instrumentId: 'guitar', positionKey: 'y' }, 12),
      event('hole_moved_between', { holeId: 'hole_1', positionKey: 'x' }, 13),
      event('hole_locked', { holeId: 'hole_1' }, 14),
      event('plateau_played', { plateauIndex: 1, targets: [{ type: 'hole', id: 'hole_1' }] }, 15),
      event('plateau_unplayed', { plateauIndex: 1, targets: [{ type: 'hole', id: 'hole_1' }] }, 16),
    ] });

    expect(state.jam).toMatchObject({ name: 'Jam renommée', linkReorderStrategy: 'average_position' });
    expect(state.instruments.guitar.visibleRoundCount).toBe(2);
    expect(state.appearances.app_1.orderKey).toBe('z');
    expect(state.holes.hole_1.orderKey).toBe('x');
    expect(state.locks['appearance:app_1'].removed).toBe(true);
    expect(state.locks['hole:hole_1'].removed).toBe(false);
    expect(state.playedTargets['hole:hole_1']).toBe(false);
  });

  it('only allows plateau_unplayed on the last played plateau', () => {
    const state = projectJamState({ events: [
      event('jam_created', { jamId: 'jam_1', name: 'Jam' }, 1, 'tx_1'),
      event('plateau_played', { plateauIndex: 1, targets: [{ type: 'hole', id: 'hole_1' }] }, 2, 'tx_2'),
      event('plateau_played', { plateauIndex: 2, targets: [{ type: 'hole', id: 'hole_2' }] }, 3, 'tx_3'),
      event('plateau_unplayed', { plateauIndex: 1, targets: [{ type: 'hole', id: 'hole_1' }] }, 4, 'tx_4'),
    ] });

    expect(state.playedTargets['hole:hole_1']).toBe(true);
    expect(state.playedTargets['hole:hole_2']).toBe(true);
    expect(state.playedPlateaus).toHaveLength(2);
    expect(state.projectionWarnings).toContainEqual(expect.objectContaining({ type: 'non_last_plateau_unplayed_ignored', targetPlateau: 1 }));
  });

  it('calculates visible rounds and stops future calculated appearances for participants marked left', () => {
    const state = projectJamState({ events: [
      event('jam_created', { jamId: 'jam_1', name: 'Jam' }, 1),
      event('instrument_added', { instrumentId: 'vocals', name: 'Chant' }, 2),
      event('instrument_round_visibility_changed', { instrumentId: 'vocals', visibleRoundCount: 2 }, 3),
      event('participant_created', { participantId: 'sarah', name: 'Sarah' }, 4),
      event('participation_added', { participationId: 'sarah_vocals', participantId: 'sarah', instrumentId: 'vocals', baseOrderKey: 'a' }, 5),
      event('participant_marked_left', { participantId: 'sarah' }, 6),
    ] });

    expect(state.columns.vocals).toHaveLength(0);
    expect(state.participants.sarah.presenceStatus).toBe('left');
  });

  it('removes links when linked appearances or holes are removed or skipped', () => {
    const state = projectJamState({ events: [
      event('jam_created', { jamId: 'jam_1', name: 'Jam' }, 1),
      event('instrument_added', { instrumentId: 'guitar', name: 'Guitare' }, 2),
      event('participant_created', { participantId: 'lea', name: 'Léa' }, 3),
      event('participation_added', { participationId: 'lea_guitar', participantId: 'lea', instrumentId: 'guitar' }, 4),
      event('appearance_materialized', { appearanceId: 'app_1', participationId: 'lea_guitar', participantId: 'lea', instrumentId: 'guitar', appearanceIndex: 1 }, 5),
      event('hole_added', { holeId: 'hole_1', instrumentId: 'guitar' }, 6),
      event('link_created', { linkId: 'link_1', targets: [{ type: 'appearance', id: 'app_1' }, { type: 'hole', id: 'hole_1' }] }, 7),
      event('appearance_skipped', { appearanceId: 'app_1' }, 8),
    ] });

    expect(state.links.link_1.removed).toBe(true);
    expect(state.columns.guitar.some((item) => item.appearanceId === 'app_1')).toBe(false);
  });
});
