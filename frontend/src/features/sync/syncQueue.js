import { jamsApi } from '../../shared/api/jamsApi.js';
import { db, markJamDiverged, markTransactionRetry, markTransactionSynced, mergeSyncState, SYNC_STATUS } from './localDb.js';
import { describeSyncError } from './syncErrors.js';

function latestServerSequenceFromProjection(projectedState) {
  return projectedState?.latestServerSequenceNumber ?? projectedState?.jam?.latestServerSequenceNumber ?? 0;
}

async function buildPushPayload(pending, transaction) {
  const session = await db.clientSessions.get(pending.jamId);
  const syncState = await db.syncState.get(pending.jamId);
  return {
    clientId: pending.clientId,
    leaseToken: session?.leaseToken ?? null,
    baseServerSequenceNumber: latestServerSequenceFromProjection(syncState?.projectedState),
    transaction,
  };
}

function retryStatusFor(error) {
  if (error?.status === 409) return SYNC_STATUS.DIVERGED;
  if (error?.status === 403 || error?.status === 423) return SYNC_STATUS.WARNING;
  return navigator.onLine === false || error?.status === 0 ? SYNC_STATUS.OFFLINE : SYNC_STATUS.WARNING;
}

export async function pushPendingTransaction(pending) {
  if (pending.status === SYNC_STATUS.DIVERGED) return { status: 'blocked_diverged', transactionId: pending.transactionId };
  const transaction = await db.localTransactions.get(pending.transactionId);
  if (!transaction) {
    await db.pendingTransactions.delete(pending.transactionId);
    return { status: 'missing_local_transaction' };
  }
  try {
    await db.pendingTransactions.update(pending.transactionId, { status: SYNC_STATUS.PENDING, lastAttemptAt: new Date().toISOString() });
    await jamsApi.pushTransaction(pending.jamId, await buildPushPayload(pending, transaction));
    await markTransactionSynced(pending.transactionId);
    return { status: 'synced', transactionId: pending.transactionId };
  } catch (error) {
    const message = describeSyncError(error);
    const status = retryStatusFor(error);
    if (status === SYNC_STATUS.DIVERGED) await markJamDiverged(pending.jamId, message);
    else await markTransactionRetry(pending.transactionId, status, message);
    return { status: 'retry_scheduled', transactionId: pending.transactionId, error, message };
  }
}

export async function flushPendingTransactions({ now = new Date().toISOString() } = {}) {
  const due = await db.pendingTransactions.where('nextAttemptAt').belowOrEqual(now).sortBy('clientSequenceNumber');
  const results = [];
  for (const pending of due) {
    results.push(await pushPendingTransaction(pending));
  }
  const jamIds = [...new Set(due.map((pending) => pending.jamId))];
  await Promise.all(jamIds.map(async (jamId) => {
    const remaining = await db.pendingTransactions.where('jamId').equals(jamId).count();
    if (!remaining) await mergeSyncState(jamId, { status: SYNC_STATUS.SYNCED, syncMessage: 'Synchronisé', updatedAt: new Date().toISOString() });
  }));
  return results;
}

export function createDebouncedSync(delayMs = 500) {
  let timer = null;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(() => { void flushPendingTransactions(); }, delayMs);
  };
}
