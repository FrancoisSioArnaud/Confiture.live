import Dexie from 'dexie';

export const db = new Dexie('confiture-live');

db.version(2).stores({
  localJams: 'jamId, updatedAt, indicativeDate, syncStatus',
  localTransactions: 'transactionId, jamId, clientId, clientSequenceNumber, syncStatus, createdAt',
  pendingTransactions: 'transactionId, jamId, clientId, clientSequenceNumber, nextAttemptAt, attempts',
  snapshots: 'snapshotId, jamId, lastServerSequenceNumber, createdAt',
  syncState: 'jamId, status, updatedAt',
  clientSessions: 'jamId, clientId, leaseExpiresAt',
});

// Backward compatible table names from the initial scaffold.
db.version(1).stores({
  jams: 'jamId, updatedAt',
  transactions: 'transactionId, jamId, clientSequenceNumber, syncStatus',
  events: 'eventId, jamId, transactionId, serverSequenceNumber',
  snapshots: 'snapshotId, jamId, lastServerSequenceNumber',
});

export const SYNC_STATUS = Object.freeze({
  SYNCED: 'synced',
  SAVING_LOCAL: 'saving_local',
  PENDING: 'pending',
  OFFLINE: 'offline',
  WARNING: 'warning',
});

export async function mergeSyncState(jamId, patch) {
  const current = await db.syncState.get(jamId);
  await db.syncState.put({ ...(current ?? { jamId }), ...patch, jamId, updatedAt: patch.updatedAt ?? new Date().toISOString() });
}

export async function saveLocalTransaction({ jam, transaction, projectedState = null }) {
  const now = new Date().toISOString();
  await db.transaction('rw', db.localJams, db.localTransactions, db.pendingTransactions, db.syncState, async () => {
    if (jam) {
      await db.localJams.put({ ...jam, updatedAt: jam.updatedAt ?? now, syncStatus: SYNC_STATUS.SAVING_LOCAL });
    }
    await db.localTransactions.put({ ...transaction, syncStatus: SYNC_STATUS.PENDING, createdAt: transaction.createdAt ?? now });
    await db.pendingTransactions.put({ transactionId: transaction.transactionId, jamId: transaction.jamId, clientId: transaction.clientId, clientSequenceNumber: transaction.clientSequenceNumber, nextAttemptAt: now, attempts: 0 });
    await db.syncState.put({ jamId: transaction.jamId, status: SYNC_STATUS.PENDING, updatedAt: now, projectedState });
  });
}

export async function markTransactionSynced(transactionId) {
  const pending = await db.pendingTransactions.get(transactionId);
  if (!pending) return;
  await db.transaction('rw', db.localTransactions, db.pendingTransactions, db.syncState, async () => {
    await db.localTransactions.update(transactionId, { syncStatus: SYNC_STATUS.SYNCED });
    await db.pendingTransactions.delete(transactionId);
    const remaining = await db.pendingTransactions.where('jamId').equals(pending.jamId).count();
    await mergeSyncState(pending.jamId, { status: remaining ? SYNC_STATUS.PENDING : SYNC_STATUS.SYNCED, updatedAt: new Date().toISOString() });
  });
}

export async function markTransactionRetry(transactionId, status = SYNC_STATUS.OFFLINE) {
  const pending = await db.pendingTransactions.get(transactionId);
  if (!pending) return;
  const attempts = (pending.attempts ?? 0) + 1;
  const nextAttemptAt = new Date(Date.now() + Math.min(30000, attempts * 2000)).toISOString();
  await db.transaction('rw', db.pendingTransactions, db.syncState, async () => {
    await db.pendingTransactions.update(transactionId, { attempts, nextAttemptAt });
    await mergeSyncState(pending.jamId, { status, updatedAt: new Date().toISOString() });
  });
}

export async function saveSnapshot({ jamId, snapshotId, lastServerSequenceNumber, state }) {
  await db.snapshots.put({ snapshotId, jamId, lastServerSequenceNumber, state, createdAt: new Date().toISOString() });
}
