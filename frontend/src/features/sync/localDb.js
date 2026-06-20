import Dexie from 'dexie';

export const localDb = new Dexie('confiture_live_local');

localDb.version(1).stores({
  localJams: 'jamId, updatedAt',
  localTransactions: 'transactionId, jamId, clientSequenceNumber, serverSequenceNumberStart, syncedAt',
  pendingTransactions: 'transactionId, jamId, status, retryAt, attemptCount, createdAt',
  snapshots: 'snapshotId, jamId, lastServerSequenceNumber, createdAt',
  syncState: 'jamId, lastServerSequenceNumber, status, updatedAt',
});

localDb.version(2).stores({
  localJams: 'jamId, updatedAt',
  localTransactions: 'transactionId, jamId, clientSequenceNumber, serverSequenceNumberStart, syncedAt',
  pendingTransactions: 'transactionId, jamId, status, retryAt, attemptCount, createdAt',
  snapshots: 'snapshotId, jamId, lastServerSequenceNumber, createdAt',
  syncState: 'jamId, lastServerSequenceNumber, status, updatedAt',
  clientSessions: null,
});

const memory = {
  localJams: new Map(),
  localTransactions: new Map(),
  pendingTransactions: new Map(),
  snapshots: new Map(),
  syncState: new Map(),
};

function useMemory() {
  return typeof indexedDB === 'undefined';
}

function tableMap(name) {
  return memory[name];
}

async function put(table, key, value) {
  if (useMemory()) {
    tableMap(table).set(key, structuredClone(value));
    return key;
  }
  return localDb[table].put(value);
}

async function get(table, key) {
  if (useMemory()) return structuredClone(tableMap(table).get(key));
  return localDb[table].get(key);
}

async function values(table) {
  if (useMemory()) return [...tableMap(table).values()].map((value) => structuredClone(value));
  return localDb[table].toArray();
}

async function remove(table, key) {
  if (useMemory()) return tableMap(table).delete(key);
  return localDb[table].delete(key);
}

export async function saveLocalJam(jam) {
  return put('localJams', jam.jamId, { ...jam, updatedAt: jam.updatedAt ?? new Date().toISOString() });
}

export async function getLocalJam(jamId) {
  return get('localJams', jamId);
}

export async function saveLocalTransaction(jamId, transaction) {
  return put('localTransactions', transaction.transactionId, { ...transaction, jamId });
}

export async function getLocalTransactions(jamId) {
  const transactions = (await values('localTransactions')).filter((transaction) => transaction.jamId === jamId);
  return transactions.sort(compareLocalTransactions);
}

function compareLocalTransactions(a, b) {
  const aServer = a.serverSequenceNumberStart ?? Number.MAX_SAFE_INTEGER;
  const bServer = b.serverSequenceNumberStart ?? Number.MAX_SAFE_INTEGER;
  if (aServer !== bServer) return aServer - bServer;

  const client = (a.clientSequenceNumber ?? 0) - (b.clientSequenceNumber ?? 0);
  if (client !== 0) return client;

  return String(a.transactionId ?? '').localeCompare(String(b.transactionId ?? ''));
}


export async function markTransactionPending(jamId, transactionId) {
  const now = new Date().toISOString();
  return put('pendingTransactions', transactionId, { transactionId, jamId, status: 'pending', attemptCount: 0, retryAt: now, createdAt: now, updatedAt: now });
}

const RETRYABLE_TRANSACTION_STATUSES = new Set(['pending', 'retrying']);
export const DEFAULT_RETRY_BACKOFF_MS = Object.freeze({ base: 1000, max: 30000 });

export function getRetryDelayMs(attemptCount = 0, { baseDelayMs = DEFAULT_RETRY_BACKOFF_MS.base, maxDelayMs = DEFAULT_RETRY_BACKOFF_MS.max } = {}) {
  const safeAttemptCount = Math.max(0, Number.isFinite(attemptCount) ? attemptCount : 0);
  return Math.min(maxDelayMs, baseDelayMs * (2 ** safeAttemptCount));
}

