export function buildDragItems(projection) {
  const itemsById = {};

  for (const column of projection.columns) {
    const columnItems = projection.rows
      .map((row) => ({ rowIndex: row.rowIndex, cell: row.cells[column.instrumentId] }))
      .filter(({ cell }) => cell.type === "entry" && !cell.isPlayed && !cell.isParticipantLeft);

    columnItems.forEach(({ rowIndex, cell }, toIndex) => {
      itemsById[cell.slotId ?? cell.entryId] = {
        id: `slot:${cell.slotId ?? cell.entryId}`,
        slotId: cell.slotId,
        entryId: cell.entryId,
        instrumentId: cell.instrumentId,
        rowIndex,
        toIndex,
        linkGroupId: cell.linkGroupId,
        isPlayed: cell.isPlayed,
      };
    });
  }

  return itemsById;
}

export function getVerticalMovePayload(activeData, overData) {
  if (!activeData || !overData) {
    return null;
  }

  if (activeData.isPlayed || activeData.instrumentId !== overData.instrumentId) {
    return null;
  }

  if ((activeData.slotId ?? activeData.entryId) === (overData.slotId ?? overData.entryId) || activeData.toIndex === overData.toIndex) {
    return null;
  }

  return {
    ...(activeData.slotId ? { slotId: activeData.slotId } : { entryId: activeData.entryId }),
    toIndex: overData.toIndex,
  };
}

export function restrictDragToVerticalAxis({ transform }) {
  return {
    ...transform,
    x: 0,
  };
}
