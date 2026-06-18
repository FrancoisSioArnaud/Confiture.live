import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

export const SYNC_STATUS = Object.freeze({
  LOCAL_ONLY: 'local_only',
  PENDING: 'pending',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  RETRYING: 'retrying',
  OFFLINE: 'offline',
  ERROR: 'error',
});

export const DEFAULT_SYNC_STATUS = Object.freeze({ status: SYNC_STATUS.LOCAL_ONLY, pendingCount: 0, lastSyncedAt: null, lastError: null });

export const syncStatusStore = createStore((set, get) => ({
  byJamId: {},
  setStatus(jamId, patch) {
    set((state) => ({
      byJamId: {
        ...state.byJamId,
        [jamId]: {
          status: SYNC_STATUS.LOCAL_ONLY,
          pendingCount: 0,
          lastSyncedAt: null,
          lastError: null,
          ...(state.byJamId[jamId] ?? {}),
          ...patch,
        },
      },
    }));
  },
  getStatus(jamId) {
    return get().byJamId[jamId] ?? DEFAULT_SYNC_STATUS;
  },
}));

export function setSyncStatus(jamId, patch) {
  syncStatusStore.getState().setStatus(jamId, patch);
}

export function getSyncStatus(jamId) {
  return syncStatusStore.getState().getStatus(jamId);
}

export function useSyncStatus(jamId) {
  return useStore(syncStatusStore, (state) => state.byJamId[jamId] ?? DEFAULT_SYNC_STATUS);
}

export function resetSyncStatusForTests() {
  syncStatusStore.setState({ byJamId: {} });
}
