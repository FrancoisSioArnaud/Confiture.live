import { beforeEach, describe, expect, it } from 'vitest';
import { jamStore } from './jamStore';
import { projectJamState } from '../projection/projectJamState';
import { resetLocalDbForTests } from '../sync/localDb';
import { buildLinearUndoTransaction } from '../transactions/buildUndoTransaction';

const jamId = 'jam_pipeline';
const clientId = 'client_pipeline';

function tx(sequence, events, transactionId = `transaction_${sequence}`) {
  return {
    transactionId,
    jamId,
    clientId,
    clientSequenceNumber: sequence,
    schemaVersion: 1,
    source: 'organizer_ui',
    label: transactionId,
    events: events.map((event, eventIndexInTransaction) => ({
      eventId: `event_${transactionId}_${eventIndexInTransaction}`,
      transactionId,
      jamId,
      clientId,
      clientSequenceNumber: sequence,
      eventIndexInTransaction,
      serverSequenceNumber: null,
      schemaVersion: 1,
      ...event,
    })),
  };
}

function participantTx(sequence, instrumentId, id, baseOrderKey) {
  return tx(sequence, [
    { type: 'participant_created', payload: { participantId: `participant_${id}`, name: id.toUpperCase() } },
    { type: 'participation_added', payload: {
      participationId: `participation_${id}_${instrumentId}`,
      participantId: `participant_${id}`,
      instrumentId,
      customInstrumentLabel: null,
      insertionMode: 'end_of_visible_rounds',
      startAppearanceIndex: 1,
      afterTarget: null,
      beforeTarget: null,
      baseOrderKey,
    } },
  ], `transaction_participant_${id}_${instrumentId}`);
}

function updateParticipantTx(sequence, id, name) {
  return tx(sequence, [{ type: 'participant_updated', payload: { participantId: `participant_${id}`, name } }], `transaction_update_${id}`);
}

function revealRoundTx(sequence, instrumentId, visibleRoundCount = 2) {
  return tx(sequence, [{ type: 'instrument_round_visibility_changed', payload: { instrumentId, visibleRoundCount } }], `transaction_reveal_${instrumentId}_${visibleRoundCount}`);
}

function moveAppearanceTx(sequence, appearanceId, instrumentId, afterTarget, beforeTarget) {
  return tx(sequence, [{ type: 'appearance_moved_between', payload: { appearanceId, instrumentId, afterTarget, beforeTarget, movedLinkedGroup: false } }], `transaction_move_${sequence}`);
}

function linkTx(sequence, linkId, targets, anchorTarget, reorderStrategy = 'move_to_first') {
  return tx(sequence, [{ type: 'link_created', payload: { linkId, targets, anchorTarget, reorderStrategy } }], `transaction_${linkId}`);
}

function removeLinkTx(sequence, linkId) {
  return tx(sequence, [{ type: 'link_removed', payload: { linkId } }], `transaction_remove_${linkId}`);
}

function conflictTx(sequence, conflictId, targetIds) {
  return tx(sequence, [{ type: 'conflict_created', payload: { conflictId, scope: 'appearance', targetIds: [...targetIds].sort(), reason: 'manual' } }], `transaction_${conflictId}`);
}

function removeConflictTx(sequence, conflictId) {
  return tx(sequence, [{ type: 'conflict_removed', payload: { conflictId } }], `transaction_remove_${conflictId}`);
}

function playTx(sequence, targets) {
  return tx(sequence, [{ type: 'plateau_played', payload: { plateauIndex: sequence, targets, playedAt: '2026-06-17T20:00:00.000Z' } }], `transaction_play_${sequence}`);
}

function lockTx(sequence, appearanceId) {
  return tx(sequence, [{ type: 'appearance_locked', payload: { appearanceId } }], `transaction_lock_${appearanceId}`);
}

function unlockTx(sequence, appearanceId) {
  return tx(sequence, [{ type: 'appearance_unlocked', payload: { appearanceId } }], `transaction_unlock_${appearanceId}`);
}

