import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jamStore } from '../jam/jamStore';
import { projectJamState } from '../projection/projectJamState';
import { getClientSession, getLocalTransactions, getPendingTransactions, getSyncState, resetLocalDbForTests, saveSyncState } from './localDb';
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

  it('acquires and heartbeats a client session', async () => {
    const api = {
      acquireClientSession: vi.fn().mockResolvedValue({ status: 'acquired', clientId: 'client_1', leaseToken: 'lease_1', leaseExpiresAt: '2026-01-15T21:00:00.000Z' }),
      heartbeatClientSession: vi.fn().mockResolvedValue({ status: 'renewed', leaseExpiresAt: '2026-01-15T21:00:10.000Z' }),
    };

    await jamStore.getState().acquireSession({ jamId: 'jam_sync', clientId: 'client_1', deviceLabel: 'iPad', api });
    await jamStore.getState().heartbeatSession({ jamId: 'jam_sync', api });

    expect(api.acquireClientSession).toHaveBeenCalledWith('jam_sync', { clientId: 'client_1', deviceLabel: 'iPad', force: false });
    expect(api.heartbeatClientSession).toHaveBeenCalledWith('jam_sync', { clientId: 'client_1', leaseToken: 'lease_1' });
    expect(await getClientSession('jam_sync')).toMatchObject({ clientId: 'client_1', leaseToken: 'lease_1', leaseExpiresAt: '2026-01-15T21:00:10.000Z' });
  });

  it('uses the last server sequence number as push base', async () => {
    await saveSyncState('jam_sync', { lastServerSequenceNumber: 12, status: SYNC_STATUS.SYNCED });
    await jamStore.getState().applyLocalTransaction(transaction(1), { sync: false });
    const api = { pushTransaction: vi.fn().mockResolvedValue({ transactionId: 'transaction_1', serverSequenceNumberStart: 13, serverSequenceNumberEnd: 13, latestServerSequenceNumber: 13 }) };

    await pushPendingTransactions({ jamId: 'jam_sync', api });

    expect(api.pushTransaction).toHaveBeenCalledWith('jam_sync', expect.objectContaining({ baseServerSequenceNumber: 12 }));
  });
});
