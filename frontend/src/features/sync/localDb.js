import Dexie from "dexie";

export const localDb = new Dexie("confitureLocalFirst");

localDb.version(1).stores({
  jams: "id, indicativeDate, updatedAt",
  jamStates: "jamId, updatedAt",
  pendingActions: "client_action_id, jamId, status, created_at, synced_at",
  syncState: "jamId, status, updatedAt",
});

function clone(value) {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function getJamId(jamStateOrJam) {
  return String(jamStateOrJam?.jam?.id ?? jamStateOrJam?.id ?? "");
}

export async function saveJamSummary(jam) {
  if (!jam?.id) return null;

  const summary = {
    id: String(jam.id),
    name: jam.name,
    indicativeDate: jam.indicativeDate ?? jam.indicative_date ?? null,
    updatedAt: new Date().toISOString(),
  };

  await localDb.jams.put(summary);
  return summary;
}

export async function saveJamState(jamState) {
  const jamId = getJamId(jamState);
  if (!jamId) return null;

  await saveJamSummary(jamState.jam);

  const record = {
    jamId,
    jamState: clone(jamState),
    updatedAt: new Date().toISOString(),
  };

  await localDb.jamStates.put(record);
  return record;
}

export async function getLocalJamState(jamId) {
  const record = await localDb.jamStates.get(String(jamId));
  return record?.jamState ? clone(record.jamState) : null;
}

export async function putPendingAction(action) {
  const record = {
    ...clone(action),
    jamId: String(action.jamId),
    status: action.status ?? "pending",
    created_at: action.created_at ?? new Date().toISOString(),
    synced_at: action.synced_at ?? null,
    last_error: action.last_error ?? null,
  };

  await localDb.pendingActions.put(record);
  return record;
}

export async function markPendingActionSynced(clientActionId) {
  const syncedAt = new Date().toISOString();
  await localDb.pendingActions.update(clientActionId, {
    status: "synced",
    synced_at: syncedAt,
    last_error: null,
  });
  return syncedAt;
}

export async function markPendingActionFailed(clientActionId, error) {
  await localDb.pendingActions.update(clientActionId, {
    status: "pending",
    last_error: error?.message ?? "Synchronisation impossible",
  });
}

export async function getPendingActions(jamId) {
  const actions = await localDb.pendingActions
    .where("jamId")
    .equals(String(jamId))
    .filter((action) => action.status !== "synced")
    .sortBy("created_at");

  return actions.map(clone);
}

export async function setSyncState(jamId, status, error = null) {
  const record = {
    jamId: String(jamId),
    status,
    error: error?.message ?? error ?? null,
    updatedAt: new Date().toISOString(),
  };

  await localDb.syncState.put(record);
  return record;
}

export async function getSyncState(jamId) {
  return localDb.syncState.get(String(jamId));
}

export const localStorageApi = {
  saveJamState,
  getLocalJamState,
  putPendingAction,
  markPendingActionSynced,
  markPendingActionFailed,
  getPendingActions,
  setSyncState,
  getSyncState,
};
