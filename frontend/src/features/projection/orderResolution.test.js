import { describe, expect, it } from 'vitest';
import { createInitialProjectionState } from './initialState';
import { projectJamState } from './projectJamState';
import { resolveOrderAfterTransaction } from './orderResolution';

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

function baseJam() {
  return [
    tx(1, [{ type: 'jam_created', payload: { jamId: 'jam_1', name: 'Jam', indicativeDate: '2026-06-17', linkReorderStrategy: 'move_to_first' } }]),
    tx(2, [{ type: 'instrument_added', payload: { instrumentId: 'instrument_guitar', label: 'Guitare', orderKey: 'a', visible: true, isDefault: true } }]),
  ];
}

function participant(sequence, id, baseOrderKey) {
  return tx(sequence, [
    { type: 'participant_created', payload: { participantId: `participant_${id}`, name: id.toUpperCase() } },
    { type: 'participation_added', payload: {
      participationId: `participation_${id}_guitar`,
      participantId: `participant_${id}`,
      instrumentId: 'instrument_guitar',
      customInstrumentLabel: null,
      insertionMode: 'end_of_visible_rounds',
      startAppearanceIndex: 1,
      afterTarget: null,
      beforeTarget: null,
      baseOrderKey,
    } },
  ]);
}

function columnIds(state) {
  return state.columns.map((column) => column.cards.map((card) => card.id));
}

