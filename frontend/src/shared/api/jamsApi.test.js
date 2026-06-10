import { beforeEach, describe, expect, it, vi } from "vitest";

import { createJam, fetchJams, lockEditing, postJamAction, toJamState, unlockEditing } from "./jamsApi";

describe("jamsApi", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it("fetchJams calls the backend jams endpoint", async () => {
    fetch.mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1, name: "Jam" }]), { status: 200 }));

    await expect(fetchJams()).resolves.toEqual([{ id: 1, name: "Jam" }]);

    expect(fetch).toHaveBeenCalledWith("/api/jams/", expect.objectContaining({ headers: expect.any(Object) }));
  });

  it("createJam sends Django field names", async () => {
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, name: "Jam" }), { status: 201 }));

    await createJam({
      name: "Jam",
      indicativeDate: "2026-06-12",
      instrumentPayloads: [{ name: "Chant", order: 0, is_default: true }],
    });

    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      name: "Jam",
      indicative_date: "2026-06-12",
      instrument_payloads: [{ name: "Chant", order: 0, is_default: true }],
    });
  });

  it("postJamAction posts a client action", async () => {
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ applied: true }), { status: 201 }));

    await postJamAction(1, { client_action_id: "a1", type: "ADD_HOLE", payload: {} });

    expect(fetch).toHaveBeenCalledWith("/api/jams/1/actions/", expect.objectContaining({ method: "POST" }));
  });

  it("sends editing lock tokens to lock and unlock endpoints", async () => {
    fetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "locked" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "unlocked" }), { status: 200 }));

    const identity = { clientId: "client-1", editingLockToken: "lock-1" };
    await lockEditing(1, identity);
    await unlockEditing(1, identity);

    expect(fetch).toHaveBeenNthCalledWith(1, "/api/jams/1/lock-editing/", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ client_id: "client-1", editing_lock_token: "lock-1" }),
    }));
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/jams/1/unlock-editing/", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ client_id: "client-1", editing_lock_token: "lock-1" }),
    }));
  });

  it("maps API jam detail to frontend jam state", () => {
    expect(toJamState({
      id: 1,
      name: "Jam",
      indicative_date: "2026-06-12",
      instruments: [{ id: 2, name: "Guitare", order: 0, is_default: true }],
      participants: [{ id: 3, name: "Nicolas", status: "active" }],
      entries: [{ id: 4, participant: 3, instrument: 2, custom_instrument_label: null, base_order: 0 }],
      holes: [{ id: 5, instrument: 2, position: 1, created_by_action: "ADD_HOLE" }],
      link_groups: [{ id: 6, entry_ids: [4], hole_ids: [5] }],
      played_passages: [{ id: 7, participant_entry: 4, hole: null, line_index: 0, played_at: "now" }],
    })).toMatchObject({
      jam: { id: "1", name: "Jam", indicativeDate: "2026-06-12" },
      instruments: [{ id: "2" }],
      entries: [{ id: "4", participantId: "3", instrumentId: "2" }],
      linkGroups: [{ id: "6", entryIds: ["4"], holeIds: ["5"] }],
    });
  });
});
