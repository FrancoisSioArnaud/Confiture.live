import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jamStore } from '../jam/jamStore';
import { buildCreateParticipantTransaction } from '../participants/utils/buildParticipantDrawerTransaction';
import { projectJamState } from '../projection/projectJamState';
import { getLocalTransactions, getPendingTransactions, getSyncState, resetLocalDbForTests, saveSyncState } from './localDb';
import { pushPendingTransactions } from './syncQueue';
import { getSyncStatus, SYNC_STATUS } from './syncStatus';

function transaction(sequence = 1) {
  return {
    transactionId: `transaction_${sequence}`,
    jamId: 'jam_sync',
    clientId: 'client_1',
    clientSequenceNumber: sequence,
    schemaVersion: 1,
    events: [{
      eventId: `event_${sequence}`,
      transactionId: `transaction_${sequence}`,
      jamId: 'jam_sync',
      clientId: 'client_1',
      clientSequenceNumber: sequence,
      eventIndexInTransaction: 0,
      serverSequenceNumber: null,
      schemaVersion: 1,
      type: sequence === 1 ? 'jam_created' : 'jam_updated',
      payload: sequence === 1 ? { jamId: 'jam_sync', name: 'Jam sync', indicativeDate: '2026-01-15', linkReorderStrategy: 'move_to_first' } : { name: 'Jam sync updated' },
    }],
  };
}

function createJamPayload() {
  return {
    jam: { jamId: 'jam_sync', name: 'Jam sync', indicativeDate: null, latestServerSequenceNumber: 2 },
    snapshot: null,
    transactions: [{
      ...transaction(1),
      serverSequenceNumberStart: 1,
      serverSequenceNumberEnd: 2,
      events: [
        transaction(1).events[0],
        {
          eventId: 'event_instrument_guitar',
          transactionId: 'transaction_1',
          jamId: 'jam_sync',
          clientId: 'client_1',
          clientSequenceNumber: 1,
          eventIndexInTransaction: 1,
          serverSequenceNumber: 2,
          schemaVersion: 1,
          type: 'instrument_added',
          payload: { instrumentId: 'instrument_guitar', label: 'Guitare', orderKey: 'order_0', visible: true, isDefault: true },
        },
      ],
    }],
  };
}


function participantTransaction(sequence, id, baseOrderKey, serverSequenceNumberStart = null) {
  const transactionId = `transaction_participant_${id}`;
  const serverSequenceNumberEnd = serverSequenceNumberStart == null ? null : serverSequenceNumberStart + 1;
  return {
    transactionId,
    jamId: 'jam_sync',
    clientId: 'client_1',
    clientSequenceNumber: sequence,
    ...(serverSequenceNumberStart == null ? {} : { serverSequenceNumberStart, serverSequenceNumberEnd }),
    schemaVersion: 1,
    events: [{
      eventId: `event_participant_${id}`,
      transactionId,
      jamId: 'jam_sync',
      clientId: 'client_1',
      clientSequenceNumber: sequence,
      eventIndexInTransaction: 0,
      serverSequenceNumber: serverSequenceNumberStart,
      schemaVersion: 1,
      type: 'participant_created',
      payload: { participantId: `participant_${id}`, name: id.toUpperCase() },
    }, {
      eventId: `event_participation_${id}`,
      transactionId,
      jamId: 'jam_sync',
      clientId: 'client_1',
      clientSequenceNumber: sequence,
      eventIndexInTransaction: 1,
      serverSequenceNumber: serverSequenceNumberEnd,
      schemaVersion: 1,
      type: 'participation_added',
      payload: {
        participationId: `participation_${id}_guitar`,
        participantId: `participant_${id}`,
        instrumentId: 'instrument_guitar',
        customInstrumentLabel: null,
        insertionMode: 'end_of_visible_rounds',
        startAppearanceIndex: 1,
        afterTarget: null,
        beforeTarget: null,
        baseOrderKey,
      },
    }],
  };
}

