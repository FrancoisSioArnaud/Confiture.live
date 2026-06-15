import { createStore } from 'zustand/vanilla';
import { projectJamState } from '../projection/projectJamState';
import { acquireLease, heartbeatLease, releaseLease, takeoverLease } from '../sync/clientSession';
import { getLatestLocalSnapshot, getLocalTransactions, saveLocalJam, saveSnapshot } from '../sync/localDb';
import { enqueueTransaction, hydrateFromServer as hydrateTransactionsFromServer, pushPendingTransactions, scheduleSync } from '../sync/syncQueue';

function flattenEvents(transactions) {
  return transactions.flatMap((transaction) => transaction.events ?? []);
}

async function rebuildFromLocal(jamId) {
  const [transactions, snapshot] = await Promise.all([getLocalTransactions(jamId), getLatestLocalSnapshot(jamId)]);
  const projection = projectJamState({ snapshot, transactions });
  return { transactions, events: flattenEvents(transactions), snapshot, projection };
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

  hydrateFromPayload(jamId, payload) {
    const transactions = payload.transactions ?? [];
    const snapshot = payload.snapshot ?? null;
    const projection = projectJamState({ snapshot, transactions, events: payload.events ?? [] });
    set({ jamId, transactions, events: flattenEvents(transactions), snapshot, projection, projectionWarnings: projection.projectionWarnings, lastProjectedAt: new Date().toISOString() });
    return projection;
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

  async acquireSession({ jamId, clientId, deviceLabel, force = false, api } = {}) {
    return acquireLease({ jamId, clientId, deviceLabel, force, api });
  },

  async heartbeatSession({ jamId = get().jamId, api } = {}) {
    return heartbeatLease({ jamId, api });
  },

  async releaseSession({ jamId = get().jamId, api } = {}) {
    return releaseLease({ jamId, api });
  },

  async takeoverSession({ jamId = get().jamId, clientId, previousClientId, deviceLabel, api } = {}) {
    return takeoverLease({ jamId, clientId, previousClientId, deviceLabel, api });
  },
}));
