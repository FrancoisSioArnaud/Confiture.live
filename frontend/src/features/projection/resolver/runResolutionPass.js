import { createResolverWarning } from "./resolverWarnings";
import { compareLayoutEntries } from "./compareResolverEntities";

export const RESOLUTION_LIMITS = Object.freeze({
  MAX_PASSES: 50,
  MAX_REPAIRS_PER_PASS_MULTIPLIER: 4,
  MAX_CANDIDATE_ROW_DISTANCE: 200,
});

function entriesByColumn(layout, columnId) {
  return Object.values(layout)
    .filter((entry) => entry.columnId === columnId)
    .sort(compareLayoutEntries);
}
function allColumnIds(layout) {
  return [
    ...new Set(Object.values(layout).map((entry) => entry.columnId)),
  ].sort();
}
function occupiedRows(layout, columnId, exceptId = null) {
  return new Set(
    entriesByColumn(layout, columnId)
      .filter((entry) => entry.cardId !== exceptId)
      .map((entry) => entry.resolvedRow),
  );
}
function hasConflictAtRow(layout, conflicts, cardId, row) {
  return conflicts.some(
    (conflict) =>
      (conflict.targetCardIds ?? []).includes(cardId) &&
      (conflict.targetCardIds ?? []).some(
        (otherId) => otherId !== cardId && layout[otherId]?.resolvedRow === row,
      ),
  );
}
function nearestFreeRow(layout, conflicts, entry, preferredRow) {
  const occupied = occupiedRows(layout, entry.columnId, entry.cardId);
  for (
    let distance = 0;
    distance <= RESOLUTION_LIMITS.MAX_CANDIDATE_ROW_DISTANCE;
    distance += 1
  ) {
    const candidates =
      distance === 0
        ? [preferredRow]
        : [preferredRow + distance, preferredRow - distance].filter(
            (row) => row >= 1,
          );
    for (const row of candidates) {
      if (
        row >= 1 &&
        !occupied.has(row) &&
        !hasConflictAtRow(layout, conflicts, entry.cardId, row)
      )
        return row;
    }
  }
  return null;
}
function moveEntry(layout, conflicts, entry, row) {
  if (!entry || entry.fixed) return false;
  const nextRow = nearestFreeRow(layout, conflicts, entry, Math.max(1, row));
  if (!Number.isFinite(nextRow) || nextRow === entry.resolvedRow) return false;
  entry.resolvedRow = nextRow;
  return true;
}

function moveWithinColumnToRow(layout, entry, targetRow) {
  if (!entry || entry.fixed) return { moved: false, displaced: [] };
  const column = entriesByColumn(layout, entry.columnId);
  const fromIndex = column.findIndex(
    (candidate) => candidate.cardId === entry.cardId,
  );
  if (fromIndex < 0) return { moved: false, displaced: [] };
  const toIndex = Math.max(
    0,
    Math.min(Math.max(1, targetRow) - 1, column.length - 1),
  );
  if (fromIndex === toIndex && entry.resolvedRow === targetRow)
    return { moved: false, displaced: [] };
  const next = [...column];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  const fixedWouldMove = column.some(
    (candidate, index) =>
      candidate.fixed && next[index]?.cardId !== candidate.cardId,
  );
  if (fixedWouldMove) return { moved: false, displaced: [] };
  const displaced = [];
  next.forEach((candidate, index) => {
    const row = index + 1;
    if (candidate.resolvedRow !== row) {
      if (candidate.cardId !== entry.cardId)
        displaced.push({ cardId: candidate.cardId, row });
      candidate.resolvedRow = row;
    }
  });
  if (targetRow > next.length) moved.resolvedRow = targetRow;
  return { moved: true, displaced };
}

function repairCollisions(layout, conflicts) {
  let repairCount = 0;
  allColumnIds(layout).forEach((columnId) => {
    const byRow = new Map();
    entriesByColumn(layout, columnId).forEach((entry) => {
      if (!byRow.has(entry.resolvedRow)) byRow.set(entry.resolvedRow, []);
      byRow.get(entry.resolvedRow).push(entry);
    });
    [...byRow.values()].forEach((entries) => {
      if (entries.length < 2) return;
      const keep =
        entries.find((entry) => entry.fixed) ??
        entries.sort(compareLayoutEntries)[0];
      entries
        .filter((entry) => entry.cardId !== keep.cardId)
        .forEach((entry) => {
          if (moveEntry(layout, conflicts, entry, entry.resolvedRow + 1))
            repairCount += 1;
        });
    });
  });
  return repairCount;
}