function singleEventTransaction(sequence, type, payload, serverSequenceNumberStart = null) {
  const transactionId = `transaction_${type}_${sequence}`;
  return {
    transactionId,
    jamId: 'jam_sync',
    clientId: 'client_1',
    clientSequenceNumber: sequence,
    ...(serverSequenceNumberStart == null ? {} : { serverSequenceNumberStart, serverSequenceNumberEnd: serverSequenceNumberStart }),
    schemaVersion: 1,
    events: [{
      eventId: `event_${type}_${sequence}`,
      transactionId,
      jamId: 'jam_sync',
      clientId: 'client_1',
      clientSequenceNumber: sequence,
      eventIndexInTransaction: 0,
      serverSequenceNumber: serverSequenceNumberStart,
      schemaVersion: 1,
      type,
      payload,
    }],
  };
}

function buildNicoGuitarTransaction(projection) {
  const result = buildCreateParticipantTransaction({
    jamId: 'jam_sync',
    clientId: 'client_1',
    clientSequenceNumber: 2,
    projection,
    instruments: [{ instrumentId: 'instrument_guitar', label: 'Guitare', orderKey: 'order_0', visible: true }],
    draft: { name: 'Nico', selectedInstrumentIds: ['instrument_guitar'], initialLinkedInstrumentPairs: [], customInstrumentLabels: {} },
  });
  expect(result.ok).toBe(true);
  return result.transaction;
}

beforeEach(async () => {
  vi.useRealTimers();
  await resetLocalDbForTests();
  jamStore.setState({ jamId: null, transactions: [], events: [], snapshot: null, projection: projectJamState(), projectionWarnings: [], lastProjectedAt: null });
});


