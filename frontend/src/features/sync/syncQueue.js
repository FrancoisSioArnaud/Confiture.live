import * as jamsApi from '../../shared/api/jamsApi';
import {
  getClientSession,
  getPendingTransactions,
  getLocalTransactions,
  getSyncState,
  markTransactionFailed,
  markTransactionPending,
  markTransactionSynced,
  saveLocalTransaction,
  saveSnapshot,
  saveSyncState,
} from './localDb';
import { setSyncStatus, SYNC_STATUS } from './syncStatus';

const timers = new Map();

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export async function enqueueTransaction({ jamId, transaction }) {
  await saveLocalTransaction(jamId, transaction);
  await markTransactionPending(jamId, transaction.transactionId);
  const pendingCount = (await getPendingTransactions(jamId)).length;
  setSyncStatus(jamId, { status: SYNC_STATUS.PENDING, pendingCount, lastError: null });
  return transaction;
}

export function scheduleSync({ jamId, api = jamsApi, delayMs = 400 } = {}) {
  clearTimeout(timers.get(jamId));
  const timer = setTimeout(() => pushPendingTransactions({ jamId, api }), delayMs);
  timers.set(jamId, timer);
  return timer;
}

export async function pushPendingTransactions({ jamId, api = jamsApi, retryDelayMs = 1000 } = {}) {
  const pending = await getPendingTransactions(jamId);
  if (pending.length === 0) {
    setSyncStatus(jamId, { status: SYNC_STATUS.SYNCED, pendingCount: 0, lastSyncedAt: new Date().toISOString() });
    return { pushed: 0 };
  }
  if (isOffline()) {
    setSyncStatus(jamId, { status: SYNC_STATUS.OFFLINE, pendingCount: pending.length, lastError: null });
    return { pushed: 0, offline: true };
  }

  setSyncStatus(jamId, { status: SYNC_STATUS.SYNCING, pendingCount: pending.length, lastError: null });
  const session = await getClientSession(jamId);
  let syncState = await getSyncState(jamId);
  let pushed = 0;

  for (const item of pending) {
    const transaction = await getTransactionRecord(jamId, item.transactionId);
    if (!transaction) continue;
    try {
      const ack = await api.pushTransaction(jamId, {
        clientId: transaction.clientId,
        leaseToken: session?.leaseToken,
        baseServerSequenceNumber: syncState.lastServerSequenceNumber ?? 0,
        transaction,
      });
      await markTransactionSynced(jamId, transaction.transactionId, ack);
      syncState = { ...syncState, lastServerSequenceNumber: ack.latestServerSequenceNumber, status: SYNC_STATUS.SYNCED };
      await saveSyncState(jamId, syncState);
      pushed += 1;
    } catch (error) {
      await markTransactionFailed(jamId, transaction.transactionId, error, retryDelayMs);
      setSyncStatus(jamId, { status: SYNC_STATUS.RETRYING, pendingCount: pending.length, lastError: error.message });
      scheduleSync({ jamId, api, delayMs: retryDelayMs });
      return { pushed, error };
    }
  }

  const remaining = await getPendingTransactions(jamId);
  setSyncStatus(jamId, { status: remaining.length ? SYNC_STATUS.PENDING : SYNC_STATUS.SYNCED, pendingCount: remaining.length, lastSyncedAt: new Date().toISOString(), lastError: null });
  return { pushed };
}

export async function hydrateFromServer({ jamId, api = jamsApi, fromServerSequenceNumber = 0 } = {}) {
  const payload = await api.getTransactions(jamId, fromServerSequenceNumber);
  await Promise.all((payload.transactions ?? []).map((transaction) => saveLocalTransaction(jamId, transaction)));
  await saveSyncState(jamId, { lastServerSequenceNumber: payload.latestServerSequenceNumber ?? fromServerSequenceNumber, status: SYNC_STATUS.SYNCED });
  return payload;
}

export async function saveLocalAndRemoteSnapshot({ jamId, clientId, leaseToken, snapshot, api = jamsApi }) {
  await saveSnapshot(jamId, snapshot);
  return api.postSnapshot(jamId, { clientId, leaseToken, snapshot });
}

async function getTransactionRecord(jamId, transactionId) {
  return (await getLocalTransactions(jamId)).find((transaction) => transaction.transactionId === transactionId);
}
