import { describe, expect, it } from 'vitest';
import { projectJamState } from './projectJamState';
import { baseJamTransactions, participantWithParticipation, tx } from './__fixtures__/projectionFixtures';

function project(transactions) {
  return projectJamState({ transactions });
}

describe('projection engine business rules', () => {
  it('creates a jam with default instruments, one participant, one participation, and round 1 visible', () => {
    const state = project([
      ...baseJamTransactions(),
      participantWithParticipation(5, { participantId: 'participant_nicolas', name: 'Nicolas', participationId: 'participation_nicolas_guitar', instrumentId: 'instrument_guitar', baseOrderKey: 'm' }),
    ]);

    expect(state.jam).toMatchObject({ jamId: 'jam_demo', name: 'Jam demo' });
    expect(Object.keys(state.instruments)).toEqual(['instrument_vocals', 'instrument_guitar', 'instrument_drums']);
    expect(state.visibleRoundsByInstrument.instrument_guitar).toBe(1);
    expect(state.columns.find((column) => column.instrument.instrumentId === 'instrument_guitar').cards).toHaveLength(1);
  });

  it('projects multi-instrument participant conflicts at participation scope', () => {
    const state = project([
      ...baseJamTransactions(),
      tx(5, [
        { type: 'participant_created', payload: { participantId: 'participant_nicolas', name: 'Nicolas' } },
        { type: 'participation_added', payload: { participationId: 'participation_nicolas_vocals', participantId: 'participant_nicolas', instrumentId: 'instrument_vocals', customInstrumentLabel: null, insertionMode: 'end_of_visible_rounds', startAppearanceIndex: 1, afterTarget: null, beforeTarget: null, baseOrderKey: 'a' } },
        { type: 'participation_added', payload: { participationId: 'participation_nicolas_guitar', participantId: 'participant_nicolas', instrumentId: 'instrument_guitar', customInstrumentLabel: null, insertionMode: 'end_of_visible_rounds', startAppearanceIndex: 1, afterTarget: null, beforeTarget: null, baseOrderKey: 'a' } },
        { type: 'conflict_created', payload: { conflictId: 'conflict_nicolas_multi', scope: 'participation', targetIds: ['participation_nicolas_vocals', 'participation_nicolas_guitar'], reason: 'instrument_constraint', anchorTargetId: 'participation_nicolas_vocals' } },
      ]),
      tx(6, [{ type: 'link_created', payload: { linkId: 'link_contradictory', targets: [{ type: 'appearance', id: 'appearance_participation_nicolas_vocals_1' }, { type: 'appearance', id: 'appearance_participation_nicolas_guitar_1' }], anchorTarget: { type: 'appearance', id: 'appearance_participation_nicolas_vocals_1' }, reorderStrategy: 'move_to_first' } }]),
    ]);

    expect(state.conflicts.conflict_nicolas_multi.reason).toBe('instrument_constraint');
    expect(state.links.link_contradictory.suppressedByConflict).toBe(true);
  });

  it('handles round 2 reveal, a participant added after reveal, and a between-target round 2 insertion', () => {
    const state = project([
      ...baseJamTransactions(),
      tx(5, [{ type: 'instrument_round_visibility_changed', payload: { instrumentId: 'instrument_guitar', visibleRoundCount: 2 } }]),
      participantWithParticipation(6, { participantId: 'participant_paul', name: 'Paul', participationId: 'participation_paul_guitar', instrumentId: 'instrument_guitar', baseOrderKey: 'a' }),
      tx(7, [
        { type: 'participant_created', payload: { participantId: 'participant_emma', name: 'Emma' } },
        { type: 'participation_added', payload: { participationId: 'participation_emma_guitar', participantId: 'participant_emma', instrumentId: 'instrument_guitar', customInstrumentLabel: null, insertionMode: 'between_targets', startAppearanceIndex: 2, afterTarget: { type: 'appearance', id: 'appearance_participation_paul_guitar_2' }, beforeTarget: null, baseOrderKey: 'b' } },
      ]),
    ]);

    expect(Object.values(state.appearances).filter((appearance) => appearance.participationId === 'participation_paul_guitar').map((appearance) => appearance.appearanceIndex)).toEqual([1, 2]);
    expect(Object.values(state.appearances).filter((appearance) => appearance.participationId === 'participation_emma_guitar').map((appearance) => appearance.appearanceIndex)).toEqual([2]);
  });

  it('applies link strategies move_to_first, move_to_last, average_position, and supports hole targets', () => {
    const common = [
      ...baseJamTransactions(),
      tx(5, [{ type: 'appearance_materialized', payload: { appearanceId: 'appearance_a', participationId: 'p_a', instrumentId: 'instrument_guitar', appearanceIndex: 1, positionKey: 'a' } }]),
      tx(6, [{ type: 'hole_added', payload: { holeId: 'hole_z', instrumentId: 'instrument_guitar', appearanceIndex: 1, reason: 'manual', afterTarget: null, beforeTarget: null, positionKey: 'z' } }]),
    ];

    expect(project([...common, tx(7, [{ type: 'link_created', payload: { linkId: 'link_first', targets: [{ type: 'appearance', id: 'appearance_a' }, { type: 'hole', id: 'hole_z' }], anchorTarget: { type: 'appearance', id: 'appearance_a' }, reorderStrategy: 'move_to_first' } }])]).holes.hole_z.orderScore).toBe(97);
    expect(project([...common, tx(7, [{ type: 'link_created', payload: { linkId: 'link_last', targets: [{ type: 'appearance', id: 'appearance_a' }, { type: 'hole', id: 'hole_z' }], anchorTarget: { type: 'appearance', id: 'appearance_a' }, reorderStrategy: 'move_to_last' } }])]).appearances.appearance_a.orderScore).toBe(122);
    expect(project([...common, tx(7, [{ type: 'link_created', payload: { linkId: 'link_avg', targets: [{ type: 'appearance', id: 'appearance_a' }, { type: 'hole', id: 'hole_z' }], anchorTarget: { type: 'appearance', id: 'appearance_a' }, reorderStrategy: 'average_position' } }])]).appearances.appearance_a.orderScore).toBe(109.5);
  });

  it('keeps conflicts active for appearance and participation scopes and does not move played or locked conflict targets', () => {
    const state = project([
      ...baseJamTransactions(),
      tx(5, [{ type: 'appearance_materialized', payload: { appearanceId: 'appearance_anchor', participationId: 'participation_anchor', instrumentId: 'instrument_guitar', appearanceIndex: 1, positionKey: 'a' } }]),
      tx(6, [{ type: 'appearance_materialized', payload: { appearanceId: 'appearance_locked', participationId: 'participation_locked', instrumentId: 'instrument_guitar', appearanceIndex: 1, positionKey: 'a' } }]),
      tx(7, [{ type: 'appearance_locked', payload: { appearanceId: 'appearance_locked' } }]),
      tx(8, [{ type: 'conflict_created', payload: { conflictId: 'conflict_appearance', scope: 'appearance', targetIds: ['appearance_anchor', 'appearance_locked'], reason: 'manual', anchorTargetId: 'appearance_anchor' } }]),
    ]);

    expect(state.conflicts.conflict_appearance.scope).toBe('appearance');
    expect(state.appearances.appearance_locked.orderScore).toBe(state.appearances.appearance_anchor.orderScore);
    expect(state.appearances.appearance_locked.locked).toBe(true);
  });

  it('locks and unlocks appearances and holes', () => {
    const state = project([
      ...baseJamTransactions(),
      tx(5, [{ type: 'appearance_materialized', payload: { appearanceId: 'appearance_a', participationId: 'p_a', instrumentId: 'instrument_guitar', appearanceIndex: 1, positionKey: 'a' } }]),
      tx(6, [{ type: 'hole_added', payload: { holeId: 'hole_a', instrumentId: 'instrument_guitar', appearanceIndex: 1, reason: 'manual', afterTarget: null, beforeTarget: null, positionKey: 'b' } }]),
      tx(7, [{ type: 'appearance_locked', payload: { appearanceId: 'appearance_a' } }, { type: 'hole_locked', payload: { holeId: 'hole_a' } }]),
      tx(8, [{ type: 'appearance_unlocked', payload: { appearanceId: 'appearance_a' } }, { type: 'hole_unlocked', payload: { holeId: 'hole_a' } }]),
    ]);

    expect(state.appearances.appearance_a.locked).toBe(false);
    expect(state.holes.hole_a.locked).toBe(false);
    expect(state.locks).toEqual({});
  });

  it('marks played plateau targets, only unplays the latest plateau, and keeps played cards immobile', () => {
    const state = project([
      ...baseJamTransactions(),
      tx(5, [{ type: 'appearance_materialized', payload: { appearanceId: 'appearance_a', participationId: 'p_a', instrumentId: 'instrument_guitar', appearanceIndex: 1, positionKey: 'a' } }]),
      tx(6, [{ type: 'hole_added', payload: { holeId: 'hole_b', instrumentId: 'instrument_guitar', appearanceIndex: 1, reason: 'manual', afterTarget: null, beforeTarget: null, positionKey: 'b' } }]),
      tx(7, [{ type: 'plateau_played', payload: { plateauIndex: 1, targets: [{ type: 'appearance', id: 'appearance_a' }], playedAt: '2026-01-15T21:00:00.000Z' } }]),
      tx(8, [{ type: 'plateau_played', payload: { plateauIndex: 2, targets: [{ type: 'hole', id: 'hole_b' }], playedAt: '2026-01-15T21:05:00.000Z' } }]),
      tx(9, [{ type: 'plateau_unplayed', payload: { plateauIndex: 1, targets: [{ type: 'appearance', id: 'appearance_a' }] } }]),
      tx(10, [{ type: 'appearance_moved_between', payload: { appearanceId: 'appearance_a', instrumentId: 'instrument_guitar', afterTarget: { type: 'hole', id: 'hole_b' }, beforeTarget: null, movedLinkedGroup: false } }]),
    ]);

    expect(state.appearances.appearance_a.played).toBe(true);
    expect(state.holes.hole_b.played).toBe(true);
    expect(state.playedPlateaux).toEqual({ 1: true, 2: true });
    expect(state.projectionWarnings.map((warning) => warning.code)).toContain('non_last_plateau_unplayed_ignored');
    expect(state.projectionWarnings.map((warning) => warning.code)).toContain('immobile_target');
  });

  it('adds/removes holes and removes links targeting removed holes', () => {
    const state = project([
      ...baseJamTransactions(),
      tx(5, [{ type: 'appearance_materialized', payload: { appearanceId: 'appearance_a', participationId: 'p_a', instrumentId: 'instrument_drums', appearanceIndex: 1, positionKey: 'a' } }]),
      tx(6, [{ type: 'hole_added', payload: { holeId: 'hole_without', instrumentId: 'instrument_drums', appearanceIndex: 1, reason: 'play_without', afterTarget: null, beforeTarget: null, positionKey: 'b' } }]),
      tx(7, [{ type: 'link_created', payload: { linkId: 'link_without', targets: [{ type: 'appearance', id: 'appearance_a' }, { type: 'hole', id: 'hole_without' }], anchorTarget: { type: 'appearance', id: 'appearance_a' }, reorderStrategy: 'move_to_first' } }]),
      tx(8, [{ type: 'hole_removed', payload: { holeId: 'hole_without', confirmedDespiteLink: true } }]),
    ]);

    expect(state.holes.hole_without.status).toBe('removed');
    expect(state.links.link_without.status).toBe('removed');
  });

  it('skips an appearance by delinking only that appearance and without durable temporarily_away state', () => {
    const state = project([
      ...baseJamTransactions(),
      participantWithParticipation(5, { participantId: 'participant_nicolas', name: 'Nicolas', participationId: 'participation_nicolas_guitar', instrumentId: 'instrument_guitar', baseOrderKey: 'a' }),
      tx(6, [{ type: 'hole_added', payload: { holeId: 'hole_replacement', instrumentId: 'instrument_guitar', appearanceIndex: 1, reason: 'call_drawer_without_musician', afterTarget: null, beforeTarget: null, positionKey: 'b' } }]),
      tx(7, [{ type: 'link_created', payload: { linkId: 'link_skip', targets: [{ type: 'appearance', id: 'appearance_participation_nicolas_guitar_1' }, { type: 'hole', id: 'hole_replacement' }], anchorTarget: { type: 'appearance', id: 'appearance_participation_nicolas_guitar_1' }, reorderStrategy: 'move_to_first' } }]),
      tx(8, [{ type: 'appearance_skipped', payload: { appearanceId: 'appearance_participation_nicolas_guitar_1', instrumentId: 'instrument_guitar', originalPlateauIndex: 1, replacement: { mode: 'hole', holeId: 'hole_replacement' }, createdHoleId: 'hole_replacement', removedLinkIds: ['link_skip'], confirmedDelink: true } }]),
    ]);

    expect(state.links.link_skip.status).toBe('removed');
    expect(state.appearances.appearance_participation_nicolas_guitar_1.skippedAtPlateauIndex).toBe(1);
    expect(state.participants.participant_nicolas.presenceStatus).toBeUndefined();
    expect(state.participants.participant_nicolas.status).toBe('active');
  });

  it('marks a participant left by keeping played history and removing future calculated appearances', () => {
    const state = project([
      ...baseJamTransactions(),
      tx(5, [{ type: 'instrument_round_visibility_changed', payload: { instrumentId: 'instrument_guitar', visibleRoundCount: 2 } }]),
      participantWithParticipation(6, { participantId: 'participant_nicolas', name: 'Nicolas', participationId: 'participation_nicolas_guitar', instrumentId: 'instrument_guitar', baseOrderKey: 'a' }),
      tx(7, [{ type: 'appearance_materialized', payload: { appearanceId: 'appearance_history', participationId: 'participation_nicolas_guitar', instrumentId: 'instrument_guitar', appearanceIndex: 1, positionKey: 'a' } }]),
      tx(8, [{ type: 'plateau_played', payload: { plateauIndex: 1, targets: [{ type: 'appearance', id: 'appearance_history' }], playedAt: '2026-01-15T21:00:00.000Z' } }]),
      tx(9, [{ type: 'participant_marked_left', payload: { participantId: 'participant_nicolas', confirmedDespiteFutureLockedAppearances: true } }]),
    ]);

    expect(state.appearances.appearance_history.played).toBe(true);
    expect(Object.values(state.appearances).filter((appearance) => appearance.participationId === 'participation_nicolas_guitar' && appearance.status !== 'removed')).toHaveLength(1);
  });

  it('hides an instrument column while preserving its historical entities', () => {
    const state = project([
      ...baseJamTransactions(),
      participantWithParticipation(5, { participantId: 'participant_nicolas', name: 'Nicolas', participationId: 'participation_nicolas_guitar', instrumentId: 'instrument_guitar', baseOrderKey: 'a' }),
      tx(6, [{ type: 'instrument_visibility_changed', payload: { instrumentId: 'instrument_guitar', visible: false, confirmedDespiteActiveLinks: true } }]),
    ]);

    expect(state.columns.some((column) => column.instrument.instrumentId === 'instrument_guitar')).toBe(false);
    expect(state.participations.participation_nicolas_guitar.status).toBe('active');
    expect(state.appearances.appearance_participation_nicolas_guitar_1).toBeDefined();
  });

  it('supports reverting the latest active transaction and warns on non-linear undo', () => {
    const reversible = tx(5, [{ type: 'instrument_updated', payload: { instrumentId: 'instrument_guitar', label: 'Guitare lead' } }], 'tx_update_guitar');
    const undo = tx(6, [{ type: 'transaction_reverted', payload: { targetTransactionId: 'tx_update_guitar', targetClientSequenceNumber: 5, reason: 'organizer_undo' } }], 'tx_undo_guitar');
    expect(project([...baseJamTransactions(), reversible, undo]).instruments.instrument_guitar.label).toBe('Guitare');

    const older = participantWithParticipation(5, { participantId: 'participant_nicolas', name: 'Nicolas', participationId: 'participation_nicolas_guitar', instrumentId: 'instrument_guitar', baseOrderKey: 'a' });
    const newer = tx(6, [{ type: 'instrument_updated', payload: { instrumentId: 'instrument_guitar', label: 'Guitare lead' } }], 'tx_newer');
    const nonLinearUndo = tx(7, [{ type: 'transaction_reverted', payload: { targetTransactionId: older.transactionId, targetClientSequenceNumber: 5, reason: 'organizer_undo' } }], 'tx_bad_undo');
    expect(project([...baseJamTransactions(), older, newer, nonLinearUndo]).projectionWarnings.map((warning) => warning.code)).toContain('non_linear_undo_ignored');
  });
});
