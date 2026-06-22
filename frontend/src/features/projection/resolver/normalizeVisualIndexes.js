import { compareLayoutEntries } from "./compareResolverEntities";

export function normalizeVisualIndexes(layout) {
  const entries = Object.values(layout).sort(compareLayoutEntries);
  const rows = [...new Set(entries.map((entry) => entry.resolvedRow))].sort(
    (a, b) => a - b,
  );
  const visualByRow = new Map(rows.map((row, index) => [row, index + 1]));
  const byColumn = new Map();
  entries.forEach((entry) => {
    if (!byColumn.has(entry.columnId)) byColumn.set(entry.columnId, []);
    byColumn.get(entry.columnId).push(entry);
  });
  const layoutByCardId = {};
  const orderedCardIdsByColumnId = {};
  [...byColumn.keys()].sort().forEach((columnId) => {
    const columnEntries = byColumn.get(columnId).sort(compareLayoutEntries);
    orderedCardIdsByColumnId[columnId] = columnEntries.map(
      (entry) => entry.cardId,
    );
    columnEntries.forEach((entry, index) => {
      layoutByCardId[entry.cardId] = {
        resolvedRow: entry.resolvedRow,
        visualIndex: visualByRow.get(entry.resolvedRow),
        cardIndexInColumn: index + 1,
      };
    });
  });
  return {
    layoutByCardId,
    orderedCardIdsByColumnId,
    visibleResolvedRows: rows,
  };
}
