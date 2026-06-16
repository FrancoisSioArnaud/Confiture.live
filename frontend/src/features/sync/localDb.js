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
  return transactions.sort((a, b) => (a.clientSequenceNumber ?? 0) - (b.clientSequenceNumber ?? 0));
}

export async function markTransactionPending(jamId, transactionId) {
  const now = new Date().toISOString();
  return put('pendingTransactions', transactionId, { transactionId, jamId, status: 'pending', attemptCount: 0, retryAt: now, createdAt: now, updatedAt: now });
}

export async function getPendingTransactions(jamId) {
  const pending = (await values('pendingTransactions')).filter((item) => item.jamId === jamId && item.status !== 'synced');
  return pending.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
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
    status: 'retry',
    attemptCount: (pending.attemptCount ?? 0) + 1,
    lastError: error?.message ?? String(error),
    retryAt: new Date(Date.now() + retryDelayMs).toISOString(),
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
