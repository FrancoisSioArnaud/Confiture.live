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

  it('reveals round 2 and keeps the V2 resolved layout deterministic in one column', () => {
    const state = projectJamState({ transactions: [
      ...jamAndGuitar,
      tx(3, [{ type: 'instrument_round_visibility_changed', payload: { instrumentId: 'instrument_guitar', visibleRoundCount: 2 } }]),
      tx(4, [{ type: 'participant_created', payload: { participantId: 'participant_noe', name: 'Noé' } }, { type: 'participation_added', payload: { participationId: 'participation_noe_guitar', participantId: 'participant_noe', instrumentId: 'instrument_guitar', customInstrumentLabel: null, insertionMode: 'end_of_visible_rounds', startAppearanceIndex: 1, afterTarget: null, beforeTarget: null, baseOrderKey: 'order_0' } }]),
      tx(5, [{ type: 'participant_created', payload: { participantId: 'participant_iris', name: 'Iris' } }, { type: 'participation_added', payload: { participationId: 'participation_iris_guitar', participantId: 'participant_iris', instrumentId: 'instrument_guitar', customInstrumentLabel: null, insertionMode: 'end_of_visible_rounds', startAppearanceIndex: 1, afterTarget: null, beforeTarget: null, baseOrderKey: 'order_1' } }]),
      tx(6, [{ type: 'participant_created', payload: { participantId: 'participant_tom', name: 'Tom' } }, { type: 'participation_added', payload: { participationId: 'participation_tom_guitar', participantId: 'participant_tom', instrumentId: 'instrument_guitar', customInstrumentLabel: null, insertionMode: 'end_of_visible_rounds', startAppearanceIndex: 1, afterTarget: null, beforeTarget: null, baseOrderKey: 'order_2' } }]),
    ] });

    expect(state.columns[0].cards.map((card) => state.participants[card.participantId].name)).toEqual(['Noé', 'Iris', 'Tom', 'Iris', 'Noé', 'Tom']);
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

  it('keeps contradictory same-column link and conflict deterministic under V2', () => {
    const base = [
      ...jamAndGuitar,
      tx(3, [{ type: 'appearance_materialized', payload: { appearanceId: 'appearance_a', participationId: 'p_a', instrumentId: 'instrument_guitar', appearanceIndex: 1, positionKey: 'a' } }]),
      tx(4, [{ type: 'hole_added', payload: { holeId: 'hole_b', instrumentId: 'instrument_guitar', appearanceIndex: 1, reason: 'manual', afterTarget: null, beforeTarget: null, positionKey: 'z' } }]),
    ];

    const linked = projectJamState({ transactions: [
      ...base,
      tx(5, [{ type: 'link_created', payload: { linkId: 'link_1', targets: [{ type: 'appearance', id: 'appearance_a' }, { type: 'hole', id: 'hole_b' }], anchorTarget: { type: 'appearance', id: 'appearance_a' }, reorderStrategy: 'move_to_first' } }]),
    ] });
    expect(linked.layoutByCardId.appearance_a.resolvedRow).not.toBe(linked.layoutByCardId.hole_b.resolvedRow);

    const conflicted = projectJamState({ transactions: [
      ...base,
      tx(5, [{ type: 'conflict_created', payload: { conflictId: 'conflict_1', scope: 'appearance', targetIds: ['appearance_a', 'hole_b'], reason: 'manual' } }]),
      tx(6, [{ type: 'link_created', payload: { linkId: 'link_1', targets: [{ type: 'appearance', id: 'appearance_a' }, { type: 'hole', id: 'hole_b' }], anchorTarget: { type: 'appearance', id: 'appearance_a' }, reorderStrategy: 'move_to_first' } }]),
    ] });
    expect(conflicted.links.link_1.suppressedByConflict).toBe(false);
    expect(conflicted.layoutByCardId.appearance_a.resolvedRow).not.toBe(conflicted.layoutByCardId.hole_b.resolvedRow);
  });



  it('keeps same-column link strategies deterministic without using legacy position as final order', () => {
    function linkedWith(strategy) {
      return projectJamState({ transactions: [
        ...jamAndGuitar,
        tx(3, [{ type: 'appearance_materialized', payload: { appearanceId: 'appearance_a', participationId: 'p_a', instrumentId: 'instrument_guitar', appearanceIndex: 1, positionKey: 'a' } }]),
        tx(4, [{ type: 'hole_added', payload: { holeId: 'hole_z', instrumentId: 'instrument_guitar', appearanceIndex: 1, reason: 'manual', afterTarget: null, beforeTarget: null, positionKey: 'z' } }]),
        tx(5, [{ type: 'link_created', payload: { linkId: `link_${strategy}`, targets: [{ type: 'appearance', id: 'appearance_a' }, { type: 'hole', id: 'hole_z' }], anchorTarget: { type: 'appearance', id: 'appearance_a' }, reorderStrategy: strategy } }]),
      ] });
    }

    ['move_to_first', 'move_to_last', 'average_position'].forEach((strategy) => {
      const state = linkedWith(strategy);
      expect(state.layoutByCardId.appearance_a.resolvedRow).not.toBe(state.layoutByCardId.hole_z.resolvedRow);
      expect(state.links[`link_${strategy}`].status).toBe('active');
    });
  });

  it('reapplies an active link when a contradictory conflict is removed', () => {
    const state = projectJamState({ transactions: [
      ...jamAndGuitar,
      tx(3, [{ type: 'appearance_materialized', payload: { appearanceId: 'appearance_a', participationId: 'p_a', instrumentId: 'instrument_guitar', appearanceIndex: 1, positionKey: 'a' } }]),
      tx(4, [{ type: 'hole_added', payload: { holeId: 'hole_z', instrumentId: 'instrument_guitar', appearanceIndex: 1, reason: 'manual', afterTarget: null, beforeTarget: null, positionKey: 'z' } }]),
      tx(5, [{ type: 'conflict_created', payload: { conflictId: 'conflict_1', scope: 'appearance', targetIds: ['appearance_a', 'hole_z'], reason: 'manual' } }]),
      tx(6, [{ type: 'link_created', payload: { linkId: 'link_1', targets: [{ type: 'appearance', id: 'appearance_a' }, { type: 'hole', id: 'hole_z' }], anchorTarget: { type: 'appearance', id: 'appearance_a' }, reorderStrategy: 'move_to_first' } }]),
      tx(7, [{ type: 'conflict_removed', payload: { conflictId: 'conflict_1' } }]),
    ] });

    expect(state.links.link_1.suppressedByConflict).toBe(false);
    expect(state.layoutByCardId.appearance_a.resolvedRow).not.toBe(state.layoutByCardId.hole_z.resolvedRow);
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
    expect(state.appearances.appearance_a.positionInRound).toBe(97);
    expect(state.holes.hole_b.played).toBe(true);
    expect(state.projectionWarnings.map((warning) => warning.type)).toContain('invalid_action_replayed');
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



  it('keeps an appearance_removed tombstone for a calculated future appearance before that round is visible', () => {
    const state = projectJamState({ transactions: [
      ...jamAndGuitar,
      tx(3, [{ type: 'participant_created', payload: { participantId: 'participant_nico', name: 'Nico' } }]),
      tx(4, [{ type: 'participation_added', payload: { participationId: 'participation_nico_guitar', participantId: 'participant_nico', instrumentId: 'instrument_guitar', customInstrumentLabel: null, insertionMode: 'end_of_visible_rounds', startAppearanceIndex: 1, afterTarget: null, beforeTarget: null, baseOrderKey: 'a' } }]),
      tx(5, [{ type: 'appearance_removed', payload: { appearanceId: 'appearance_participation_nico_guitar_2', confirmedDespiteLink: false } }]),
      tx(6, [{ type: 'instrument_round_visibility_changed', payload: { instrumentId: 'instrument_guitar', visibleRoundCount: 2 } }]),
    ] });

    expect(state.appearances.appearance_participation_nico_guitar_2).toMatchObject({ status: 'removed', materialized: true, appearanceIndex: 2 });
    expect(state.columns[0].cards.map((card) => card.id)).not.toContain('appearance_participation_nico_guitar_2');
    expect(state.projectionWarnings.map((warning) => warning.code)).not.toContain('missing_appearance');
  });

  it('participant_marked_left removes materialized unplayed future appearances and their links', () => {
    const state = projectJamState({ transactions: [
      ...jamAndGuitar,
      tx(3, [{ type: 'participant_created', payload: { participantId: 'participant_nico', name: 'Nico' } }]),
      tx(4, [{ type: 'participation_added', payload: { participationId: 'participation_nico_guitar', participantId: 'participant_nico', instrumentId: 'instrument_guitar', customInstrumentLabel: null, insertionMode: 'end_of_visible_rounds', startAppearanceIndex: 1, afterTarget: null, beforeTarget: null, baseOrderKey: 'a' } }]),
      tx(5, [{ type: 'appearance_materialized', payload: { appearanceId: 'appearance_participation_nico_guitar_2', participationId: 'participation_nico_guitar', instrumentId: 'instrument_guitar', appearanceIndex: 2, positionKey: 'b' } }]),
      tx(6, [{ type: 'hole_added', payload: { holeId: 'hole_linked', instrumentId: 'instrument_guitar', appearanceIndex: 2, reason: 'manual', afterTarget: null, beforeTarget: null, positionKey: 'z' } }]),
      tx(7, [{ type: 'link_created', payload: { linkId: 'link_future', targets: [{ type: 'appearance', id: 'appearance_participation_nico_guitar_2' }, { type: 'hole', id: 'hole_linked' }], anchorTarget: { type: 'appearance', id: 'appearance_participation_nico_guitar_2' }, reorderStrategy: 'move_to_first' } }]),
      tx(8, [{ type: 'participant_marked_left', payload: { participantId: 'participant_nico', confirmedDespiteFutureLockedAppearances: true } }]),
    ] });

    expect(state.participants.participant_nico.status).toBe('left');
    expect(state.appearances.appearance_participation_nico_guitar_2.status).toBe('removed');
    expect(state.links.link_future.status).toBe('removed');
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
