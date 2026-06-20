import * as jamsApi from '../../shared/api/jamsApi';
import {
  getDuePendingTransactions,
  getErroredTransactions,
  getLocalTransactions,
  getNextRetryDelayMs,
  getPendingTransactions,
  getRetryDelayMs,
  getSyncState,
  markTransactionError,
  markTransactionFailed,
  markTransactionPending,
  markTransactionSynced,
  saveLocalTransaction,
  saveSnapshot,
  saveSyncState,
} from './localDb';
import { setSyncStatus, SYNC_STATUS } from './syncStatus';

const timers = new Map();
const ACCEPTED_ACK_STATUSES = new Set(['accepted', 'already_accepted']);

class InvalidTransactionAckError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidTransactionAckError';
    this.retryable = true;
  }
}

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function stringifyError(error) {
  return error?.message ?? String(error);
}

export function isRetryablePushError(error) {
  if (error?.retryable === true) return true;
  if (!Number.isInteger(error?.status)) return true;
  if (error.status < 400) return true;
  if (error.status === 408 || error.status === 429) return true;
  if (error.status >= 500) return true;
  return false;
}

export function validateTransactionAck(ack, transactionId) {
  if (!ACCEPTED_ACK_STATUSES.has(ack?.status)) {
    throw new InvalidTransactionAckError('Ack serveur invalide : status manquant ou inattendu.');
  }

  if (ack.transactionId !== transactionId) {
    throw new InvalidTransactionAckError('Ack serveur invalide : transactionId incohérent.');
  }

  if (!Number.isInteger(ack.latestServerSequenceNumber)) {
    throw new InvalidTransactionAckError('Ack serveur invalide : latestServerSequenceNumber manquant.');
  }

  if (!Number.isInteger(ack.serverSequenceNumberStart) || !Number.isInteger(ack.serverSequenceNumberEnd)) {
    throw new InvalidTransactionAckError('Ack serveur invalide : bornes serverSequenceNumber manquantes.');
  }

  if (ack.serverSequenceNumberStart > ack.serverSequenceNumberEnd) {
    throw new InvalidTransactionAckError('Ack serveur invalide : bornes serverSequenceNumber incohérentes.');
  }

  return ack;
}

export function isCreateJamTransaction(transaction) {
  return Boolean(transaction?.events?.some((event) => event.type === 'jam_created'));
}

function validateCreateJamResponse(response, transaction) {
  if (response?.jamId !== transaction.jamId) {
    throw new InvalidTransactionAckError('Ack serveur invalide : jamId de création incohérent.');
  }

  const transactionAck = response?.transactionAck;
  return validateTransactionAck({
    ...transactionAck,
    latestServerSequenceNumber: response.latestServerSequenceNumber ?? transactionAck?.latestServerSequenceNumber,
  }, transaction.transactionId);
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
  if (typeof timer.unref === 'function') timer.unref();
  timers.set(jamId, timer);
  return timer;
}

function scheduleNextDueRetry({ jamId, api, allPending }) {
  const nextDelayMs = getNextRetryDelayMs(allPending);
  if (Number.isFinite(nextDelayMs)) scheduleSync({ jamId, api, delayMs: nextDelayMs });
  return nextDelayMs;
}

async function pushTransactionToServer({ api, jamId, transaction, syncState }) {
  if (isCreateJamTransaction(transaction)) {
    const response = await api.createJam({ clientId: transaction.clientId, transaction });
    return validateCreateJamResponse(response, transaction);
  }

  return validateTransactionAck(await api.pushTransaction(jamId, {
    clientId: transaction.clientId,
    baseServerSequenceNumber: syncState.lastServerSequenceNumber ?? 0,
    transaction,
  }), transaction.transactionId);
}