describe('local-first sync layer', () => {
  it('stores a local transaction as pending and rebuilds the projection immediately', async () => {
    const projection = await jamStore.getState().applyLocalTransaction(transaction(1), { sync: false });

    expect((await getLocalTransactions('jam_sync'))).toHaveLength(1);
    expect((await getPendingTransactions('jam_sync'))[0]).toMatchObject({ transactionId: 'transaction_1', status: 'pending' });
    expect(projection.jam.name).toBe('Jam sync');
    expect(jamStore.getState().projection.jam.name).toBe('Jam sync');
    expect(getSyncStatus('jam_sync')).toMatchObject({ status: SYNC_STATUS.PENDING, pendingCount: 1 });
  });

  it('pushes pending transactions successfully and records server sequence state', async () => {
    await jamStore.getState().applyLocalTransaction(transaction(1), { sync: false });
    const api = { pushTransaction: vi.fn().mockResolvedValue({ status: 'accepted', transactionId: 'transaction_1', serverSequenceNumberStart: 1, serverSequenceNumberEnd: 1, latestServerSequenceNumber: 1 }) };

    const result = await pushPendingTransactions({ jamId: 'jam_sync', api });

    expect(result.pushed).toBe(1);
    expect(api.pushTransaction).toHaveBeenCalledWith('jam_sync', expect.objectContaining({ clientId: 'client_1', baseServerSequenceNumber: 0 }));
    expect(await getPendingTransactions('jam_sync')).toEqual([]);
    expect(await getSyncState('jam_sync')).toMatchObject({ lastServerSequenceNumber: 1, status: SYNC_STATUS.SYNCED });
    expect(getSyncStatus('jam_sync')).toMatchObject({ status: SYNC_STATUS.SYNCED, pendingCount: 0 });
  });

  it('keeps a transaction pending and schedules retry after push error', async () => {
    vi.useFakeTimers();
    await jamStore.getState().applyLocalTransaction(transaction(1), { sync: false });
    const api = { pushTransaction: vi.fn().mockRejectedValue(new Error('offline')) };

    const result = await pushPendingTransactions({ jamId: 'jam_sync', api, retryDelayMs: 500 });

    expect(result.error.message).toBe('offline');
    expect((await getPendingTransactions('jam_sync'))[0]).toMatchObject({ transactionId: 'transaction_1', status: 'retry', attemptCount: 1 });
    expect(getSyncStatus('jam_sync')).toMatchObject({ status: SYNC_STATUS.RETRYING, pendingCount: 1, lastError: 'offline' });
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('keeps pending transactions and requires resync after server sequence conflict', async () => {
    vi.useFakeTimers();
    await saveSyncState('jam_sync', { lastServerSequenceNumber: 1, status: SYNC_STATUS.SYNCED });
    await jamStore.getState().applyLocalTransaction(transaction(1), { sync: false });
    const sequenceConflict = new Error('HTTP 409');
    sequenceConflict.status = 409;
    sequenceConflict.payload = {
      body: {
        error: 'sequence_conflict',
        latestServerSequenceNumber: 4,
      },
    };
    const api = { pushTransaction: vi.fn().mockRejectedValue(sequenceConflict) };

    const result = await pushPendingTransactions({ jamId: 'jam_sync', api, retryDelayMs: 500 });

    expect(result).toMatchObject({ pushed: 0, sequenceConflict: true, latestServerSequenceNumber: 4 });
    expect((await getPendingTransactions('jam_sync'))[0]).toMatchObject({ transactionId: 'transaction_1', status: 'pending', attemptCount: 0 });
    expect(await getSyncState('jam_sync')).toMatchObject({ lastServerSequenceNumber: 4, status: SYNC_STATUS.ERROR, error: 'sequence_conflict' });
    expect(getSyncStatus('jam_sync')).toMatchObject({ status: SYNC_STATUS.ERROR, pendingCount: 1 });
    await vi.advanceTimersByTimeAsync(500);
    expect(api.pushTransaction).toHaveBeenCalledTimes(1);
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('rebuilds projection from local transactions after reload', async () => {
    await jamStore.getState().applyLocalTransaction(transaction(1), { sync: false });
    await jamStore.getState().applyLocalTransaction(transaction(2), { sync: false });
    jamStore.setState({ jamId: null, transactions: [], events: [], projection: projectJamState() });

    const projection = await jamStore.getState().reloadFromLocalDb('jam_sync');

    expect(projection.jam.name).toBe('Jam sync updated');
    expect(jamStore.getState().transactions).toHaveLength(2);
  });

  it('hydrates server transactions and snapshots sync state', async () => {
    const api = { getTransactions: vi.fn().mockResolvedValue({ latestServerSequenceNumber: 3, transactions: [transaction(1)] }) };

    await jamStore.getState().hydrateFromServer('jam_sync', { api, fromServerSequenceNumber: 0 });

    expect(await getLocalTransactions('jam_sync')).toHaveLength(1);
    expect(await getSyncState('jam_sync')).toMatchObject({ lastServerSequenceNumber: 3, status: SYNC_STATUS.SYNCED });
  });

  it('persists full jam payload hydration so subsequent pushes use the server sequence base', async () => {
    await jamStore.getState().hydrateFromPayload('jam_sync', {
      jam: { jamId: 'jam_sync', name: 'Jam sync', indicativeDate: '2026-01-15', latestServerSequenceNumber: 7 },
      snapshot: null,
      transactions: [{
        ...transaction(1),
        serverSequenceNumberStart: 1,
        serverSequenceNumberEnd: 7,
      }],
    });

    expect(await getLocalTransactions('jam_sync')).toHaveLength(1);
    expect(await getSyncState('jam_sync')).toMatchObject({ lastServerSequenceNumber: 7, status: SYNC_STATUS.SYNCED });

    await jamStore.getState().applyLocalTransaction(transaction(2), { sync: false });
    const api = { pushTransaction: vi.fn().mockResolvedValue({ transactionId: 'transaction_2', serverSequenceNumberStart: 8, serverSequenceNumberEnd: 8, latestServerSequenceNumber: 8 }) };

    await pushPendingTransactions({ jamId: 'jam_sync', api });

    expect(api.pushTransaction).toHaveBeenCalledWith('jam_sync', expect.objectContaining({ baseServerSequenceNumber: 7 }));
  });


  it('hydrateFromPayload keeps local pending transactions visible when the server payload does not include them yet', async () => {
    await jamStore.getState().hydrateFromPayload('jam_sync', createJamPayload());
    await jamStore.getState().applyLocalTransaction(transaction(2), { sync: false });

    const projection = await jamStore.getState().hydrateFromPayload('jam_sync', createJamPayload());

    expect(projection.jam.name).toBe('Jam sync updated');
    expect((await getPendingTransactions('jam_sync'))[0]).toMatchObject({ transactionId: 'transaction_2', status: 'pending' });
    expect(jamStore.getState().transactions.map((item) => item.transactionId)).toContain('transaction_2');
  });

  it('hydrateFromPayload acknowledges a local pending transaction returned by the server without duplicating it', async () => {
    await jamStore.getState().hydrateFromPayload('jam_sync', createJamPayload());
    await jamStore.getState().applyLocalTransaction(transaction(2), { sync: false });
    const acknowledged = { ...transaction(2), serverSequenceNumberStart: 3, serverSequenceNumberEnd: 3 };

    await jamStore.getState().hydrateFromPayload('jam_sync', {
      ...createJamPayload(),
      jam: { ...createJamPayload().jam, latestServerSequenceNumber: 3 },
      transactions: [...createJamPayload().transactions, acknowledged],
    });

    const localTransactions = await getLocalTransactions('jam_sync');
    expect(localTransactions.filter((item) => item.transactionId === 'transaction_2')).toHaveLength(1);
    expect(localTransactions.find((item) => item.transactionId === 'transaction_2')).toMatchObject({ serverSequenceNumberStart: 3, serverSequenceNumberEnd: 3 });
    expect(await getPendingTransactions('jam_sync')).toEqual([]);
  });

  it('orders known server transactions before local pending transactions deterministically after refresh hydration', async () => {
    const serverA = { ...transaction(1), serverSequenceNumberStart: 1, serverSequenceNumberEnd: 1 };
    const serverB = { ...transaction(2), transactionId: 'transaction_2_server', serverSequenceNumberStart: 2, serverSequenceNumberEnd: 2 };
    await jamStore.getState().hydrateFromPayload('jam_sync', { jam: { jamId: 'jam_sync', name: 'Jam sync', latestServerSequenceNumber: 2 }, snapshot: null, transactions: [serverA, serverB] });
    const pendingC = { ...transaction(3), events: transaction(3).events.map((event) => ({ ...event, payload: { name: 'Jam sync pending C' } })) };
    await jamStore.getState().applyLocalTransaction(pendingC, { sync: false });

    await jamStore.getState().hydrateFromPayload('jam_sync', { jam: { jamId: 'jam_sync', name: 'Jam sync', latestServerSequenceNumber: 2 }, snapshot: null, transactions: [serverA, serverB] });

    expect(jamStore.getState().transactions.map((item) => item.transactionId)).toEqual(['transaction_1', 'transaction_2_server', 'transaction_3']);
    expect(jamStore.getState().projection.jam.name).toBe('Jam sync pending C');
  });

  it('hydrates server plus pending transactions through the projection resolver', async () => {
    const base = createJamPayload();
    const revealRound2 = singleEventTransaction(2, 'instrument_round_visibility_changed', { instrumentId: 'instrument_guitar', visibleRoundCount: 2 }, 3);
    const participantA = participantTransaction(3, 'a', 'order_0', 4);
    const participantB = participantTransaction(4, 'b', 'order_1', 6);
    const participantC = participantTransaction(5, 'c', 'order_2', 8);
    const playA2 = singleEventTransaction(6, 'plateau_played', { plateauIndex: 1, targets: [{ type: 'appearance', id: 'appearance_participation_a_guitar_2' }] }, 10);
    const pendingD = participantTransaction(7, 'd', 'order_3');

    await jamStore.getState().hydrateFromPayload('jam_sync', {
      ...base,
      jam: { ...base.jam, latestServerSequenceNumber: 10 },
      transactions: [...base.transactions, revealRound2, participantA, participantB, participantC, playA2],
    });
    await jamStore.getState().applyLocalTransaction(pendingD, { sync: false });

    const projection = await jamStore.getState().hydrateFromPayload('jam_sync', {
      ...base,
      jam: { ...base.jam, latestServerSequenceNumber: 10 },
      transactions: [...base.transactions, revealRound2, participantA, participantB, participantC, playA2],
    });

    expect(projection.columns[0].cards.map((card) => card.id)).toEqual([
      'appearance_participation_a_guitar_1',
      'appearance_participation_b_guitar_1',
      'appearance_participation_c_guitar_1',
      'appearance_participation_a_guitar_2',
      'appearance_participation_d_guitar_1',
      'appearance_participation_b_guitar_2',
      'appearance_participation_c_guitar_2',
      'appearance_participation_d_guitar_2',
    ]);
    expect((await getPendingTransactions('jam_sync'))[0]).toMatchObject({ transactionId: pendingD.transactionId, status: 'pending' });
  });

  it('applies and syncs a first participant transaction after server hydration', async () => {
    await jamStore.getState().hydrateFromPayload('jam_sync', createJamPayload());

    const participantTransaction = buildNicoGuitarTransaction(jamStore.getState().projection);
    await jamStore.getState().applyLocalTransaction(participantTransaction, { sync: false });
    expect(jamStore.getState().projection.participants[participantTransaction.events[0].payload.participantId].name).toBe('Nico');

    const api = { pushTransaction: vi.fn().mockResolvedValue({ transactionId: participantTransaction.transactionId, serverSequenceNumberStart: 3, serverSequenceNumberEnd: 4, latestServerSequenceNumber: 4 }) };
    await pushPendingTransactions({ jamId: 'jam_sync', api });

    expect(api.pushTransaction).toHaveBeenCalledWith('jam_sync', expect.objectContaining({
      clientId: 'client_1',
      baseServerSequenceNumber: 2,
      transaction: expect.objectContaining({
        events: expect.arrayContaining([
          expect.objectContaining({ type: 'participant_created' }),
          expect.objectContaining({ type: 'participation_added' }),
        ]),
      }),
    }));
    expect(await getPendingTransactions('jam_sync')).toEqual([]);
    expect(await getSyncState('jam_sync')).toMatchObject({ lastServerSequenceNumber: 4, status: SYNC_STATUS.SYNCED });
  });

  it('reloads a hydrated participant from local storage after a page refresh', async () => {
    await jamStore.getState().hydrateFromPayload('jam_sync', createJamPayload());
    const participantTransaction = {
      ...buildNicoGuitarTransaction(jamStore.getState().projection),
      serverSequenceNumberStart: 3,
      serverSequenceNumberEnd: 4,
    };
    await jamStore.getState().hydrateFromPayload('jam_sync', {
      ...createJamPayload(),
      jam: { ...createJamPayload().jam, latestServerSequenceNumber: 4 },
      transactions: [...createJamPayload().transactions, participantTransaction],
    });

    jamStore.setState({ jamId: null, transactions: [], events: [], snapshot: null, projection: projectJamState(), projectionWarnings: [], lastProjectedAt: null });
    const projection = await jamStore.getState().reloadFromLocalDb('jam_sync');

    expect(Object.values(projection.participants).map((participant) => participant.name)).toContain('Nico');
    expect(projection.columns[0].cards[0].participantId).toBe(participantTransaction.events[0].payload.participantId);
  });

});