function sortPendingTransactions(items) {
  return items.sort((a, b) => {
    const created = String(a.createdAt).localeCompare(String(b.createdAt));
    if (created !== 0) return created;
    return String(a.transactionId).localeCompare(String(b.transactionId));
  });
}

function isRetryDue(item, nowMs = Date.now()) {
  if (!item.retryAt) return true;
  const retryAtMs = Date.parse(item.retryAt);
  return Number.isNaN(retryAtMs) || retryAtMs <= nowMs;
}

export async function getPendingTransactions(jamId) {
  const pending = (await values('pendingTransactions')).filter((item) => item.jamId === jamId && RETRYABLE_TRANSACTION_STATUSES.has(item.status));
  return sortPendingTransactions(pending);
}

export async function getDuePendingTransactions(jamId, now = new Date()) {
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  const pending = await getPendingTransactions(jamId);
  return pending.filter((item) => isRetryDue(item, nowMs));
}

export function getNextRetryDelayMs(pendingTransactions, now = new Date()) {
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  const futureRetryTimes = pendingTransactions
    .map((item) => Date.parse(item.retryAt))
    .filter((retryAtMs) => Number.isFinite(retryAtMs) && retryAtMs > nowMs);

  if (futureRetryTimes.length === 0) return null;
  return Math.max(0, Math.min(...futureRetryTimes) - nowMs);
}

export async function getErroredTransactions(jamId) {
  const errored = (await values('pendingTransactions')).filter((item) => item.jamId === jamId && item.status === 'error');
  return errored.sort((a, b) => String(a.updatedAt ?? a.createdAt).localeCompare(String(b.updatedAt ?? b.createdAt)));
}

export async function markTransactionSynced(jamId, transactionId, ack) {
  const transaction = await get('localTransactions', transactionId);
  if (transaction) {
    await put('localTransactions', transactionId, { ...transaction, ...ack, jamId, syncedAt: new Date().toISOString() });
  }
  return remove('pendingTransactions', transactionId);
}

export async function markTransactionFailed(jamId, transactionId, error, retryDelayMs = 1000) {
  const pending = (await get('pendingTransactions', transactionId)) ?? { transactionId, jamId, attemptCount: 0, createdAt: new Date().toISOString() };
  return put('pendingTransactions', transactionId, {
    ...pending,
    jamId,
    status: 'retrying',
    attemptCount: (pending.attemptCount ?? 0) + 1,
    lastError: error?.message ?? String(error),
    retryAt: new Date(Date.now() + retryDelayMs).toISOString(),
    updatedAt: new Date().toISOString(),
  });
}


export async function markTransactionError(jamId, transactionId, error) {
  const pending = (await get('pendingTransactions', transactionId)) ?? { transactionId, jamId, attemptCount: 0, createdAt: new Date().toISOString() };
  return put('pendingTransactions', transactionId, {
    ...pending,
    jamId,
    status: 'error',
    lastError: error?.message ?? String(error),
    failedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function saveSnapshot(jamId, snapshot) {
  return put('snapshots', snapshot.snapshotId, { ...snapshot, jamId, createdAt: snapshot.createdAt ?? new Date().toISOString() });
}

export async function getLatestLocalSnapshot(jamId) {
  const snapshots = (await values('snapshots')).filter((snapshot) => snapshot.jamId === jamId);
  return snapshots.sort((a, b) => (b.lastServerSequenceNumber ?? 0) - (a.lastServerSequenceNumber ?? 0))[0] ?? null;
}

export async function saveSyncState(jamId, state) {
  return put('syncState', jamId, { jamId, ...state, updatedAt: new Date().toISOString() });
}

export async function getSyncState(jamId) {
  return (await get('syncState', jamId)) ?? { jamId, lastServerSequenceNumber: 0, status: 'local_only' };
}


export async function resetLocalDbForTests() {
  Object.values(memory).forEach((map) => map.clear());
  if (!useMemory()) await Promise.all(Object.keys(memory).map((table) => localDb[table].clear()));
}
