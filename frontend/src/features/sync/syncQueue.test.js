import { afterEach, describe, expect, it, vi } from "vitest";

import { actionTypes } from "../jamTable/engine/actionTypes.js";
import { createJamTableUiFixture } from "../jamTable/engine/uiFixtures.js";
import { loadJamLocalFirst, startSyncRetry, syncAction, syncPendingActions, syncStatuses } from "./syncQueue";

function createStorage(initialState = createJamTableUiFixture()) {
  const pendingActions = [];
  const syncStates = new Map();
  const saveJamStateCalls = [];
  let localJamState = initialState;

  return {
    pendingActions,
    syncStates,
    saveJamStateCalls,
    async saveJamState(jamState) {
      saveJamStateCalls.push(jamState);
      localJamState = jamState;
    },
    async getLocalJamState() {
      return localJamState;
    },
    async putPendingAction(action) {
      pendingActions.push({ ...action });
    },
    async markPendingActionSynced(clientActionId) {
      const action = pendingActions.find((item) => item.client_action_id === clientActionId);
      action.status = syncStatuses.synced;
      action.synced_at = "2026-06-10T00:00:00.000Z";
    },
    async markPendingActionFailed(clientActionId, error) {
      const action = pendingActions.find((item) => item.client_action_id === clientActionId);
      action.status = syncStatuses.pending;
      action.last_error = error.message;
    },
    async getPendingActions() {
      return pendingActions.filter((action) => action.status !== syncStatuses.synced);
    },
    async setSyncState(jamId, status, error = null) {
      syncStates.set(String(jamId), { status, error: error?.message ?? null });
    },
    async getSyncState(jamId) {
      return syncStates.get(String(jamId));
    },
  };
}

function createAction(overrides = {}) {
  return {
    client_action_id: overrides.client_action_id ?? "action-1",
    type: overrides.type ?? actionTypes.MARK_ENTRY_PLAYED,
    payload: overrides.payload ?? { entryId: "entry-drums-1" },
    created_at: "2026-06-10T00:00:00.000Z",
  };
}

