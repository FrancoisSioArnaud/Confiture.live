import { describe, expect, it } from 'vitest';
import { projectJamState } from './projectJamState';

function tx(sequence, events, transactionId = `transaction_${sequence}`) {
  return {
    transactionId,
    clientSequenceNumber: sequence,
    serverSequenceNumberStart: sequence,
    events: events.map((event, eventIndexInTransaction) => ({
      eventId: `event_${sequence}_${eventIndexInTransaction}`,
      transactionId,
      clientSequenceNumber: sequence,
      serverSequenceNumber: sequence * 10 + eventIndexInTransaction,
      eventIndexInTransaction,
      schemaVersion: 1,
      ...event,
    })),
  };
}

const jamAndGuitar = [
  tx(1, [{ type: 'jam_created', payload: { jamId: 'jam_1', name: 'Jam', indicativeDate: '2026-06-17', linkReorderStrategy: 'move_to_first' } }]),
  tx(2, [{ type: 'instrument_added', payload: { instrumentId: 'instrument_guitar', label: 'Guitare', orderKey: 'a', visible: true, isDefault: true } }]),
];

describe('projectJamState', () => {
  it('projects jam metadata, instruments, participants, participations and calculated appearances', () => {
    const state = projectJamState({ transactions: [
      ...jamAndGuitar,
      tx(3, [{ type: 'participant_created', payload: { participantId: 'participant_nico', name: 'Nico' } }]),
      tx(4, [{ type: 'participation_added', payload: {
        participationId: 'participation_nico_guitar',
        participantId: 'participant_nico',
        instrumentId: 'instrument_guitar',
        customInstrumentLabel: null,
        insertionMode: 'end_of_visible_rounds',
        startAppearanceIndex: 1,
        afterTarget: null,
        beforeTarget: null,
        baseOrderKey: 'a',
      } }]),
    ] });

    expect(state.jam.name).toBe('Jam');
    expect(state.columns).toHaveLength(1);
    expect(state.columns[0].cards[0]).toMatchObject({ type: 'appearance', participantId: 'participant_nico', appearanceIndex: 1, materialized: false });
    expect(state.countersByInstrument.instrument_guitar.appearances).toBe(1);
  });

  it('reveals rounds by instrument and starts between-target insertions at round 2', () => {
    const state = projectJamState({ transactions: [
      ...jamAndGuitar,
      tx(3, [{ type: 'instrument_round_visibility_changed', payload: { instrumentId: 'instrument_guitar', visibleRoundCount: 2 } }]),
      tx(4, [{ type: 'participant_created', payload: { participantId: 'participant_anna', name: 'Anna' } }]),
      tx(5, [{ type: 'participation_added', payload: {
        participationId: 'participation_anna_guitar',
        participantId: 'participant_anna',
        instrumentId: 'instrument_guitar',
        customInstrumentLabel: null,
        insertionMode: 'between_targets',
        startAppearanceIndex: 2,
        afterTarget: { type: 'appearance', id: 'appearance_x' },
        beforeTarget: null,
        baseOrderKey: 'b',
      } }]),
    ] });

    const appearances = Object.values(state.appearances).filter((appearance) => appearance.participationId === 'participation_anna_guitar');
    expect(appearances.map((appearance) => appearance.appearanceIndex)).toEqual([2]);
    expect(state.visibleRoundsByInstrument.instrument_guitar).toBe(2);
  });

  it('projects holes and play-without as hole_added plus link_created', () => {
    const state = projectJamState({ transactions: [
      ...jamAndGuitar,
      tx(3, [{ type: 'participant_created', payload: { participantId: 'participant_nico', name: 'Nico' } }]),
      tx(4, [{ type: 'participation_added', payload: {
        participationId: 'participation_nico_guitar', participantId: 'participant_nico', instrumentId: 'instrument_guitar', customInstrumentLabel: null,
        insertionMode: 'end_of_visible_rounds', startAppearanceIndex: 1, afterTarget: null, beforeTarget: null, baseOrderKey: 'a',
      } }]),
      tx(5, [{ type: 'hole_added', payload: {
        holeId: 'hole_1', instrumentId: 'instrument_guitar', appearanceIndex: 1, reason: 'play_without', afterTarget: null, beforeTarget: null, positionKey: 'z',
      } }]),
      tx(6, [{ type: 'link_created', payload: {
        linkId: 'link_1', targets: [{ type: 'appearance', id: 'appearance_participation_nico_guitar_1' }, { type: 'hole', id: 'hole_1' }],
        anchorTarget: { type: 'appearance', id: 'appearance_participation_nico_guitar_1' }, reorderStrategy: 'move_to_first',
      } }]),
    ] });

    expect(state.holes.hole_1.reason).toBe('play_without');
    expect(state.links.link_1.status).toBe('active');
    expect(state.columns[0].cards.map((card) => card.type)).toContain('hole');
  });

  it('applies link reorder strategies unless a conflict suppresses the link', () => {
    const base = [
      ...jamAndGuitar,
      tx(3, [{ type: 'appearance_materialized', payload: { appearanceId: 'appearance_a', participationId: 'p_a', instrumentId: 'instrument_guitar', appearanceIndex: 1, positionKey: 'a' } }]),
      tx(4, [{ type: 'hole_added', payload: { holeId: 'hole_b', instrumentId: 'instrument_guitar', appearanceIndex: 1, reason: 'manual', afterTarget: null, beforeTarget: null, positionKey: 'z' } }]),
    ];

    const linked = projectJamState({ transactions: [
      ...base,
      tx(5, [{ type: 'link_created', payload: { linkId: 'link_1', targets: [{ type: 'appearance', id: 'appearance_a' }, { type: 'hole', id: 'hole_b' }], anchorTarget: { type: 'appearance', id: 'appearance_a' }, reorderStrategy: 'move_to_first' } }]),
    ] });
    expect(linked.appearances.appearance_a.orderScore).toBe(linked.holes.hole_b.orderScore);

    const conflicted = projectJamState({ transactions: [
      ...base,
      tx(5, [{ type: 'conflict_created', payload: { conflictId: 'conflict_1', scope: 'appearance', targetIds: ['appearance_a', 'hole_b'], reason: 'manual', anchorTargetId: 'appearance_a' } }]),
      tx(6, [{ type: 'link_created', payload: { linkId: 'link_1', targets: [{ type: 'appearance', id: 'appearance_a' }, { type: 'hole', id: 'hole_b' }], anchorTarget: { type: 'appearance', id: 'appearance_a' }, reorderStrategy: 'move_to_first' } }]),
    ] });
    expect(conflicted.links.link_1.suppressedByConflict).toBe(true);
    expect(conflicted.appearances.appearance_a.orderScore).not.toBe(conflicted.holes.hole_b.orderScore);
  });

  it('keeps played and locked targets immobile when move events occur', () => {
    const state = projectJamState({ transactions: [
      ...jamAndGuitar,
      tx(3, [{ type: 'appearance_materialized', payload: { appearanceId: 'appearance_a', participationId: 'p_a', instrumentId: 'instrument_guitar', appearanceIndex: 1, positionKey: 'a' } }]),
      tx(4, [{ type: 'hole_added', payload: { holeId: 'hole_b', instrumentId: 'instrument_guitar', appearanceIndex: 1, reason: 'manual', afterTarget: null, beforeTarget: null, positionKey: 'z' } }]),
      tx(5, [{ type: 'appearance_locked', payload: { appearanceId: 'appearance_a' } }]),
      tx(6, [{ type: 'appearance_moved_between', payload: { appearanceId: 'appearance_a', instrumentId: 'instrument_guitar', afterTarget: { type: 'hole', id: 'hole_b' }, beforeTarget: null, movedLinkedGroup: false } }]),
      tx(7, [{ type: 'plateau_played', payload: { plateauIndex: 1, targets: [{ type: 'hole', id: 'hole_b' }], playedAt: '2026-06-14T21:00:00.000Z' } }]),
      tx(8, [{ type: 'hole_moved_between', payload: { holeId: 'hole_b', instrumentId: 'instrument_guitar', afterTarget: { type: 'appearance', id: 'appearance_a' }, beforeTarget: null, movedLinkedGroup: false } }]),
    ] });

    expect(state.appearances.appearance_a.locked).toBe(true);
    expect(state.appearances.appearance_a.orderScore).toBe(97);
    expect(state.holes.hole_b.played).toBe(true);
    expect(state.projectionWarnings.map((warning) => warning.code)).toContain('immobile_target');
  });

  it('keeps skipped appearances as punctual metadata and removes requested links', () => {
    const state = projectJamState({ transactions: [
      ...jamAndGuitar,
      tx(3, [{ type: 'appearance_materialized', payload: { appearanceId: 'appearance_a', participationId: 'p_a', instrumentId: 'instrument_guitar', appearanceIndex: 1, positionKey: 'a' } }]),
      tx(4, [{ type: 'hole_added', payload: { holeId: 'hole_b', instrumentId: 'instrument_guitar', appearanceIndex: 1, reason: 'manual', afterTarget: null, beforeTarget: null, positionKey: 'z' } }]),
      tx(5, [{ type: 'link_created', payload: { linkId: 'link_1', targets: [{ type: 'appearance', id: 'appearance_a' }, { type: 'hole', id: 'hole_b' }], anchorTarget: { type: 'appearance', id: 'appearance_a' }, reorderStrategy: 'average_position' } }]),
      tx(6, [{ type: 'appearance_skipped', payload: { appearanceId: 'appearance_a', instrumentId: 'instrument_guitar', originalPlateauIndex: 2, replacement: { mode: 'none' }, createdHoleId: null, removedLinkIds: ['link_1'], confirmedDelink: true } }]),
    ] });

    expect(state.appearances.appearance_a.skippedAtPlateauIndex).toBe(2);
    expect(state.links.link_1.status).toBe('removed');
  });

  it('participant_marked_left removes future calculated appearances but keeps played materialized history', () => {
    const state = projectJamState({ transactions: [
      ...jamAndGuitar,
      tx(3, [{ type: 'instrument_round_visibility_changed', payload: { instrumentId: 'instrument_guitar', visibleRoundCount: 2 } }]),
      tx(4, [{ type: 'participant_created', payload: { participantId: 'participant_nico', name: 'Nico' } }]),
      tx(5, [{ type: 'participation_added', payload: { participationId: 'participation_nico_guitar', participantId: 'participant_nico', instrumentId: 'instrument_guitar', customInstrumentLabel: null, insertionMode: 'end_of_visible_rounds', startAppearanceIndex: 1, afterTarget: null, beforeTarget: null, baseOrderKey: 'a' } }]),
      tx(6, [{ type: 'appearance_materialized', payload: { appearanceId: 'appearance_history', participationId: 'participation_nico_guitar', instrumentId: 'instrument_guitar', appearanceIndex: 1, positionKey: 'a' } }]),
      tx(7, [{ type: 'plateau_played', payload: { plateauIndex: 1, targets: [{ type: 'appearance', id: 'appearance_history' }], playedAt: '2026-06-14T21:00:00.000Z' } }]),
      tx(8, [{ type: 'participant_marked_left', payload: { participantId: 'participant_nico', confirmedDespiteFutureLockedAppearances: true } }]),
    ] });

    expect(state.participants.participant_nico.status).toBe('left');
    expect(state.appearances.appearance_history.played).toBe(true);
    expect(Object.values(state.appearances).filter((appearance) => appearance.participationId === 'participation_nico_guitar' && appearance.status !== 'removed')).toHaveLength(1);
  });

  it('hides invisible instruments from display columns without deleting history', () => {
    const state = projectJamState({ transactions: [
      ...jamAndGuitar,
      tx(3, [{ type: 'instrument_visibility_changed', payload: { instrumentId: 'instrument_guitar', visible: false, confirmedDespiteActiveLinks: true } }]),
    ] });

    expect(state.instruments.instrument_guitar.visible).toBe(false);
    expect(state.columns).toHaveLength(0);
  });

  it('supports linear transaction_reverted and ignores non-linear undo with a warning', () => {
    const createParticipant = tx(3, [{ type: 'participant_created', payload: { participantId: 'participant_nico', name: 'Nico' } }], 'transaction_create_participant');
    const createInstrument = tx(4, [{ type: 'instrument_updated', payload: { instrumentId: 'instrument_guitar', label: 'Guitare lead' } }], 'transaction_update_instrument');
    const undoLast = tx(5, [{ type: 'transaction_reverted', payload: { targetTransactionId: 'transaction_update_instrument', targetClientSequenceNumber: 4, reason: 'organizer_undo' } }], 'transaction_undo');
    const state = projectJamState({ transactions: [...jamAndGuitar, createParticipant, createInstrument, undoLast] });

    expect(state.instruments.instrument_guitar.label).toBe('Guitare');
    expect(state.participants.participant_nico.name).toBe('Nico');

    const nonLinear = projectJamState({ transactions: [...jamAndGuitar, createParticipant, createInstrument, tx(5, [{ type: 'transaction_reverted', payload: { targetTransactionId: 'transaction_create_participant', targetClientSequenceNumber: 3, reason: 'organizer_undo' } }])] });
    expect(nonLinear.participants.participant_nico).toBeDefined();
    expect(nonLinear.projectionWarnings.map((warning) => warning.code)).toContain('non_linear_undo_ignored');
  });
});
