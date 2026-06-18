import * as jamsApi from '../../shared/api/jamsApi';
import {
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

function isSequenceConflict(error) {
  const body = error?.payload?.body;
  return error?.status === 409 && (body?.error === 'sequence_conflict' || body?.reason === 'sequence_mismatch');
}

function latestServerSequenceFromError(error) {
  return error?.payload?.body?.latestServerSequenceNumber;
}

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
  let syncState = await getSyncState(jamId);
  let pushed = 0;

  for (const item of pending) {
    const transaction = await getTransactionRecord(jamId, item.transactionId);
    if (!transaction) continue;
    try {
      const ack = await api.pushTransaction(jamId, {
        clientId: transaction.clientId,
        baseServerSequenceNumber: syncState.lastServerSequenceNumber ?? 0,
        transaction,
      });
      await markTransactionSynced(jamId, transaction.transactionId, ack);
      syncState = { ...syncState, lastServerSequenceNumber: ack.latestServerSequenceNumber, status: SYNC_STATUS.SYNCED };
      await saveSyncState(jamId, syncState);
      pushed += 1;
    } catch (error) {
      if (isSequenceConflict(error)) {
        const latestServerSequenceNumber = latestServerSequenceFromError(error);
        await saveSyncState(jamId, {
          ...syncState,
          ...(Number.isInteger(latestServerSequenceNumber) ? { lastServerSequenceNumber: latestServerSequenceNumber } : {}),
          status: SYNC_STATUS.ERROR,
          error: 'sequence_conflict',
        });
        setSyncStatus(jamId, {
          status: SYNC_STATUS.ERROR,
          pendingCount: pending.length,
          lastError: 'Le serveur possède déjà des events inconnus du client. Rechargez la jam avant de synchroniser.',
        });
        return { pushed, error, sequenceConflict: true, latestServerSequenceNumber };
      }

      await markTransactionFailed(jamId, transaction.transactionId, error, retryDelayMs);
      setSyncStatus(jamId, { status: SYNC_STATUS.RETRYING, pendingCount: pending.length, lastError: error.message });
      scheduleSync({ jamId, api, delayMs: retryDelayMs });
      return { pushed, error };
    }
  }

  const remaining = await getPendingTransactions(jamId);
  const statusPatch = { status: remaining.length ? SYNC_STATUS.PENDING : SYNC_STATUS.SYNCED, pendingCount: remaining.length, lastError: null };
  if (!remaining.length) statusPatch.lastSyncedAt = new Date().toISOString();
  setSyncStatus(jamId, statusPatch);
  return { pushed };
}

export async function hydrateFromServer({ jamId, api = jamsApi, fromServerSequenceNumber = 0 } = {}) {
  const payload = await api.getTransactions(jamId, fromServerSequenceNumber);
  const transactions = payload.transactions ?? [];
  await Promise.all(transactions.map((transaction) => saveLocalTransaction(jamId, transaction)));
  await Promise.all(transactions.map((transaction) => markTransactionSynced(jamId, transaction.transactionId, {
    serverSequenceNumberStart: transaction.serverSequenceNumberStart,
    serverSequenceNumberEnd: transaction.serverSequenceNumberEnd,
    latestServerSequenceNumber: payload.latestServerSequenceNumber ?? fromServerSequenceNumber,
  })));
  const lastServerSequenceNumber = payload.latestServerSequenceNumber ?? fromServerSequenceNumber;
  await saveSyncState(jamId, { lastServerSequenceNumber, status: SYNC_STATUS.SYNCED });
  const remaining = await getPendingTransactions(jamId);
  const statusPatch = { status: remaining.length ? SYNC_STATUS.PENDING : SYNC_STATUS.SYNCED, pendingCount: remaining.length, lastError: null };
  if (!remaining.length) statusPatch.lastSyncedAt = new Date().toISOString();
  setSyncStatus(jamId, statusPatch);
  return payload;
}

export async function saveLocalAndRemoteSnapshot({ jamId, clientId, snapshot, api = jamsApi }) {
  await saveSnapshot(jamId, snapshot);
  return api.postSnapshot(jamId, { clientId, snapshot });
}

async function getTransactionRecord(jamId, transactionId) {
  return (await getLocalTransactions(jamId)).find((transaction) => transaction.transactionId === transactionId);
}
