import { beforeEach, describe, expect, it } from "vitest";

import { useJamTableStore } from "./useJamTableStore.js";

function resetStore() {
  useJamTableStore.getState().loadFixtureJam();
}

describe("useJamTableStore", () => {
  beforeEach(() => {
    resetStore();
  });

  it("applies markEntryPlayed through the engine", () => {
    useJamTableStore.getState().markEntryPlayed({ entryId: "entry-nicolas-guitar" });

    const state = useJamTableStore.getState();

    expect(state.jamState.playedPassages).toContainEqual(expect.objectContaining({
      participantEntryId: "entry-nicolas-guitar",
    }));
    expect(state.projectedTable.stats.unplayedActiveEntriesCount).toBe(5);
  });

  it("applies addHole through the engine", () => {
    useJamTableStore.getState().addHole({ instrumentId: "bass", position: 1, id: "hole-bass-test" });

    const state = useJamTableStore.getState();

    expect(state.jamState.holes).toContainEqual(expect.objectContaining({
      id: "hole-bass-test",
      instrumentId: "bass",
      position: 1,
    }));
    expect(state.projectedTable.rows.some((row) => row.cells.bass.holeId === "hole-bass-test")).toBe(true);
  });

  it("applies markPlateauPlayed through the engine", () => {
    useJamTableStore.getState().markPlateauPlayed({ lineIndex: 1 });

    const state = useJamTableStore.getState();

    expect(state.jamState.playedPassages.length).toBeGreaterThan(2);
    expect(state.projectedTable.stats.playedPlateausCount).toBe(2);
  });

  it("opens and closes mode link", () => {
    const source = useJamTableStore.getState().projectedTable.rows[1].cells.guitar;

    useJamTableStore.getState().startLinkMode(source);
    expect(useJamTableStore.getState().linkMode).toMatchObject({
      active: true,
      selectedEntryIds: [source.entryId],
    });

    useJamTableStore.getState().cancelLinkMode();
    expect(useJamTableStore.getState().linkMode.active).toBe(false);
  });

  it("recalculates projection after a vertical move", () => {
    useJamTableStore.getState().addParticipant({
      participant: { id: "participant-zoe", jamId: "jam-demo", name: "Zoé", status: "active" },
      entries: [{
        id: "entry-zoe-guitar",
        jamId: "jam-demo",
        participantId: "participant-zoe",
        instrumentId: "guitar",
        customInstrumentLabel: null,
        baseOrder: 2,
      }],
    });

    useJamTableStore.getState().moveEntryVertical({ entryId: "entry-zoe-guitar", toIndex: 0 });

    const guitarCells = useJamTableStore.getState().projectedTable.rows
      .map((row) => row.cells.guitar)
      .filter((cell) => cell.type === "entry" && !cell.isPlayed && !cell.isLoop);
    expect(guitarCells[0].entryId).toBe("entry-zoe-guitar");
  });

  it("recalculates projection after an action", () => {
    const beforeRows = useJamTableStore.getState().projectedTable.rows.length;

    useJamTableStore.getState().addHole({ instrumentId: "piano", position: 2, id: "hole-piano-test" });

    const state = useJamTableStore.getState();
    expect(state.projectedTable.rows.length).toBeGreaterThanOrEqual(beforeRows);
    expect(state.projectedTable.rows.some((row) => row.cells.piano.holeId === "hole-piano-test")).toBe(true);
  });
});
