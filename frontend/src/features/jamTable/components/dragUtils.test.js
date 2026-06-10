import { describe, expect, it } from "vitest";

import { createJamTableUiFixture } from "../engine/uiFixtures.js";
import { projectJamTable } from "../engine/projectJamTable.js";
import { buildDragItems, getVerticalMovePayload, restrictDragToVerticalAxis } from "./dragUtils.js";

describe("jam table drag helpers", () => {
  it("does not expose played cards as draggable move sources", () => {
    const projection = projectJamTable(createJamTableUiFixture());
    const dragItems = buildDragItems(projection);

    expect(dragItems["entry-paul-guitar"]).toBeUndefined();
    expect(getVerticalMovePayload({ entryId: "entry-paul-guitar", instrumentId: "guitar", isPlayed: true }, dragItems["entry-nicolas-guitar"])).toBeNull();
  });

  it("creates a vertical move payload for a drop inside the same column", () => {
    const projection = projectJamTable(createJamTableUiFixture());
    const dragItems = buildDragItems(projection);
    const payload = getVerticalMovePayload(dragItems["entry-nicolas-guitar"], dragItems["entry-maya-guitar"] ?? {
      entryId: "target-guitar",
      instrumentId: "guitar",
      toIndex: 1,
    });

    expect(payload).toEqual({ entryId: "entry-nicolas-guitar", toIndex: 1 });
  });

  it("ignores horizontal moves across instruments", () => {
    expect(getVerticalMovePayload(
      { entryId: "entry-nicolas-guitar", instrumentId: "guitar", toIndex: 1 },
      { entryId: "entry-sarah-vocal", instrumentId: "vocal", toIndex: 0 },
    )).toBeNull();
  });

  it("locks dnd transforms to the vertical axis", () => {
    expect(restrictDragToVerticalAxis({ transform: { x: 42, y: 12, scaleX: 1, scaleY: 1 } })).toEqual({
      x: 0,
      y: 12,
      scaleX: 1,
      scaleY: 1,
    });
  });
});
