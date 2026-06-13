import { create } from "zustand";

import { actionTypes } from "../engine/actionTypes.js";
import { applyJamAction } from "../engine/applyJamAction.js";
import { projectJamTable } from "../engine/projectJamTable.js";
import { createJamTableUiFixture } from "../engine/uiFixtures.js";

function createProjectedState(jamState) {
  return {
    jamState,
    projectedTable: projectJamTable(jamState),
  };
}

function createHolePayload(state, payload) {
  if (payload.hole) {
    return payload;
  }

  const instrumentHoles = state.jamState.holes.filter((hole) => hole.instrumentId === payload.instrumentId);
  const hole = {
    id: payload.id ?? `hole-${payload.instrumentId}-${state.jamState.holes.length + 1}`,
    jamId: state.jamState.jam.id,
    instrumentId: payload.instrumentId,
    position: payload.position ?? instrumentHoles.length,
    createdByAction: actionTypes.ADD_HOLE,
  };

  return { hole };
}

function applyAction(set, type, payload) {
  set((state) => {
    const jamState = applyJamAction(state.jamState, type, payload);
    return {
      ...createProjectedState(jamState),
      currentAction: type,
      syncStatus: "pending",
    };
  });
}

const initialJamState = createJamTableUiFixture();

export const useJamTableStore = create((set, get) => ({
  ...createProjectedState(initialJamState),
  linkMode: {
    active: false,
    source: null,
    selectedEntryIds: [],
    selectedHoleIds: [],
  },
  drawerOpen: null,
  currentAction: null,
  insertionSelection: null,
  syncStatus: "synced",

  loadJamState: (jamState) => set({
    ...createProjectedState(jamState),
    linkMode: {
      active: false,
      source: null,
      selectedEntryIds: [],
      selectedHoleIds: [],
    },
    drawerOpen: null,
    currentAction: null,
    insertionSelection: null,
    syncStatus: "synced",
  }),

  setSyncStatus: (syncStatus) => set({ syncStatus }),

  loadFixtureJam: () => {
    const jamState = createJamTableUiFixture();
    set({
      ...createProjectedState(jamState),
      linkMode: {
        active: false,
        source: null,
        selectedEntryIds: [],
        selectedHoleIds: [],
      },
      drawerOpen: null,
      currentAction: actionTypes.CREATE_JAM,
      insertionSelection: null,
      syncStatus: "synced",
    });
  },

  updateJam: (payload) => applyAction(set, actionTypes.UPDATE_JAM, payload),
  addInstrument: (payload) => applyAction(set, actionTypes.ADD_INSTRUMENT, payload),
  reorderInstruments: (payload) => applyAction(set, actionTypes.REORDER_INSTRUMENTS, payload),

  addParticipant: (payload) => applyAction(set, actionTypes.ADD_PARTICIPANT, payload),
  updateParticipant: (payload) => applyAction(set, actionTypes.UPDATE_PARTICIPANT, payload),
  markParticipantLeft: (participantId) => applyAction(set, actionTypes.MARK_PARTICIPANT_LEFT, { participantId }),
  addParticipantEntry: (payload) => applyAction(set, actionTypes.ADD_PARTICIPANT_ENTRY, payload),
  updateParticipantEntry: (payload) => applyAction(set, actionTypes.UPDATE_PARTICIPANT_ENTRY, payload),
  moveEntryVertical: (payload) => applyAction(set, actionTypes.MOVE_ENTRY_VERTICAL, payload),
  ensureRoundSlots: (payload) => applyAction(set, actionTypes.ENSURE_ROUND_SLOTS, payload),
  moveRoundSlotVertical: (payload) => applyAction(set, actionTypes.MOVE_ROUND_SLOT_VERTICAL, payload),
  linkItems: (payload) => applyAction(set, actionTypes.LINK_ITEMS, payload),
  unlinkItems: (payload) => applyAction(set, actionTypes.UNLINK_ITEMS, payload),
  linkRoundSlots: (payload) => applyAction(set, actionTypes.LINK_ROUND_SLOTS, payload),
  unlinkRoundSlots: (payload) => applyAction(set, actionTypes.UNLINK_ROUND_SLOTS, payload),
  addHole: (payload) => {
    applyAction(set, actionTypes.ADD_HOLE, createHolePayload(get(), payload));
  },
  removeHole: (payload) => applyAction(set, actionTypes.REMOVE_HOLE, payload),
  wantsToPlayWithout: (payload) => applyAction(set, actionTypes.WANTS_TO_PLAY_WITHOUT, payload),
  markEntryPlayed: (payload) => applyAction(set, actionTypes.MARK_ENTRY_PLAYED, payload),
  markPlateauPlayed: (payload) => applyAction(set, actionTypes.MARK_PLATEAU_PLAYED, payload),
  undoEntryPlayed: (payload) => applyAction(set, actionTypes.UNDO_ENTRY_PLAYED, payload),
  replaceUnavailable: (payload) => applyAction(set, actionTypes.REPLACE_UNAVAILABLE, payload),

  openCallDrawer: (rowIndex) => set({ drawerOpen: { type: "call", rowIndex } }),
  openParticipantDrawer: (selection) => set({ drawerOpen: { type: "participant", selection } }),
  openParticipantEditDrawer: (cell) => set({ drawerOpen: { type: "participant", participantId: cell.participantId } }),
  openWantsToPlayWithoutDrawer: (cell) => set({ drawerOpen: { type: "wantsWithout", cell } }),
  openUnavailableReplacementDrawer: (payload) => set({ drawerOpen: { type: "unavailableReplacement", ...payload } }),
  closeDrawer: () => set({ drawerOpen: null }),

  setInsertionSelection: (selection) => set({ insertionSelection: selection }),
  clearInsertionSelection: () => set({ insertionSelection: null }),

  startLinkMode: (cell) => set({
    linkMode: {
      active: true,
      source: cell,
      selectedEntryIds: cell.type === "entry" ? [cell.entryId] : [],
      selectedHoleIds: cell.type === "hole" ? [cell.holeId] : [],
    },
  }),
  toggleLinkSelection: (cell) => set((state) => {
    if (!state.linkMode.active || cell.type === "empty") {
      return {};
    }

    const key = cell.type === "entry" ? "selectedEntryIds" : "selectedHoleIds";
    const id = cell.type === "entry" ? cell.entryId : cell.holeId;
    const selectedIds = state.linkMode[key];
    const nextSelectedIds = selectedIds.includes(id)
      ? selectedIds.filter((selectedId) => selectedId !== id)
      : [...selectedIds, id];

    return {
      linkMode: {
        ...state.linkMode,
        [key]: nextSelectedIds,
      },
    };
  }),
  cancelLinkMode: () => set({
    linkMode: {
      active: false,
      source: null,
      selectedEntryIds: [],
      selectedHoleIds: [],
    },
  }),
  validateLinkMode: () => {
    const { linkMode, linkItems, unlinkItems, cancelLinkMode } = get();
    const selectedCount = linkMode.selectedEntryIds.length + linkMode.selectedHoleIds.length;

    if (selectedCount > 1) {
      linkItems({
        entryIds: linkMode.selectedEntryIds,
        holeIds: linkMode.selectedHoleIds,
      });
    } else if (linkMode.source?.linkGroupId) {
      unlinkItems({ linkGroupId: linkMode.source.linkGroupId });
    }

    cancelLinkMode();
  },
}));