describe('orderResolution', () => {
  it('resolves purely and deterministically for the same state and transaction', () => {
    const state = createInitialProjectionState();
    state.appearances.appearance_a = { id: 'appearance_a', appearanceId: 'appearance_a', type: 'appearance', instrumentId: 'instrument_guitar', appearanceIndex: 1, status: 'active', played: false, locked: false, positionKey: 'a', positionInRound: 1, roundOrder: 1 };
    state.holes.hole_b = { id: 'hole_b', holeId: 'hole_b', type: 'hole', instrumentId: 'instrument_guitar', appearanceIndex: 1, status: 'active', played: false, locked: false, positionKey: 'b', positionInRound: 2, roundOrder: 2 };
    const transaction = tx(3, [{ type: 'appearance_moved_between', payload: { appearanceId: 'appearance_a', afterTarget: null, beforeTarget: { type: 'hole', id: 'hole_b' } } }]);

    const first = resolveOrderAfterTransaction(structuredClone(state), { transaction });
    const second = resolveOrderAfterTransaction(structuredClone(state), { transaction });

    expect(first.appearances).toEqual(second.appearances);
    expect(first.holes).toEqual(second.holes);
    expect(first.orderResolution).toEqual(second.orderResolution);
  });

  it('replays the same event log twice to strictly identical columns', () => {
    const transactions = [
      ...baseJam(),
      tx(3, [{ type: 'instrument_round_visibility_changed', payload: { instrumentId: 'instrument_guitar', visibleRoundCount: 2 } }]),
      participant(4, 'a', 'order_0'),
      participant(5, 'b', 'order_1'),
      participant(6, 'c', 'order_2'),
    ];

    expect(projectJamState({ transactions }).columns).toEqual(projectJamState({ transactions }).columns);
  });

  it('runs post-transaction resolution without relying on UI-built columns', () => {
    const transactions = [
      ...baseJam(),
      participant(3, 'a', 'order_0'),
      participant(4, 'b', 'order_1'),
      tx(5, [{ type: 'link_created', payload: {
        linkId: 'link_1',
        targets: [{ type: 'appearance', id: 'appearance_participation_a_guitar_1' }, { type: 'appearance', id: 'appearance_participation_b_guitar_1' }],
        anchorTarget: { type: 'appearance', id: 'appearance_participation_a_guitar_1' },
        reorderStrategy: 'average_position',
      } }]),
    ];

    const state = projectJamState({ transactions });

    expect(state.columns).toHaveLength(1);
    expect(state.appearances.appearance_participation_a_guitar_1.resolvedOrderKey).toBeDefined();
    expect(state.appearances.appearance_participation_b_guitar_1.resolvedOrderKey).toBeDefined();
    expect(state.appearances.appearance_participation_a_guitar_1.orderScore).toBe(state.appearances.appearance_participation_b_guitar_1.orderScore);
  });


  it('does not change card order when participant metadata is updated', () => {
    const beforeUpdate = [
      ...baseJam(),
      participant(3, 'a', 'order_0'),
      participant(4, 'b', 'order_1'),
    ];
    const afterUpdate = [
      ...beforeUpdate,
      tx(5, [{ type: 'participant_updated', payload: { participantId: 'participant_a', name: 'Renamed A' } }]),
    ];

    expect(columnIds(projectJamState({ transactions: afterUpdate }))).toEqual(columnIds(projectJamState({ transactions: beforeUpdate })));
  });

  it('stores link and conflict facts while resolver owns their order side effects', () => {
    const state = projectJamState({ transactions: [
      ...baseJam(),
      participant(3, 'a', 'order_0'),
      participant(4, 'b', 'order_1'),
      tx(5, [{ type: 'conflict_created', payload: {
        conflictId: 'conflict_1',
        scope: 'appearance',
        targetIds: ['appearance_participation_a_guitar_1', 'appearance_participation_b_guitar_1'],
        reason: 'same_musician',
        anchorTargetId: 'appearance_participation_a_guitar_1',
      } }]),
      tx(6, [{ type: 'link_created', payload: {
        linkId: 'link_1',
        targets: [{ type: 'appearance', id: 'appearance_participation_a_guitar_1' }, { type: 'appearance', id: 'appearance_participation_b_guitar_1' }],
        anchorTarget: { type: 'appearance', id: 'appearance_participation_a_guitar_1' },
        reorderStrategy: 'average_position',
      } }]),
    ] });

    expect(state.conflicts.conflict_1).toMatchObject({ status: 'active', anchorTargetId: 'appearance_participation_a_guitar_1' });
    expect(state.links.link_1).toMatchObject({ status: 'active', suppressedByConflict: true });
    expect(state.appearances.appearance_participation_a_guitar_1.resolvedOrderKey).toBeDefined();
    expect(state.appearances.appearance_participation_b_guitar_1.resolvedOrderKey).toBeDefined();
  });

  it('records manual move intent in applyEvent and resolves the final order after the transaction', () => {
    const state = projectJamState({ transactions: [
      ...baseJam(),
      participant(3, 'a', 'order_0'),
      participant(4, 'b', 'order_1'),
      participant(5, 'c', 'order_2'),
      tx(6, [{ type: 'appearance_moved_between', payload: {
        appearanceId: 'appearance_participation_c_guitar_1',
        instrumentId: 'instrument_guitar',
        afterTarget: null,
        beforeTarget: { type: 'appearance', id: 'appearance_participation_a_guitar_1' },
        movedLinkedGroup: false,
      } }]),
    ] });

    const moved = state.appearances.appearance_participation_c_guitar_1;
    expect(moved.manualOrderHint).toMatchObject({
      target: { type: 'appearance', id: 'appearance_participation_c_guitar_1' },
      beforeTarget: { type: 'appearance', id: 'appearance_participation_a_guitar_1' },
    });
    expect(columnIds(state)[0][0]).toBe('appearance_participation_c_guitar_1');
  });


  it("keeps played round-2 card pinned when a new participant is added", () => {
    const state = projectJamState({ transactions: [
      ...baseJam(),
      tx(3, [{ type: 'instrument_round_visibility_changed', payload: { instrumentId: 'instrument_guitar', visibleRoundCount: 2 } }]),
      participant(4, 'a', 'order_0'),
      participant(5, 'b', 'order_1'),
      participant(6, 'c', 'order_2'),
      tx(7, [{ type: 'plateau_played', payload: { plateauIndex: 1, targets: [
        { type: 'appearance', id: 'appearance_participation_a_guitar_1' },
        { type: 'appearance', id: 'appearance_participation_b_guitar_1' },
        { type: 'appearance', id: 'appearance_participation_c_guitar_1' },
        { type: 'appearance', id: 'appearance_participation_a_guitar_2' },
      ] } }]),
      participant(8, 'd', 'order_3'),
    ] });

    expect(columnIds(state)[0]).toEqual([
      'appearance_participation_a_guitar_1',
      'appearance_participation_b_guitar_1',
      'appearance_participation_c_guitar_1',
      'appearance_participation_a_guitar_2',
      'appearance_participation_d_guitar_1',
      'appearance_participation_b_guitar_2',
      'appearance_participation_c_guitar_2',
      'appearance_participation_d_guitar_2',
    ]);
    expect(state.appearances.appearance_participation_a_guitar_2).toMatchObject({ playedAtPlateauIndex: 4, resolvedPlateauIndex: 4 });
  });

  it('keeps locked round-2 card pinned when a new participant is added', () => {
    const state = projectJamState({ transactions: [
      ...baseJam(),
      tx(3, [{ type: 'instrument_round_visibility_changed', payload: { instrumentId: 'instrument_guitar', visibleRoundCount: 2 } }]),
      participant(4, 'a', 'order_0'),
      participant(5, 'b', 'order_1'),
      participant(6, 'c', 'order_2'),
      tx(7, [{ type: 'appearance_locked', payload: { appearanceId: 'appearance_participation_a_guitar_2' } }]),
      participant(8, 'd', 'order_3'),
    ] });

    expect(state.appearances.appearance_participation_a_guitar_2).toMatchObject({ lockedAtPlateauIndex: 4, resolvedPlateauIndex: 4 });
    expect(columnIds(state)[0].indexOf('appearance_participation_d_guitar_1')).toBeGreaterThan(columnIds(state)[0].indexOf('appearance_participation_a_guitar_2'));
  });

  it('does not move a played card when another card is dragged around it', () => {
    const state = projectJamState({ transactions: [
      ...baseJam(),
      tx(3, [{ type: 'instrument_round_visibility_changed', payload: { instrumentId: 'instrument_guitar', visibleRoundCount: 2 } }]),
      participant(4, 'a', 'order_0'),
      participant(5, 'b', 'order_1'),
      participant(6, 'c', 'order_2'),
      tx(7, [{ type: 'plateau_played', payload: { plateauIndex: 1, targets: [{ type: 'appearance', id: 'appearance_participation_a_guitar_2' }] } }]),
      tx(8, [{ type: 'appearance_moved_between', payload: {
        appearanceId: 'appearance_participation_c_guitar_2',
        instrumentId: 'instrument_guitar',
        afterTarget: null,
        beforeTarget: { type: 'appearance', id: 'appearance_participation_a_guitar_2' },
        movedLinkedGroup: false,
      } }]),
    ] });

    expect(state.appearances.appearance_participation_a_guitar_2).toMatchObject({ playedAtPlateauIndex: 4, resolvedPlateauIndex: 4 });
  });

  it('does not move a locked card when another card is dragged around it', () => {
    const state = projectJamState({ transactions: [
      ...baseJam(),
      tx(3, [{ type: 'instrument_round_visibility_changed', payload: { instrumentId: 'instrument_guitar', visibleRoundCount: 2 } }]),
      participant(4, 'a', 'order_0'),
      participant(5, 'b', 'order_1'),
      participant(6, 'c', 'order_2'),
      tx(7, [{ type: 'appearance_locked', payload: { appearanceId: 'appearance_participation_a_guitar_2' } }]),
      tx(8, [{ type: 'appearance_moved_between', payload: {
        appearanceId: 'appearance_participation_c_guitar_2',
        instrumentId: 'instrument_guitar',
        afterTarget: null,
        beforeTarget: { type: 'appearance', id: 'appearance_participation_a_guitar_2' },
        movedLinkedGroup: false,
      } }]),
    ] });

    expect(state.appearances.appearance_participation_a_guitar_2).toMatchObject({ lockedAtPlateauIndex: 4, resolvedPlateauIndex: 4 });
  });

  it('replays played, added, locked and dragged order deterministically', () => {
    const transactions = [
      ...baseJam(),
      tx(3, [{ type: 'instrument_round_visibility_changed', payload: { instrumentId: 'instrument_guitar', visibleRoundCount: 2 } }]),
      participant(4, 'a', 'order_0'),
      participant(5, 'b', 'order_1'),
      participant(6, 'c', 'order_2'),
      tx(7, [{ type: 'plateau_played', payload: { plateauIndex: 1, targets: [{ type: 'appearance', id: 'appearance_participation_a_guitar_2' }] } }]),
      participant(8, 'd', 'order_3'),
      tx(9, [{ type: 'appearance_locked', payload: { appearanceId: 'appearance_participation_b_guitar_2' } }]),
      tx(10, [{ type: 'appearance_moved_between', payload: {
        appearanceId: 'appearance_participation_d_guitar_1',
        instrumentId: 'instrument_guitar',
        afterTarget: null,
        beforeTarget: { type: 'appearance', id: 'appearance_participation_a_guitar_2' },
        movedLinkedGroup: false,
      } }]),
    ];

    expect(projectJamState({ transactions }).columns).toEqual(projectJamState({ transactions }).columns);
  });


  it('suppresses direct conflict links with a deterministic warning from the resolver', () => {
    const state = projectJamState({ transactions: [
      ...baseJam(),
      participant(3, 'a', 'order_0'),
      participant(4, 'b', 'order_1'),
      tx(5, [{ type: 'conflict_created', payload: {
        conflictId: 'conflict_direct',
        scope: 'appearance',
        targetIds: ['appearance_participation_a_guitar_1', 'appearance_participation_b_guitar_1'],
        reason: 'manual',
        anchorTargetId: 'appearance_participation_a_guitar_1',
      } }]),
      tx(6, [{ type: 'link_created', payload: {
        linkId: 'link_direct_conflict',
        targets: [{ type: 'appearance', id: 'appearance_participation_a_guitar_1' }, { type: 'appearance', id: 'appearance_participation_b_guitar_1' }],
        anchorTarget: { type: 'appearance', id: 'appearance_participation_a_guitar_1' },
        reorderStrategy: 'average_position',
      } }]),
    ] });

    expect(state.links.link_direct_conflict.suppressedByConflict).toBe(true);
    expect(state.projectionWarnings.map((warning) => warning.code)).toContain('link_suppressed_by_conflict');
  });

  it('warns deterministically when a link cannot align a played target', () => {
    const state = projectJamState({ transactions: [
      ...baseJam(),
      participant(3, 'a', 'order_0'),
      participant(4, 'b', 'order_1'),
      tx(5, [{ type: 'plateau_played', payload: { plateauIndex: 1, targets: [{ type: 'appearance', id: 'appearance_participation_b_guitar_1' }], playedAt: '2026-06-17T20:00:00.000Z' } }]),
      tx(6, [{ type: 'link_created', payload: {
        linkId: 'link_pinned',
        targets: [{ type: 'appearance', id: 'appearance_participation_a_guitar_1' }, { type: 'appearance', id: 'appearance_participation_b_guitar_1' }],
        anchorTarget: { type: 'appearance', id: 'appearance_participation_a_guitar_1' },
        reorderStrategy: 'move_to_first',
      } }]),
    ] });

    expect(state.appearances.appearance_participation_b_guitar_1.playedAtPlateauIndex).toBe(2);
    expect(state.projectionWarnings.map((warning) => warning.code)).toContain('link_target_pinned');
  });

  it("preserves round/base order as A, B, C, A', B', C' without constraints", () => {
    const state = projectJamState({ transactions: [
      ...baseJam(),
      tx(3, [{ type: 'instrument_round_visibility_changed', payload: { instrumentId: 'instrument_guitar', visibleRoundCount: 2 } }]),
      participant(4, 'a', 'order_0'),
      participant(5, 'b', 'order_1'),
      participant(6, 'c', 'order_2'),
    ] });

    expect(columnIds(state)[0]).toEqual([
      'appearance_participation_a_guitar_1',
      'appearance_participation_b_guitar_1',
      'appearance_participation_c_guitar_1',
      'appearance_participation_a_guitar_2',
      'appearance_participation_b_guitar_2',
      'appearance_participation_c_guitar_2',
    ]);
  });
});
