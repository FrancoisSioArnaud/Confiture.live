import { jamsApi } from '../../shared/api/jamsApi.js';
import { db, markTransactionRetry, markTransactionSynced, SYNC_STATUS } from './localDb.js';

export async function pushPendingTransaction(pending) {
  const transaction = await db.localTransactions.get(pending.transactionId);
  if (!transaction) {
    await db.pendingTransactions.delete(pending.transactionId);
    return { status: 'missing_local_transaction' };
  }
  try {
    await jamsApi.pushTransaction(pending.jamId, { clientId: pending.clientId, transaction });
    await markTransactionSynced(pending.transactionId);
    return { status: 'synced', transactionId: pending.transactionId };
  } catch (error) {
    await markTransactionRetry(pending.transactionId, navigator.onLine === false ? SYNC_STATUS.OFFLINE : SYNC_STATUS.WARNING);
    return { status: 'retry_scheduled', transactionId: pending.transactionId, error };
  }
}

export async function flushPendingTransactions({ now = new Date().toISOString() } = {}) {
  const due = await db.pendingTransactions.where('nextAttemptAt').belowOrEqual(now).sortBy('clientSequenceNumber');
  const results = [];
  for (const pending of due) {
    results.push(await pushPendingTransaction(pending));
  }
  return results;
}

export function createDebouncedSync(delayMs = 500) {
  let timer = null;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(() => { void flushPendingTransactions(); }, delayMs);
  };
}
