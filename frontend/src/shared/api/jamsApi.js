import { request } from "./httpClient";

function toApiJamPayload(payload) {
  return {
    name: payload.name,
    indicative_date: payload.indicativeDate ?? payload.indicative_date ?? null,
    ...(payload.instrumentPayloads ? { instrument_payloads: payload.instrumentPayloads } : {}),
  };
}

function toStringId(value) {
  return value === null || value === undefined ? null : String(value);
}

export function toJamState(apiJam) {
  return {
    jam: {
      id: toStringId(apiJam.id),
      name: apiJam.name,
      indicativeDate: apiJam.indicative_date ?? null,
    },
    instruments: (apiJam.instruments ?? []).map((instrument) => ({
      id: toStringId(instrument.id),
      name: instrument.name,
      order: instrument.order,
      isDefault: instrument.is_default,
    })),
    participants: (apiJam.participants ?? []).map((participant) => ({
      id: toStringId(participant.id),
      jamId: toStringId(apiJam.id),
      name: participant.name,
      status: participant.status,
    })),
    entries: (apiJam.entries ?? []).map((entry) => ({
      id: toStringId(entry.id),
      jamId: toStringId(apiJam.id),
      participantId: toStringId(entry.participant),
      instrumentId: toStringId(entry.instrument),
      customInstrumentLabel: entry.custom_instrument_label ?? null,
      baseOrder: entry.base_order,
    })),
    linkGroups: (apiJam.link_groups ?? []).map((group) => ({
      id: toStringId(group.id),
      entryIds: (group.entry_ids ?? []).map(toStringId),
      holeIds: (group.hole_ids ?? []).map(toStringId),
    })),
    holes: (apiJam.holes ?? []).map((hole) => ({
      id: toStringId(hole.id),
      jamId: toStringId(apiJam.id),
      instrumentId: toStringId(hole.instrument),
      position: hole.position,
      createdByAction: hole.created_by_action,
    })),
    playedPassages: (apiJam.played_passages ?? []).map((passage) => ({
      id: toStringId(passage.id),
      jamId: toStringId(apiJam.id),
      participantEntryId: toStringId(passage.participant_entry),
      holeId: toStringId(passage.hole),
      lineIndex: passage.line_index,
      playedAt: passage.played_at,
    })),
  };
}

function createId(prefix) {
  const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomId}`;
}

function getStorageValue(storage, key, fallback) {
  try {
    const existing = storage?.getItem(key);
    if (existing) return existing;
    storage?.setItem(key, fallback);
  } catch {
    return fallback;
  }

  return fallback;
}

export function getEditingLockIdentity(jamId) {
  return {
    clientId: getStorageValue(globalThis.localStorage, "confiture.editingClientId", createId("client")),
    editingLockToken: getStorageValue(
      globalThis.sessionStorage,
      `confiture.editingLockToken.${jamId}`,
      createId("lock"),
    ),
  };
}

function normalizeLockIdentity(jamId, identity) {
  const resolvedIdentity = typeof identity === "string"
    ? { clientId: identity, editingLockToken: getEditingLockIdentity(jamId).editingLockToken }
    : identity ?? getEditingLockIdentity(jamId);

  return {
    client_id: resolvedIdentity.clientId,
    editing_lock_token: resolvedIdentity.editingLockToken,
  };
}

export function fetchJams() {
  return request("/jams/");
}

export function createJam(payload) {
  return request("/jams/", {
    method: "POST",
    body: JSON.stringify(toApiJamPayload(payload)),
  });
}

export function fetchJam(jamId) {
  return request(`/jams/${jamId}/`);
}

export function updateJam(jamId, payload) {
  return request(`/jams/${jamId}/`, {
    method: "PATCH",
    body: JSON.stringify(toApiJamPayload(payload)),
  });
}

export function deleteJam(jamId) {
  return request(`/jams/${jamId}/`, {
    method: "DELETE",
  });
}

export function postJamAction(jamId, action) {
  return request(`/jams/${jamId}/actions/`, {
    method: "POST",
    body: JSON.stringify(action),
  });
}

export function lockEditing(jamId, identity) {
  return request(`/jams/${jamId}/lock-editing/`, {
    method: "POST",
    body: JSON.stringify(normalizeLockIdentity(jamId, identity)),
  });
}

export function unlockEditing(jamId, identity) {
  return request(`/jams/${jamId}/unlock-editing/`, {
    method: "POST",
    body: JSON.stringify(normalizeLockIdentity(jamId, identity)),
  });
}
