import { actionTypes } from "./actionTypes.js";
import { projectJamTable } from "./projectJamTable.js";
import { getEntryById, getLinkGroupForEntry, getLinkGroupForHole, hasEntryBeenPlayed } from "./selectors.js";

function cloneState(jamState) {
  return {
    ...jamState,
    jam: { ...jamState.jam },
    instruments: jamState.instruments.map((instrument) => ({ ...instrument })),
    participants: jamState.participants.map((participant) => ({ ...participant })),
    entries: jamState.entries.map((entry) => ({ ...entry })),
    linkGroups: jamState.linkGroups.map((group) => ({
      ...group,
      entryIds: [...group.entryIds],
      holeIds: [...group.holeIds],
    })),
    holes: jamState.holes.map((hole) => ({ ...hole })),
    playedPassages: jamState.playedPassages.map((passage) => ({ ...passage })),
  };
}

function createId(prefix, existingItems = []) {
  return `${prefix}-${existingItems.length + 1}`;
}

function normalizeAction(actionOrType, payload) {
  if (typeof actionOrType === "string") {
    return { type: actionOrType, payload: payload ?? {} };
  }

  return { ...actionOrType, payload: actionOrType.payload ?? {} };
}

function findProjectedCellByEntryId(jamState, entryId) {
  for (const row of projectJamTable(jamState).rows) {
    const cell = Object.values(row.cells).find((candidate) => candidate.entryId === entryId && !candidate.isLoop);
    if (cell) {
      return { rowIndex: row.rowIndex, cell };
    }
  }

  return null;
}

function findProjectedPlateau(jamState, rowIndex) {
  return Object.values(projectJamTable(jamState).rows.find((row) => row.rowIndex === rowIndex)?.cells ?? {})
    .filter((cell) => cell.type !== "empty" && !cell.isLoop && !cell.isPlayed);
}

function removeItemsFromLinkGroups(linkGroups, { entryIds = [], holeIds = [] }) {
  const entryIdSet = new Set(entryIds);
  const holeIdSet = new Set(holeIds);

  return linkGroups
    .map((group) => ({
      ...group,
      entryIds: group.entryIds.filter((entryId) => !entryIdSet.has(entryId)),
      holeIds: group.holeIds.filter((holeId) => !holeIdSet.has(holeId)),
    }))
    .filter((group) => group.entryIds.length + group.holeIds.length > 1);
}

function addPlayedPassage(state, passage) {
  const duplicate = state.playedPassages.some((existingPassage) => (
    (passage.participantEntryId && existingPassage.participantEntryId === passage.participantEntryId)
    || (passage.holeId && existingPassage.holeId === passage.holeId)
  ));

  if (!duplicate) {
    state.playedPassages.push({
      id: passage.id ?? createId("played", state.playedPassages),
      jamId: state.jam.id,
      participantEntryId: passage.participantEntryId ?? null,
      holeId: passage.holeId ?? null,
      lineIndex: passage.lineIndex,
      playedAt: passage.playedAt ?? null,
    });
  }
}

function applyMoveEntryVertical(state, payload) {
  const movedEntry = getEntryById(state, payload.entryId);
  if (!movedEntry || hasEntryBeenPlayed(state, movedEntry.id)) {
    return;
  }

  const playableEntries = state.entries
    .filter((entry) => entry.instrumentId === movedEntry.instrumentId)
    .sort((left, right) => left.baseOrder - right.baseOrder || String(left.id).localeCompare(String(right.id)));
  const withoutMoved = playableEntries.filter((entry) => entry.id !== movedEntry.id);
  const targetIndex = Math.max(0, Math.min(payload.toIndex, withoutMoved.length));

  withoutMoved.splice(targetIndex, 0, movedEntry);
  withoutMoved.forEach((entry, index) => {
    entry.baseOrder = index;
  });
}