export async function pushPendingTransactions({ jamId, api = jamsApi, retryDelayMs = 1000 } = {}) {
  const allPending = await getPendingTransactions(jamId);
  if (allPending.length === 0) {
    const errored = await getErroredTransactions(jamId);
    if (errored.length > 0) {
      setSyncStatus(jamId, { status: SYNC_STATUS.ERROR, pendingCount: 0, lastError: errored[0].lastError ?? 'Transaction en erreur' });
      return { pushed: 0, errorCount: errored.length };
    }
    setSyncStatus(jamId, { status: SYNC_STATUS.SYNCED, pendingCount: 0, lastError: null, lastSyncedAt: new Date().toISOString() });
    return { pushed: 0 };
  }
  if (isOffline()) {
    setSyncStatus(jamId, { status: SYNC_STATUS.OFFLINE, pendingCount: allPending.length, lastError: null });
    return { pushed: 0, offline: true };
  }

  const pending = await getDuePendingTransactions(jamId);
  if (pending.length === 0) {
    const nextRetryDelayMs = scheduleNextDueRetry({ jamId, api, allPending });
    setSyncStatus(jamId, { status: SYNC_STATUS.RETRYING, pendingCount: allPending.length, lastError: allPending[0]?.lastError ?? null });
    return { pushed: 0, delayed: true, nextRetryDelayMs };
  }

  setSyncStatus(jamId, { status: SYNC_STATUS.SYNCING, pendingCount: allPending.length, lastError: null });
  let syncState = await getSyncState(jamId);
  let pushed = 0;

  for (const item of pending) {
    const transaction = await getTransactionRecord(jamId, item.transactionId);
    if (!transaction) continue;
    try {
      const ack = await pushTransactionToServer({ api, jamId, transaction, syncState });
      await markTransactionSynced(jamId, transaction.transactionId, ack);
      syncState = { ...syncState, lastServerSequenceNumber: ack.latestServerSequenceNumber, status: SYNC_STATUS.SYNCED };
      await saveSyncState(jamId, syncState);
      pushed += 1;
    } catch (error) {
      const lastError = stringifyError(error);

      if (!isRetryablePushError(error)) {
        await markTransactionError(jamId, transaction.transactionId, error);
        await saveSyncState(jamId, { ...syncState, status: SYNC_STATUS.ERROR, error: lastError });
        const remaining = await getPendingTransactions(jamId);
        setSyncStatus(jamId, { status: SYNC_STATUS.ERROR, pendingCount: remaining.length, lastError });
        return { pushed, error, retryable: false };
      }

      const progressiveRetryDelayMs = getRetryDelayMs(item.attemptCount ?? 0, { baseDelayMs: retryDelayMs });
      await markTransactionFailed(jamId, transaction.transactionId, error, progressiveRetryDelayMs);
      const remaining = await getPendingTransactions(jamId);
      setSyncStatus(jamId, { status: SYNC_STATUS.RETRYING, pendingCount: remaining.length, lastError });
      scheduleSync({ jamId, api, delayMs: progressiveRetryDelayMs });
      return { pushed, error, retryable: true, retryDelayMs: progressiveRetryDelayMs };
    }
  }

  const remaining = await getPendingTransactions(jamId);
  const errored = await getErroredTransactions(jamId);
  const statusPatch = {
    status: remaining.length ? SYNC_STATUS.RETRYING : errored.length ? SYNC_STATUS.ERROR : SYNC_STATUS.SYNCED,
    pendingCount: remaining.length,
    lastError: remaining[0]?.lastError ?? errored[0]?.lastError ?? null,
  };
  if (!remaining.length && !errored.length) statusPatch.lastSyncedAt = new Date().toISOString();
  setSyncStatus(jamId, statusPatch);
  if (remaining.length) scheduleNextDueRetry({ jamId, api, allPending: remaining });
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
  const errored = await getErroredTransactions(jamId);
  const statusPatch = {
    status: remaining.length ? SYNC_STATUS.PENDING : errored.length ? SYNC_STATUS.ERROR : SYNC_STATUS.SYNCED,
    pendingCount: remaining.length,
    lastError: errored[0]?.lastError ?? null,
  };
  if (!remaining.length && !errored.length) statusPatch.lastSyncedAt = new Date().toISOString();
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