function skipWithHoleTx(sequence, appearanceId, instrumentId, holeId, afterTarget = null, beforeTarget = null) {
  return tx(sequence, [
    { type: 'hole_added', payload: { holeId, instrumentId, appearanceIndex: 1, reason: 'call_drawer_without_musician', afterTarget, beforeTarget, positionKey: `position_${holeId}` } },
    { type: 'appearance_skipped', payload: { appearanceId, instrumentId, originalPlateauIndex: 0, replacement: { mode: 'hole', holeId }, createdHoleId: holeId, removedLinkIds: [], confirmedDelink: true } },
    { type: 'appearance_moved_between', payload: { appearanceId, instrumentId, afterTarget: { type: 'hole', id: holeId }, beforeTarget: null, movedLinkedGroup: false } },
  ], `transaction_skip_${appearanceId}`);
}

function markLeftTx(sequence, id) {
  return tx(sequence, [{ type: 'participant_marked_left', payload: { participantId: `participant_${id}`, confirmedDespiteFutureLockedAppearances: true } }], `transaction_left_${id}`);
}

function removeParticipantTx(sequence, id) {
  return tx(sequence, [{ type: 'participant_removed', payload: { participantId: `participant_${id}` } }], `transaction_remove_participant_${id}`);
}

async function applyPipeline(transactions) {
  for (const transaction of transactions) {
    await jamStore.getState().applyLocalTransaction(transaction, { sync: false });
  }
  return jamStore.getState().projection;
}

async function expectStableAfterReload() {
  const beforeReload = structuredClone(jamStore.getState().projection);
  await jamStore.getState().reloadFromLocalDb(jamId);
  const afterReload = jamStore.getState().projection;
  expect(afterReload.columns).toEqual(beforeReload.columns);
  return afterReload;
}

function getColumn(projection, instrumentId) {
  return projection.columns.find((column) => column.instrument.instrumentId === instrumentId);
}

function getColumnCardIds(projection, instrumentId) {
  return getColumn(projection, instrumentId)?.cards.map((card) => card.id) ?? [];
}

function getCardPlateauIndex(projection, instrumentId, cardId) {
  const column = getColumn(projection, instrumentId);
  return column.cards.findIndex((card) => card.id === cardId);
}

function baseJamTx() {
  return tx(1, [
    { type: 'jam_created', payload: { jamId, name: 'Pipeline Jam', indicativeDate: '2026-06-17', linkReorderStrategy: 'move_to_first' } },
    { type: 'instrument_added', payload: { instrumentId: 'instrument_vocal', label: 'Chant', orderKey: 'order_0', visible: true, isDefault: true } },
    { type: 'instrument_added', payload: { instrumentId: 'instrument_guitar', label: 'Guitare', orderKey: 'order_1', visible: true, isDefault: true } },
  ], 'transaction_base_jam');
}

beforeEach(async () => {
  await resetLocalDbForTests();
  jamStore.setState({ jamId: null, transactions: [], events: [], snapshot: null, projection: projectJamState(), projectionWarnings: [], lastProjectedAt: null });
});