function applyLinkItems(state, payload) {
  const entryIds = [...new Set(payload.entryIds ?? [])];
  const holeIds = [...new Set(payload.holeIds ?? [])];

  state.linkGroups = removeItemsFromLinkGroups(state.linkGroups, { entryIds, holeIds });

  if (entryIds.length + holeIds.length > 1) {
    state.linkGroups.push({
      id: payload.id ?? payload.linkGroupId ?? createId("link", state.linkGroups),
      entryIds,
      holeIds,
    });
  }
}

function applyUnlinkItems(state, payload) {
  if (payload.linkGroupId) {
    state.linkGroups = state.linkGroups.filter((group) => group.id !== payload.linkGroupId);
    return;
  }

  state.linkGroups = removeItemsFromLinkGroups(state.linkGroups, {
    entryIds: payload.entryIds ?? [],
    holeIds: payload.holeIds ?? [],
  });
}

function applyWantsToPlayWithout(state, payload) {
  const sourceGroup = getLinkGroupForEntry(state, payload.entryId);
  const entryIds = sourceGroup ? [...sourceGroup.entryIds] : [payload.entryId];
  const holeIds = [];

  for (const instrumentId of payload.instrumentIds ?? []) {
    const hole = {
      id: payload.holeIds?.[instrumentId] ?? createId("hole", state.holes),
      jamId: state.jam.id,
      instrumentId,
      position: payload.position ?? state.holes.filter((candidate) => candidate.instrumentId === instrumentId).length,
      createdByAction: actionTypes.WANTS_TO_PLAY_WITHOUT,
    };
    state.holes.push(hole);
    holeIds.push(hole.id);
  }

  if (holeIds.length > 0) {
    state.linkGroups = removeItemsFromLinkGroups(state.linkGroups, { entryIds: [], holeIds });
    const remainingGroups = sourceGroup
      ? state.linkGroups.filter((group) => group.id !== sourceGroup.id)
      : state.linkGroups;

    state.linkGroups = [
      ...remainingGroups,
      {
        id: sourceGroup?.id ?? payload.linkGroupId ?? createId("link", state.linkGroups),
        entryIds,
        holeIds: [...(sourceGroup?.holeIds ?? []), ...holeIds],
      },
    ];
  }
}

function unlinkEntryAndGroupHoles(state, entryId) {
  const group = getLinkGroupForEntry(state, entryId);
  if (!group) {
    return;
  }

  state.linkGroups = state.linkGroups.filter((candidate) => candidate.id !== group.id);
}

function applyReplaceUnavailable(state, payload) {
  const unavailableEntry = getEntryById(state, payload.unavailableEntryId);
  const replacementEntry = getEntryById(state, payload.replacementEntryId);

  if (!unavailableEntry || !replacementEntry || unavailableEntry.instrumentId !== replacementEntry.instrumentId) {
    return;
  }

  unlinkEntryAndGroupHoles(state, unavailableEntry.id);
  unlinkEntryAndGroupHoles(state, replacementEntry.id);

  const orderedEntries = state.entries
    .filter((entry) => entry.instrumentId === unavailableEntry.instrumentId)
    .sort((left, right) => left.baseOrder - right.baseOrder || String(left.id).localeCompare(String(right.id)));
  const unavailableIndex = orderedEntries.findIndex((entry) => entry.id === unavailableEntry.id);
  const withoutReplacement = orderedEntries.filter((entry) => entry.id !== replacementEntry.id);
  const withoutUnavailable = withoutReplacement.filter((entry) => entry.id !== unavailableEntry.id);

  withoutUnavailable.splice(unavailableIndex, 0, replacementEntry, unavailableEntry);
  withoutUnavailable.forEach((entry, index) => {
    entry.baseOrder = index;
  });
}

