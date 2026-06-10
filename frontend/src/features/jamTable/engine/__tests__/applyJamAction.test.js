import { describe, expect, it } from "vitest";
import { actionTypes } from "../actionTypes.js";
import { applyJamAction } from "../applyJamAction.js";
import { createBasicJamState, createEntry, createHole, createParticipant } from "../fixtures.js";
import { projectJamTable } from "../projectJamTable.js";

describe("applyJamAction", () => {
  it("adds a participant with entries without mutating the original state", () => {
    const state = createBasicJamState();
    const nextState = applyJamAction(state, {
      type: actionTypes.ADD_PARTICIPANT,
      payload: {
        participant: createParticipant("participant-lea", "Léa"),
        entries: [createEntry("entry-lea-vocal", "participant-lea", "vocal", 1)],
      },
    });

    expect(state.participants).toHaveLength(4);
    expect(nextState.participants).toHaveLength(5);
    expect(projectJamTable(nextState).rows[1].cells.vocal).toMatchObject({ participantName: "Léa", isLoop: false });
  });

  it("updates participant fields", () => {
    const nextState = applyJamAction(createBasicJamState(), actionTypes.UPDATE_PARTICIPANT, {
      participantId: "participant-sarah",
      updates: { name: "Sarah M." },
    });

    expect(nextState.participants.find((participant) => participant.id === "participant-sarah").name).toBe("Sarah M.");
  });

  it("marks a participant as left", () => {
    const nextState = applyJamAction(createBasicJamState(), actionTypes.MARK_PARTICIPANT_LEFT, {
      participantId: "participant-tom",
    });

    expect(nextState.participants.find((participant) => participant.id === "participant-tom").status).toBe("left");
    expect(projectJamTable(nextState).rows.some((row) => row.cells.guitar.participantName === "Tom")).toBe(false);
  });

  it("adds a participant entry", () => {
    const nextState = applyJamAction(createBasicJamState(), actionTypes.ADD_PARTICIPANT_ENTRY, {
      entry: createEntry("entry-sarah-guitar", "participant-sarah", "guitar", 2),
    });

    expect(nextState.entries.map((entry) => entry.id)).toContain("entry-sarah-guitar");
  });

  it("moves an entry vertically inside its instrument column", () => {
    const nextState = applyJamAction(createBasicJamState(), actionTypes.MOVE_ENTRY_VERTICAL, {
      entryId: "entry-tom-guitar",
      toIndex: 0,
    });

    expect(projectJamTable(nextState).rows[0].cells.guitar).toMatchObject({ entryId: "entry-tom-guitar" });
    expect(projectJamTable(nextState).rows[1].cells.guitar).toMatchObject({ entryId: "entry-nicolas-guitar" });
  });

  it("links and unlinks items", () => {
    const linkedState = applyJamAction(createBasicJamState(), actionTypes.LINK_ITEMS, {
      linkGroupId: "link-1",
      entryIds: ["entry-sarah-vocal", "entry-nicolas-guitar"],
      holeIds: [],
    });

    expect(linkedState.linkGroups).toEqual([{ id: "link-1", entryIds: ["entry-sarah-vocal", "entry-nicolas-guitar"], holeIds: [] }]);

    const unlinkedState = applyJamAction(linkedState, actionTypes.UNLINK_ITEMS, { linkGroupId: "link-1" });

    expect(unlinkedState.linkGroups).toEqual([]);
  });

  it("adds and removes an unplayed hole", () => {
    const withHole = applyJamAction(createBasicJamState(), actionTypes.ADD_HOLE, {
      hole: createHole("hole-drums-1", "drums", 1),
    });

    expect(withHole.holes).toHaveLength(1);

    const withoutHole = applyJamAction(withHole, actionTypes.REMOVE_HOLE, { holeId: "hole-drums-1" });

    expect(withoutHole.holes).toHaveLength(0);
  });

  it("creates linked holes for wants to play without", () => {
    const nextState = applyJamAction(createBasicJamState(), actionTypes.WANTS_TO_PLAY_WITHOUT, {
      entryId: "entry-nicolas-guitar",
      instrumentIds: ["drums"],
      holeIds: { drums: "hole-drums-without" },
      linkGroupId: "link-without",
    });

    expect(nextState.holes).toContainEqual(expect.objectContaining({
      id: "hole-drums-without",
      instrumentId: "drums",
      createdByAction: actionTypes.WANTS_TO_PLAY_WITHOUT,
    }));
    expect(nextState.linkGroups).toContainEqual({
      id: "link-without",
      entryIds: ["entry-nicolas-guitar"],
      holeIds: ["hole-drums-without"],
    });
  });

  it("marks an entry played and can undo it", () => {
    const playedState = applyJamAction(createBasicJamState(), actionTypes.MARK_ENTRY_PLAYED, {
      entryId: "entry-nicolas-guitar",
      playedPassageId: "played-nicolas",
      playedAt: "2026-06-12T20:00:00.000Z",
    });

    expect(playedState.playedPassages).toContainEqual(expect.objectContaining({
      id: "played-nicolas",
      participantEntryId: "entry-nicolas-guitar",
      lineIndex: 0,
    }));
    expect(projectJamTable(playedState).stats.unplayedActiveEntriesCount).toBe(3);

    const undoneState = applyJamAction(playedState, actionTypes.UNDO_ENTRY_PLAYED, {
      entryId: "entry-nicolas-guitar",
    });

    expect(undoneState.playedPassages).toEqual([]);
    expect(projectJamTable(undoneState).stats.unplayedActiveEntriesCount).toBe(4);
  });

  it("marks a whole plateau played", () => {
    const nextState = applyJamAction(createBasicJamState(), actionTypes.MARK_PLATEAU_PLAYED, {
      lineIndex: 0,
      playedPassageIds: {
        "entry-sarah-vocal": "played-vocal",
        "entry-nicolas-guitar": "played-guitar",
        "entry-jeremy-drums": "played-drums",
      },
    });

    expect(nextState.playedPassages.map((passage) => passage.participantEntryId).sort()).toEqual([
      "entry-jeremy-drums",
      "entry-nicolas-guitar",
      "entry-sarah-vocal",
    ]);
    expect(projectJamTable(nextState).stats.playedPlateausCount).toBe(1);
  });

  it("replaces an unavailable musician without creating durable unavailable status", () => {
    const state = createBasicJamState();
    const nextState = applyJamAction(state, actionTypes.REPLACE_UNAVAILABLE, {
      unavailableEntryId: "entry-nicolas-guitar",
      replacementEntryId: "entry-tom-guitar",
    });
    const projection = projectJamTable(nextState);

    expect(nextState.participants.every((participant) => participant.status !== "unavailable")).toBe(true);
    expect(projection.rows[0].cells.guitar).toMatchObject({ entryId: "entry-tom-guitar" });
    expect(projection.rows[1].cells.guitar).toMatchObject({ entryId: "entry-nicolas-guitar" });
  });

  it("delinks entries when replacing an unavailable linked musician", () => {
    const state = applyJamAction(createBasicJamState(), actionTypes.LINK_ITEMS, {
      linkGroupId: "link-1",
      entryIds: ["entry-sarah-vocal", "entry-nicolas-guitar"],
    });

    const nextState = applyJamAction(state, actionTypes.REPLACE_UNAVAILABLE, {
      unavailableEntryId: "entry-nicolas-guitar",
      replacementEntryId: "entry-tom-guitar",
    });

    expect(nextState.linkGroups).toEqual([]);
  });
});