describe('jam local-first UX transaction pipeline', () => {
  it('keeps a created link aligned before and after refresh', async () => {
    const projection = await applyPipeline([
      baseJamTx(),
      participantTx(2, 'instrument_vocal', 'a', 'order_0'),
      participantTx(3, 'instrument_vocal', 'c', 'order_1'),
      participantTx(4, 'instrument_vocal', 'b', 'order_2'),
      participantTx(5, 'instrument_guitar', 'x', 'order_0'),
      participantTx(6, 'instrument_guitar', 'y', 'order_1'),
      participantTx(7, 'instrument_guitar', 'z', 'order_2'),
      linkTx(8, 'link_b_z', [
        { type: 'appearance', id: 'appearance_participation_b_instrument_vocal_1' },
        { type: 'appearance', id: 'appearance_participation_z_instrument_guitar_1' },
      ], { type: 'appearance', id: 'appearance_participation_b_instrument_vocal_1' }, 'move_to_last'),
    ]);

    expect(getCardPlateauIndex(projection, 'instrument_vocal', 'appearance_participation_b_instrument_vocal_1'))
      .toBe(getCardPlateauIndex(projection, 'instrument_guitar', 'appearance_participation_z_instrument_guitar_1'));
    const reloaded = await expectStableAfterReload();
    expect(getCardPlateauIndex(reloaded, 'instrument_vocal', 'appearance_participation_b_instrument_vocal_1'))
      .toBe(getCardPlateauIndex(reloaded, 'instrument_guitar', 'appearance_participation_z_instrument_guitar_1'));
  });

  it('keeps a linked card following a dragged anchor before and after refresh', async () => {
    const projection = await applyPipeline([
      baseJamTx(),
      participantTx(2, 'instrument_vocal', 'a', 'order_0'),
      participantTx(3, 'instrument_vocal', 'b', 'order_1'),
      participantTx(4, 'instrument_vocal', 'c', 'order_2'),
      linkTx(5, 'link_a_c', [
        { type: 'appearance', id: 'appearance_participation_a_instrument_vocal_1' },
        { type: 'appearance', id: 'appearance_participation_c_instrument_vocal_1' },
      ], { type: 'appearance', id: 'appearance_participation_a_instrument_vocal_1' }, 'move_to_last'),
      moveAppearanceTx(6, 'appearance_participation_a_instrument_vocal_1', 'instrument_vocal', { type: 'appearance', id: 'appearance_participation_b_instrument_vocal_1' }, null),
    ]);

    expect(getCardPlateauIndex(projection, 'instrument_vocal', 'appearance_participation_c_instrument_vocal_1'))
      .toBe(getCardPlateauIndex(projection, 'instrument_vocal', 'appearance_participation_a_instrument_vocal_1') + 1);
    const reloaded = await expectStableAfterReload();
    expect(getCardPlateauIndex(reloaded, 'instrument_vocal', 'appearance_participation_c_instrument_vocal_1'))
      .toBe(getCardPlateauIndex(reloaded, 'instrument_vocal', 'appearance_participation_a_instrument_vocal_1') + 1);
  });

  it("keeps played A' pinned when D is added before and after refresh", async () => {
    const projection = await applyPipeline([
      baseJamTx(),
      revealRoundTx(2, 'instrument_vocal', 2),
      participantTx(3, 'instrument_vocal', 'a', 'order_0'),
      participantTx(4, 'instrument_vocal', 'b', 'order_1'),
      participantTx(5, 'instrument_vocal', 'c', 'order_2'),
      playTx(6, [
        { type: 'appearance', id: 'appearance_participation_a_instrument_vocal_1' },
        { type: 'appearance', id: 'appearance_participation_b_instrument_vocal_1' },
        { type: 'appearance', id: 'appearance_participation_c_instrument_vocal_1' },
        { type: 'appearance', id: 'appearance_participation_a_instrument_vocal_2' },
      ]),
      participantTx(7, 'instrument_vocal', 'd', 'order_3'),
    ]);

    expect(getColumnCardIds(projection, 'instrument_vocal')).toEqual([
      'appearance_participation_a_instrument_vocal_1',
      'appearance_participation_b_instrument_vocal_1',
      'appearance_participation_c_instrument_vocal_1',
      'appearance_participation_d_instrument_vocal_1',
      'appearance_participation_a_instrument_vocal_2',
      'appearance_participation_c_instrument_vocal_2',
      'appearance_participation_b_instrument_vocal_2',
      'appearance_participation_d_instrument_vocal_2',
    ]);
    await expectStableAfterReload();
  });

  it('keeps conflict drag result deterministic before and after refresh', async () => {
    const projection = await applyPipeline([
      baseJamTx(),
      participantTx(2, 'instrument_vocal', 'a', 'order_0'),
      participantTx(3, 'instrument_vocal', 'b', 'order_1'),
      participantTx(4, 'instrument_vocal', 'c', 'order_2'),
      conflictTx(5, 'conflict_a_b', ['appearance_participation_a_instrument_vocal_1', 'appearance_participation_b_instrument_vocal_1'], 'appearance_participation_a_instrument_vocal_1'),
      moveAppearanceTx(6, 'appearance_participation_a_instrument_vocal_1', 'instrument_vocal', null, { type: 'appearance', id: 'appearance_participation_b_instrument_vocal_1' }),
    ]);

    expect(getColumnCardIds(projection, 'instrument_vocal')[0]).toBe('appearance_participation_b_instrument_vocal_1');
    expect(getCardPlateauIndex(projection, 'instrument_vocal', 'appearance_participation_a_instrument_vocal_1')).toBe(1);
    await expectStableAfterReload();
  });

  it("keeps locked A' pinned when D is added before and after refresh", async () => {
    const projection = await applyPipeline([
      baseJamTx(),
      revealRoundTx(2, 'instrument_vocal', 2),
      participantTx(3, 'instrument_vocal', 'a', 'order_0'),
      participantTx(4, 'instrument_vocal', 'b', 'order_1'),
      participantTx(5, 'instrument_vocal', 'c', 'order_2'),
      lockTx(6, 'appearance_participation_a_instrument_vocal_2'),
      participantTx(7, 'instrument_vocal', 'd', 'order_3'),
    ]);

    expect(getCardPlateauIndex(projection, 'instrument_vocal', 'appearance_participation_a_instrument_vocal_2')).toBe(4);
    expect(getCardPlateauIndex(projection, 'instrument_vocal', 'appearance_participation_d_instrument_vocal_1')).toBe(3);
    await expectStableAfterReload();
  });

  it('keeps play-without hole aligned before and after refresh', async () => {
    const projection = await applyPipeline([
      baseJamTx(),
      participantTx(2, 'instrument_vocal', 'a', 'order_0'),
      participantTx(3, 'instrument_guitar', 'x', 'order_0'),
      skipWithHoleTx(4, 'appearance_participation_x_instrument_guitar_1', 'instrument_guitar', 'hole_without_guitar', null, { type: 'appearance', id: 'appearance_participation_x_instrument_guitar_1' }),
      linkTx(5, 'link_a_hole', [
        { type: 'appearance', id: 'appearance_participation_a_instrument_vocal_1' },
        { type: 'hole', id: 'hole_without_guitar' },
      ], { type: 'appearance', id: 'appearance_participation_a_instrument_vocal_1' }, 'move_to_first'),
    ]);

    expect(getCardPlateauIndex(projection, 'instrument_vocal', 'appearance_participation_a_instrument_vocal_1'))
      .toBe(getCardPlateauIndex(projection, 'instrument_guitar', 'hole_without_guitar'));
    await expectStableAfterReload();
  });

  it('keeps undo of a link deterministic before and after refresh', async () => {
    await applyPipeline([
      baseJamTx(),
      participantTx(2, 'instrument_vocal', 'a', 'order_0'),
      participantTx(3, 'instrument_vocal', 'b', 'order_1'),
      linkTx(4, 'link_a_b', [
        { type: 'appearance', id: 'appearance_participation_a_instrument_vocal_1' },
        { type: 'appearance', id: 'appearance_participation_b_instrument_vocal_1' },
      ], { type: 'appearance', id: 'appearance_participation_a_instrument_vocal_1' }, 'average_position'),
    ]);
    const undo = buildLinearUndoTransaction({ jamId, clientId, clientSequenceNumber: 5, transactions: jamStore.getState().transactions });
    await jamStore.getState().applyLocalTransaction({ ...undo, transactionId: 'transaction_undo_link' }, { sync: false });

    const projection = jamStore.getState().projection;
    expect(projection.links.link_a_b?.status).not.toBe('active');
    const reloaded = await expectStableAfterReload();
    expect(reloaded.links.link_a_b?.status).not.toBe('active');
  });

  it('covers update, unlock, link removal, conflict removal, left and removed participants in a refresh-stable pipeline', async () => {
    const projection = await applyPipeline([
      baseJamTx(),
      participantTx(2, 'instrument_vocal', 'a', 'order_0'),
      participantTx(3, 'instrument_vocal', 'b', 'order_1'),
      participantTx(4, 'instrument_vocal', 'unused', 'order_2'),
      updateParticipantTx(5, 'a', 'Alice'),
      lockTx(6, 'appearance_participation_b_instrument_vocal_1'),
      unlockTx(7, 'appearance_participation_b_instrument_vocal_1'),
      linkTx(8, 'link_remove_me', [
        { type: 'appearance', id: 'appearance_participation_a_instrument_vocal_1' },
        { type: 'appearance', id: 'appearance_participation_b_instrument_vocal_1' },
      ], { type: 'appearance', id: 'appearance_participation_a_instrument_vocal_1' }, 'average_position'),
      removeLinkTx(9, 'link_remove_me'),
      conflictTx(10, 'conflict_remove_me', ['appearance_participation_a_instrument_vocal_1', 'appearance_participation_b_instrument_vocal_1'], 'appearance_participation_a_instrument_vocal_1'),
      removeConflictTx(11, 'conflict_remove_me'),
      markLeftTx(12, 'b'),
      removeParticipantTx(13, 'unused'),
    ]);

    expect(projection.participants.participant_a.name).toBe('Alice');
    expect(projection.links.link_remove_me.status).toBe('removed');
    expect(projection.conflicts.conflict_remove_me.status).toBe('removed');
    expect(projection.participants.participant_b.status).toBe('left');
    expect(projection.participants.participant_unused.status).toBe('removed');
    await expectStableAfterReload();
  });
});