describe("syncQueue", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it("adds user actions to the pending queue before syncing", async () => {
    const storage = createStorage();
    const postAction = vi.fn(async () => { throw new Error("network down"); });

    await syncAction({
      jamId: "jam-1",
      action: createAction(),
      jamState: createJamTableUiFixture(),
      postAction,
      storage,
    });

    expect(storage.pendingActions).toHaveLength(1);
    expect(storage.pendingActions[0]).toMatchObject({ client_action_id: "action-1", status: syncStatuses.pending });
  });

  it("marks an action as synced after backend success", async () => {
    const storage = createStorage();
    const postAction = vi.fn(async () => ({ applied: true }));

    const result = await syncAction({
      jamId: "jam-1",
      action: createAction(),
      jamState: createJamTableUiFixture(),
      postAction,
      storage,
    });

    expect(result.ok).toBe(true);
    expect(storage.pendingActions[0].status).toBe(syncStatuses.synced);
    expect(storage.syncStates.get("jam-1").status).toBe(syncStatuses.synced);
  });


  it("saves and returns the authoritative jam after action sync", async () => {
    const storage = createStorage();
    const apiJam = {
      id: 42,
      name: "Jam backend",
      indicative_date: "2026-06-12",
      instruments: [{ id: 7, name: "Guitare", order: 0, is_default: true }],
      participants: [{ id: 99, name: "Sarah", status: "active" }],
      entries: [{ id: 123, participant: 99, instrument: 7, custom_instrument_label: null, base_order: 0 }],
      holes: [],
      link_groups: [],
      played_passages: [],
    };
    const postAction = vi.fn(async () => ({ status: "synced", applied: true, jam: apiJam }));

    const result = await syncAction({
      jamId: "jam-1",
      action: createAction(),
      jamState: createJamTableUiFixture(),
      postAction,
      storage,
    });

    expect(result.ok).toBe(true);
    expect(result.jamState).toBeTruthy();
    expect(result.jamState.jam.id).toBe("42");
    expect(result.jamState.participants[0].id).toBe("99");
    expect(result.jamState.entries[0].id).toBe("123");
    expect(storage.saveJamStateCalls.at(-1)).toEqual(result.jamState);
  });

  it("keeps an action pending after backend failure", async () => {
    const storage = createStorage();
    const postAction = vi.fn(async () => { throw new Error("500"); });

    const result = await syncAction({
      jamId: "jam-1",
      action: createAction(),
      jamState: createJamTableUiFixture(),
      postAction,
      storage,
    });

    expect(result.ok).toBe(false);
    expect(storage.pendingActions[0].status).toBe(syncStatuses.pending);
    expect(storage.syncStates.get("jam-1").status).toBe(syncStatuses.error);
  });


  it("classifies backend HTTP errors as sync errors, not offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const storage = createStorage();
    const error = new Error("Participation introuvable pour cette jam.");
    error.status = 400;
    error.isNetworkError = false;
    const postAction = vi.fn(async () => { throw error; });

    const result = await syncAction({
      jamId: "jam-1",
      action: createAction(),
      jamState: createJamTableUiFixture(),
      postAction,
      storage,
    });

    expect(result.status).toBe(syncStatuses.error);
    expect(storage.syncStates.get("jam-1").status).toBe(syncStatuses.error);
  });

  it("classifies real network failures as offline", async () => {
    const storage = createStorage();
    const error = new TypeError("Failed to fetch");
    error.isNetworkError = true;
    const postAction = vi.fn(async () => { throw error; });

    const result = await syncAction({
      jamId: "jam-1",
      action: createAction(),
      jamState: createJamTableUiFixture(),
      postAction,
      storage,
    });

    expect(result.status).toBe(syncStatuses.offline);
    expect(storage.syncStates.get("jam-1").status).toBe(syncStatuses.offline);
  });

  it("keeps an action pending when backend records a failed action", async () => {
    const storage = createStorage();
    const postAction = vi.fn(async () => ({ status: "failed", detail: "Action refusée" }));

    const result = await syncAction({
      jamId: "jam-1",
      action: createAction(),
      jamState: createJamTableUiFixture(),
      postAction,
      storage,
    });

    expect(result.ok).toBe(false);
    expect(storage.pendingActions[0].status).toBe(syncStatuses.pending);
    expect(storage.syncStates.get("jam-1").status).toBe(syncStatuses.error);
  });

  it("restores the local jam state when backend loading fails", async () => {
    const localJamState = createJamTableUiFixture();
    const storage = createStorage(localJamState);
    const fetcher = vi.fn(async () => { throw new Error("offline"); });

    const result = await loadJamLocalFirst({ jamId: localJamState.jam.id, fetcher, storage });

    expect(result.source).toBe("local");
    expect(result.jamState.jam.id).toBe(localJamState.jam.id);
    expect(storage.syncStates.get(localJamState.jam.id).status).toBe(syncStatuses.error);
  });


  it("notifies retry callers when an authoritative jam is received", async () => {
    const storage = createStorage();
    storage.pendingActions.push({ ...createAction(), jamId: "jam-1", status: syncStatuses.pending });
    const apiJam = {
      id: 42,
      name: "Jam backend",
      indicative_date: null,
      instruments: [],
      participants: [{ id: 99, name: "Sarah", status: "active" }],
      entries: [],
      holes: [],
      link_groups: [],
      played_passages: [],
    };
    const postAction = vi.fn(async () => ({ status: "synced", applied: true, jam: apiJam }));
    const onStatusChange = vi.fn();
    const onJamStateChange = vi.fn();

    const stopRetry = startSyncRetry({
      jamId: "jam-1",
      postAction,
      storage,
      intervalMs: 60000,
      onStatusChange,
      onJamStateChange,
    });

    await vi.waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith(syncStatuses.synced);
      expect(onJamStateChange).toHaveBeenCalledWith(expect.objectContaining({
        jam: expect.objectContaining({ id: "42" }),
        participants: [expect.objectContaining({ id: "99" })],
      }));
    });

    stopRetry();
  });

  it("retries pending actions and recalculates the global sync state", async () => {
    const storage = createStorage();
    storage.pendingActions.push({ ...createAction(), jamId: "jam-1", status: syncStatuses.pending });
    const postAction = vi.fn(async () => ({ applied: true }));

    const result = await syncPendingActions({ jamId: "jam-1", postAction, storage });

    expect(result.ok).toBe(true);
    expect(storage.pendingActions[0].status).toBe(syncStatuses.synced);
    expect(storage.syncStates.get("jam-1").status).toBe(syncStatuses.synced);
  });
});
