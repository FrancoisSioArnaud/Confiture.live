import { applyJamAction } from "../jamTable/engine/applyJamAction.js";
import { fetchJam, postJamAction, toJamState } from "../../shared/api/jamsApi";
import { localStorageApi } from "./localDb";

export const syncStatuses = {
  synced: "synced",
  pending: "pending",
  offline: "offline",
  error: "error",
};

export function isNetworkFailure(error) {
  return (
    error?.isNetworkError === true
    || (
      typeof navigator !== "undefined"
      && navigator.onLine === false
      && !error?.status
    )
  );
}

function warnSyncFailure(error) {
  if (import.meta.env?.DEV) {
    console.warn("[sync] action failed", {
      status: error?.status,
      isNetworkError: error?.isNetworkError,
      message: error?.message,
      data: error?.data,
    });
  }
}

function createUuidFallback() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createClientAction(type, payload) {
  const randomId = globalThis.crypto?.randomUUID?.() ?? createUuidFallback();
  return {
    client_action_id: randomId,
    type,
    payload,
    created_at: new Date().toISOString(),
  };
}

export async function queueLocalAction({ jamId, action, jamState, storage = localStorageApi }) {
  await storage.saveJamState(jamState);
  await storage.putPendingAction({
    ...action,
    jamId: String(jamId),
    status: syncStatuses.pending,
  });
  await storage.setSyncState(jamId, syncStatuses.pending);
}

async function refreshGlobalSyncState(jamId, storage) {
  const pendingActions = await storage.getPendingActions(jamId);
  const nextStatus = pendingActions.length > 0 ? syncStatuses.pending : syncStatuses.synced;
  await storage.setSyncState(jamId, nextStatus);
  return nextStatus;
}

export async function syncPendingActions({ jamId, postAction = postJamAction, storage = localStorageApi }) {
  const pendingActions = await storage.getPendingActions(jamId);
  let syncedCount = 0;

  for (const action of pendingActions) {
    try {
      const response = await postAction(jamId, {
        client_action_id: action.client_action_id,
        type: action.type,
        payload: action.payload,
        created_at: action.created_at,
      });
      if (response?.status && response.status !== "synced") {
        throw new Error(response.detail ?? "Action non synchronisée par le backend.");
      }
      await storage.markPendingActionSynced(action.client_action_id);
      syncedCount += 1;
    } catch (error) {
      warnSyncFailure(error);
      const status = isNetworkFailure(error) ? syncStatuses.offline : syncStatuses.error;
      await storage.markPendingActionFailed(action.client_action_id, error);
      await storage.setSyncState(jamId, status, error);
      return { ok: false, syncedCount, error, status };
    }
  }

  const status = await refreshGlobalSyncState(jamId, storage);
  return { ok: true, syncedCount, status };
}

export async function syncAction({ jamId, action, jamState, postAction = postJamAction, storage = localStorageApi }) {
  await queueLocalAction({ jamId, action, jamState, storage });
  return syncPendingActions({ jamId, postAction, storage });
}

function replayPendingActions(jamState, pendingActions) {
  return pendingActions.reduce(
    (state, action) => applyJamAction(state, action.type, action.payload),
    jamState,
  );
}

export async function loadJamLocalFirst({ jamId, fetcher = fetchJam, storage = localStorageApi }) {
  try {
    const apiJam = await fetcher(jamId);
    const backendState = toJamState(apiJam);
    const pendingActions = await storage.getPendingActions(jamId);
    const jamState = replayPendingActions(backendState, pendingActions);

    await storage.saveJamState(jamState);
    await storage.setSyncState(
      jamId,
      pendingActions.length > 0 ? syncStatuses.pending : syncStatuses.synced,
    );

    return {
      jamState,
      source: "backend",
      syncStatus: pendingActions.length > 0 ? syncStatuses.pending : syncStatuses.synced,
    };
  } catch (error) {
    const jamState = await storage.getLocalJamState(jamId);
    if (!jamState) throw error;

    const status = isNetworkFailure(error) ? syncStatuses.offline : syncStatuses.error;
    await storage.setSyncState(jamId, status, error);

    return {
      jamState,
      source: "local",
      syncStatus: status,
      error,
    };
  }
}

export function startSyncRetry({
  jamId,
  postAction = postJamAction,
  storage = localStorageApi,
  intervalMs = 15000,
  onStatusChange = null,
}) {
  const retry = () => syncPendingActions({ jamId, postAction, storage })
    .then((result) => {
      onStatusChange?.(result.status);
      return result;
    })
    .catch((error) => {
      warnSyncFailure(error);
      const status = isNetworkFailure(error) ? syncStatuses.offline : syncStatuses.error;
      onStatusChange?.(status);
      return { ok: false, error, status };
    });
  const intervalId = window.setInterval(retry, intervalMs);
  retry();
  return () => window.clearInterval(intervalId);
}