export function applyJamAction(jamState, actionOrType, payload) {
  const action = normalizeAction(actionOrType, payload);
  const state = cloneState(jamState);

  switch (action.type) {
    case actionTypes.UPDATE_JAM:
      state.jam = { ...state.jam, ...action.payload.updates };
      return state;

    case actionTypes.ADD_INSTRUMENT:
      state.instruments.push(action.payload.instrument);
      return state;

    case actionTypes.REORDER_INSTRUMENTS:
      state.instruments = state.instruments.map((instrument) => {
        const nextOrder = action.payload.instrumentOrders?.[instrument.id];
        return Number.isInteger(nextOrder) ? { ...instrument, order: nextOrder } : instrument;
      });
      return state;

    case actionTypes.ADD_PARTICIPANT:
      state.participants.push(action.payload.participant);
      state.entries.push(...(action.payload.entries ?? []));
      return state;

    case actionTypes.UPDATE_PARTICIPANT:
      state.participants = state.participants.map((participant) => (
        participant.id === action.payload.participantId
          ? { ...participant, ...action.payload.updates }
          : participant
      ));
      return state;

    case actionTypes.MARK_PARTICIPANT_LEFT:
      state.participants = state.participants.map((participant) => (
        participant.id === action.payload.participantId
          ? { ...participant, status: "left" }
          : participant
      ));
      return state;

    case actionTypes.ADD_PARTICIPANT_ENTRY:
      state.entries.push(action.payload.entry);
      return state;

    case actionTypes.UPDATE_PARTICIPANT_ENTRY:
      state.entries = state.entries.map((entry) => (
        entry.id === action.payload.entryId
          ? { ...entry, ...action.payload.updates }
          : entry
      ));
      return state;

    case actionTypes.MOVE_ENTRY_VERTICAL:
      applyMoveEntryVertical(state, action.payload);
      return state;

    case actionTypes.LINK_ITEMS:
      applyLinkItems(state, action.payload);
      return state;

    case actionTypes.UNLINK_ITEMS:
      applyUnlinkItems(state, action.payload);
      return state;

    case actionTypes.ADD_HOLE:
      state.holes.push(action.payload.hole);
      return state;

    case actionTypes.REMOVE_HOLE:
      if (!state.playedPassages.some((passage) => passage.holeId === action.payload.holeId)) {
        state.holes = state.holes.filter((hole) => hole.id !== action.payload.holeId);
        state.linkGroups = removeItemsFromLinkGroups(state.linkGroups, { holeIds: [action.payload.holeId] });
      }
      return state;

    case actionTypes.WANTS_TO_PLAY_WITHOUT:
      applyWantsToPlayWithout(state, action.payload);
      return state;

    case actionTypes.MARK_ENTRY_PLAYED: {
      const projectedCell = findProjectedCellByEntryId(state, action.payload.entryId);
      addPlayedPassage(state, {
        id: action.payload.playedPassageId,
        participantEntryId: action.payload.entryId,
        lineIndex: action.payload.lineIndex ?? projectedCell?.rowIndex ?? 0,
        playedAt: action.payload.playedAt,
      });
      return state;
    }

    case actionTypes.MARK_PLATEAU_PLAYED: {
      const rowIndex = action.payload.lineIndex;
      findProjectedPlateau(state, rowIndex).forEach((cell) => {
        addPlayedPassage(state, {
          id: action.payload.playedPassageIds?.[cell.entryId ?? cell.holeId],
          participantEntryId: cell.type === "entry" ? cell.entryId : null,
          holeId: cell.type === "hole" ? cell.holeId : null,
          lineIndex: rowIndex,
          playedAt: action.payload.playedAt,
        });
      });
      return state;
    }

    case actionTypes.UNDO_ENTRY_PLAYED:
      state.playedPassages = state.playedPassages.filter((passage) => (
        passage.participantEntryId !== action.payload.entryId && passage.holeId !== action.payload.holeId
      ));
      return state;

    case actionTypes.REPLACE_UNAVAILABLE:
      applyReplaceUnavailable(state, action.payload);
      return state;

    default:
      return state;
  }
}
