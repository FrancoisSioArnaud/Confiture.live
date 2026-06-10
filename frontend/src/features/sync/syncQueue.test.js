import { describe, expect, it, vi } from "vitest";

import { actionTypes } from "../jamTable/engine/actionTypes.js";
import { createJamTableUiFixture } from "../jamTable/engine/uiFixtures.js";
import { loadJamLocalFirst, syncAction, syncPendingActions, syncStatuses } from "./syncQueue";

function createStorage(initialState = createJamTableUiFixture()) {
  const pendingActions = [];
  const syncStates = new Map();
  let localJamState = initialState;

  return {
    pendingActions,
    syncStates,
    async saveJamState(jamState) {
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