function repairLinks(
  layout,
  links,
  conflicts,
  transactionContext,
  priorityRows,
) {
  const warnings = [];
  let repairCount = 0;
  links.forEach((link) => {
    const entries = (link.targetCardIds ?? [])
      .map((id) => layout[id])
      .filter(Boolean);
    if (entries.length < 2) return;
    const fixedRows = [
      ...new Set(
        entries
          .filter((entry) => entry.fixed)
          .map((entry) => entry.resolvedRow),
      ),
    ];
    if (fixedRows.length > 1) {
      warnings.push(
        createResolverWarning(
          "link_unresolvable",
          "linked_cards_fixed_on_different_rows",
          {
            transactionId: transactionContext.transactionId,
            cardIds: entries.map((entry) => entry.cardId),
            linkIds: [link.linkId],
          },
        ),
      );
      return;
    }
    let targetRow = fixedRows[0];
    const priorityEntry = entries.find((entry) =>
      priorityRows.has(entry.cardId),
    );
    if (!Number.isFinite(targetRow) && priorityEntry)
      targetRow = priorityRows.get(priorityEntry.cardId);
    if (!Number.isFinite(targetRow)) {
      const rows = entries.map((entry) => entry.resolvedRow);
      if (link.reorderStrategy === "move_to_last")
        targetRow = Math.max(...rows);
      else if (link.reorderStrategy === "average_position")
        targetRow = Math.round(
          rows.reduce((sum, row) => sum + row, 0) / rows.length,
        );
      else targetRow = Math.min(...rows);
    }
    targetRow = Math.max(1, targetRow);
    entries.sort(compareLayoutEntries).forEach((entry) => {
      if (entry.resolvedRow !== targetRow) {
        const result = moveWithinColumnToRow(layout, entry, targetRow);
        if (result.moved) {
          repairCount += 1;
          result.displaced.forEach(({ cardId, row }) =>
            priorityRows.set(cardId, row),
          );
        }
      }
    });
  });
  return { repairCount, warnings };
}

function repairConflicts(layout, conflicts, transactionContext) {
  const warnings = [];
  let repairCount = 0;
  conflicts.forEach((conflict) => {
    const ids = conflict.targetCardIds ?? [];
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = layout[ids[i]];
        const b = layout[ids[j]];
        if (!a || !b || a.resolvedRow !== b.resolvedRow) continue;
        if (a.fixed && b.fixed) {
          warnings.push(
            createResolverWarning(
              "conflict_unresolvable",
              "conflicted_cards_fixed_on_same_row",
              {
                transactionId: transactionContext.transactionId,
                cardIds: [a.cardId, b.cardId],
                conflictIds: [conflict.conflictId],
              },
            ),
          );
          continue;
        }
        const target = a.fixed
          ? b
          : b.fixed
            ? a
            : [a, b].sort(compareLayoutEntries)[1];
        if (moveEntry(layout, conflicts, target, target.resolvedRow + 1))
          repairCount += 1;
      }
    }
  });
  return { repairCount, warnings };
}

export function layoutHash(layout) {
  return Object.values(layout)
    .sort((a, b) => String(a.cardId).localeCompare(String(b.cardId)))
    .map((entry) => `${entry.cardId}:${entry.columnId}:${entry.resolvedRow}`)
    .join("|");
}

export function runResolutionPass(
  layout,
  { links = [], conflicts = [], transactionContext = {} } = {},
) {
  const next = Object.fromEntries(
    Object.entries(layout).map(([id, entry]) => [id, { ...entry }]),
  );
  const warnings = [];
  let repairCount = 0;
  repairCount += repairCollisions(next, conflicts);
  const priorityRows = new Map();
  const linkResult = repairLinks(
    next,
    links,
    conflicts,
    transactionContext,
    priorityRows,
  );
  repairCount += linkResult.repairCount;
  warnings.push(...linkResult.warnings);
  repairCount += repairCollisions(next, conflicts);
  const conflictResult = repairConflicts(next, conflicts, transactionContext);
  repairCount += conflictResult.repairCount;
  warnings.push(...conflictResult.warnings);
  repairCount += repairCollisions(next, conflicts);
  return {
    layout: next,
    repairCount,
    warnings,
    changed: layoutHash(layout) !== layoutHash(next),
  };
}
