import { createStore } from 'zustand/vanilla';
import { projectJamState } from '../projection/projectJamState';
import { getLatestLocalSnapshot, getLocalTransactions, getPendingTransactions, markTransactionSynced, saveLocalJam, saveLocalTransaction, saveSnapshot, saveSyncState } from '../sync/localDb';
import { enqueueTransaction, hydrateFromServer as hydrateTransactionsFromServer, pushPendingTransactions, scheduleSync } from '../sync/syncQueue';
import { setSyncStatus, SYNC_STATUS } from '../sync/syncStatus';

function flattenEvents(transactions) {
  return transactions.flatMap((transaction) => transaction.events ?? []);
}

async function rebuildFromLocal(jamId) {
  const [transactions, snapshot] = await Promise.all([getLocalTransactions(jamId), getLatestLocalSnapshot(jamId)]);
  const projection = projectJamState({ snapshot, transactions });
  return { transactions, events: flattenEvents(transactions), snapshot, projection };
}

function latestServerSequenceNumberFromPayload(payload, transactions) {
  const explicit = payload.latestServerSequenceNumber ?? payload.jam?.latestServerSequenceNumber;
  if (Number.isInteger(explicit)) return explicit;
  return Math.max(0, ...transactions.map((transaction) => transaction.serverSequenceNumberEnd ?? 0));
}

async function persistServerPayload(jamId, payload, transactions, snapshot) {
  await Promise.all([
    payload.jam ? saveLocalJam(payload.jam) : Promise.resolve(),
    ...transactions.map((transaction) => saveLocalTransaction(jamId, transaction)),
    snapshot ? saveSnapshot(jamId, snapshot) : Promise.resolve(),
  ]);
  await Promise.all(transactions.map((transaction) => markTransactionSynced(jamId, transaction.transactionId, {
    serverSequenceNumberStart: transaction.serverSequenceNumberStart,
    serverSequenceNumberEnd: transaction.serverSequenceNumberEnd,
    latestServerSequenceNumber: latestServerSequenceNumberFromPayload(payload, transactions),
  })));
  const lastServerSequenceNumber = latestServerSequenceNumberFromPayload(payload, transactions);
  await saveSyncState(jamId, {
    lastServerSequenceNumber,
    status: SYNC_STATUS.SYNCED,
  });

  const pendingCount = (await getPendingTransactions(jamId)).length;
  const statusPatch = {
    status: pendingCount ? SYNC_STATUS.PENDING : SYNC_STATUS.SYNCED,
    pendingCount,
    lastError: null,
  };
  if (!pendingCount) statusPatch.lastSyncedAt = new Date().toISOString();
  setSyncStatus(jamId, statusPatch);
}


export const jamStore = createStore((set, get) => ({
  jamId: null,
  transactions: [],
  events: [],
  snapshot: null,
  projection: projectJamState(),
  projectionWarnings: [],
  lastProjectedAt: null,

  async applyLocalTransaction(transaction, { sync = true, api } = {}) {
    const jamId = transaction.jamId;
    await enqueueTransaction({ jamId, transaction });
    const rebuilt = await rebuildFromLocal(jamId);
    set({
      jamId,
      ...rebuilt,
      projectionWarnings: rebuilt.projection.projectionWarnings,
      lastProjectedAt: new Date().toISOString(),
    });
    if (sync) scheduleSync({ jamId, api });
    return rebuilt.projection;
  },

  async reloadFromLocalDb(jamId) {
    const rebuilt = await rebuildFromLocal(jamId);
    set({ jamId, ...rebuilt, projectionWarnings: rebuilt.projection.projectionWarnings, lastProjectedAt: new Date().toISOString() });
    return rebuilt.projection;
  },

  async hydrateFromServer(jamId, { api, fromServerSequenceNumber = 0 } = {}) {
    await hydrateTransactionsFromServer({ jamId, api, fromServerSequenceNumber });
    return get().reloadFromLocalDb(jamId);
  },

  async hydrateFromPayload(jamId, payload) {
    const transactions = payload.transactions ?? [];
    const snapshot = payload.snapshot ?? null;
    await persistServerPayload(jamId, payload, transactions, snapshot);
    return get().reloadFromLocalDb(jamId);
  },

  rebuildProjection() {
    const projection = projectJamState({ snapshot: get().snapshot, transactions: get().transactions });
    set({ projection, events: flattenEvents(get().transactions), projectionWarnings: projection.projectionWarnings, lastProjectedAt: new Date().toISOString() });
    return projection;
  },

  async saveJamMetadata(jam) {
    await saveLocalJam(jam);
  },

  async saveLocalSnapshot(snapshot) {
    const jamId = get().jamId ?? snapshot.jamId;
    await saveSnapshot(jamId, snapshot);
    set({ snapshot });
  },

  async pushPending({ api } = {}) {
    const jamId = get().jamId;
    if (!jamId) return { pushed: 0 };
    const result = await pushPendingTransactions({ jamId, api });
    await get().reloadFromLocalDb(jamId);
    return result;
  },
}));
