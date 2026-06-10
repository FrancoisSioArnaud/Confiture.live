import { describe, expect, it } from "vitest";
import { actionTypes } from "../actionTypes.js";
import { createBasicJamState, createEmptyJamState, createEntry, createHole, createParticipant, createPlayedPassage } from "../fixtures.js";
import { projectJamTable } from "../projectJamTable.js";

function cellNames(projection, instrumentId) {
  return projection.rows
    .map((row) => row.cells[instrumentId])
    .filter((cell) => cell.type === "entry")
    .map((cell) => cell.participantName);
}

describe("projectJamTable", () => {
  it("projects a participant added to an empty column", () => {
    const state = createEmptyJamState({
      participants: [createParticipant("participant-sarah", "Sarah")],
      entries: [createEntry("entry-sarah-vocal", "participant-sarah", "vocal", 0)],
    });

    const projection = projectJamTable(state);

    expect(projection.rows[0].cells.vocal).toMatchObject({
      type: "entry",
      participantName: "Sarah",
      isNextPlayable: true,
      isLoop: false,
    });
  });

  it("keeps participants in base order when a column already has entries", () => {
    const projection = projectJamTable(createBasicJamState());

    expect(cellNames(projection, "guitar").slice(0, 2)).toEqual(["Nicolas", "Tom"]);
  });

  it("adds loop rows after the first rotation with loop numbers", () => {
    const projection = projectJamTable(createEmptyJamState({
      participants: [createParticipant("participant-sarah", "Sarah")],
      entries: [createEntry("entry-sarah-vocal", "participant-sarah", "vocal", 0)],
    }));

    expect(projection.rows[0].cells.vocal).toMatchObject({ isLoop: false, loopNumber: null });
    expect(projection.rows[1].cells.vocal).toMatchObject({ isLoop: true, loopNumber: 2 });
    expect(projection.rows[2].cells.vocal).toMatchObject({ isLoop: true, loopNumber: 3 });
    expect(projection.rows[3].cells.vocal).toMatchObject({ isLoop: true, loopNumber: 4 });
  });

  it("places a new participant before loop preview rows", () => {
    const state = createEmptyJamState({
      participants: [
        createParticipant("participant-sarah", "Sarah"),
        createParticipant("participant-lea", "Léa"),
      ],
      entries: [
        createEntry("entry-sarah-vocal", "participant-sarah", "vocal", 0),
        createEntry("entry-lea-vocal", "participant-lea", "vocal", 1),
      ],
    });

    const projection = projectJamTable(state);

    expect(projection.rows[0].cells.vocal).toMatchObject({ participantName: "Sarah", isLoop: false });
    expect(projection.rows[1].cells.vocal).toMatchObject({ participantName: "Léa", isLoop: false });
    expect(projection.rows[2].cells.vocal).toMatchObject({ participantName: "Sarah", isLoop: true, loopNumber: 2 });
  });

  it("keeps played entries fixed as history", () => {
    const state = createBasicJamState();
    state.playedPassages = [createPlayedPassage("played-1", { participantEntryId: "entry-nicolas-guitar", lineIndex: 0 })];

    const projection = projectJamTable(state);

    expect(projection.rows[0].cells.guitar).toMatchObject({
      type: "entry",
      entryId: "entry-nicolas-guitar",
      isPlayed: true,
    });
    expect(projection.rows[1].cells.guitar).toMatchObject({ entryId: "entry-tom-guitar", isPlayed: false });
  });

  it("removes participants marked left from future rows but keeps played history", () => {
    const state = createBasicJamState();
    state.participants = state.participants.map((participant) => (
      participant.id === "participant-nicolas" ? { ...participant, status: "left" } : participant
    ));
    state.playedPassages = [createPlayedPassage("played-1", { participantEntryId: "entry-nicolas-guitar", lineIndex: 0 })];

    const projection = projectJamTable(state);

    expect(projection.rows[0].cells.guitar).toMatchObject({ participantName: "Nicolas", isPlayed: true, isParticipantLeft: true });
    expect(projection.rows.some((row) => row.cells.guitar.entryId === "entry-nicolas-guitar" && !row.cells.guitar.isPlayed)).toBe(false);
  });

  it("projects a manual hole once without looping it", () => {
    const state = createBasicJamState();
    state.holes = [createHole("hole-drums-1", "drums", 1)];

    const projection = projectJamTable(state);

    expect(projection.rows[0].cells.drums).toMatchObject({ type: "entry", participantName: "Jérémy" });
    expect(projection.rows[1].cells.drums).toMatchObject({ type: "hole", holeId: "hole-drums-1", isLoop: false });
    expect(projection.rows.filter((row) => row.cells.drums.holeId === "hole-drums-1")).toHaveLength(1);
  });

  it("projects holes created by wants to play without and links them", () => {
    const state = createBasicJamState();
    state.holes = [createHole("hole-drums-without", "drums", 0, actionTypes.WANTS_TO_PLAY_WITHOUT)];
    state.linkGroups = [{ id: "link-1", entryIds: ["entry-nicolas-guitar"], holeIds: ["hole-drums-without"] }];

    const projection = projectJamTable(state);

    expect(projection.rows[0].cells.guitar).toMatchObject({ entryId: "entry-nicolas-guitar", linkGroupId: "link-1" });
    expect(projection.rows[0].cells.drums).toMatchObject({ type: "hole", holeId: "hole-drums-without", linkGroupId: "link-1" });
  });

  it("aligns linked entries on the latest natural row and pushes other cards", () => {
    const state = createBasicJamState();
    state.linkGroups = [{ id: "link-1", entryIds: ["entry-sarah-vocal", "entry-tom-guitar"], holeIds: [] }];

    const projection = projectJamTable(state);

    expect(projection.rows[0].cells.guitar).toMatchObject({ entryId: "entry-nicolas-guitar" });
    expect(projection.rows[1].cells.vocal).toMatchObject({ entryId: "entry-sarah-vocal", linkGroupId: "link-1" });
    expect(projection.rows[1].cells.guitar).toMatchObject({ entryId: "entry-tom-guitar", linkGroupId: "link-1" });
  });

  it("aligns a linked entry and hole on the same row", () => {
    const state = createBasicJamState();
    state.holes = [createHole("hole-drums-1", "drums", 0)];
    state.linkGroups = [{ id: "link-1", entryIds: ["entry-nicolas-guitar"], holeIds: ["hole-drums-1"] }];

    const projection = projectJamTable(state);

    expect(projection.rows[0].cells.guitar.linkGroupId).toBe("link-1");
    expect(projection.rows[0].cells.drums).toMatchObject({ type: "hole", linkGroupId: "link-1" });
  });

  it("computes main jam stats", () => {
    const state = createBasicJamState();
    state.playedPassages = [
      createPlayedPassage("played-1", { participantEntryId: "entry-nicolas-guitar", lineIndex: 0 }),
      createPlayedPassage("played-2", { participantEntryId: "entry-jeremy-drums", lineIndex: 0 }),
    ];

    expect(projectJamTable(state).stats).toEqual({
      uniqueMusiciansCount: 4,
      participantEntriesCount: 4,
      playedPlateausCount: 1,
      unplayedActiveEntriesCount: 2,
    });
  });
});
