import { createResolverWarning } from "./resolverWarnings";
import { compareLayoutEntries } from "./compareResolverEntities";
import { RESOLUTION_COST } from "./resolverCosts";
import { PROPAGATION_PRIORITY } from "./resolverPriorities";

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

function setPriority(priorityRows, cardId, row, priority) {
  const current = priorityRows.get(cardId);
  if (
    !current ||
    priority > current.priority ||
    (priority === current.priority && row < current.row)
  )
    priorityRows.set(cardId, { row, priority });
}

function priorityFor(priorityRows, cardId) {
  return priorityRows.get(cardId);
}

function scoreGroupTarget(entries, targetRow, priorityRows) {
  return entries.reduce((score, entry) => {
    if (entry.fixed && entry.resolvedRow !== targetRow)
      return RESOLUTION_COST.IMPOSSIBLE;
    const distance = Math.abs(entry.resolvedRow - targetRow);
    const entryPriority = priorityFor(priorityRows, entry.cardId);
    const priority = entryPriority?.priority ?? 0;
    const priorityBonus =
      entryPriority?.row === targetRow
        ? priority * RESOLUTION_COST.ROW_DISTANCE
        : 0;
    const secondary =
      priority >= PROPAGATION_PRIORITY.USER_MOVE
        ? 0
        : RESOLUTION_COST.MOVE_SECONDARY_CARD;
    const inversion =
      (entry.previousResolvedRow ?? entry.resolvedRow) > targetRow
        ? RESOLUTION_COST.RELATIVE_ORDER_INVERSION
        : 0;
    return (
      score +
      distance * RESOLUTION_COST.ROW_DISTANCE +
      secondary +
      inversion +
      RESOLUTION_COST.MOVE_LINK_GROUP -
      priorityBonus
    );
  }, 0);
}

function fixedBlockerAtRow(layout, entry, row) {
  return entriesByColumn(layout, entry.columnId).find(
    (candidate) =>
      candidate.cardId !== entry.cardId &&
      candidate.fixed &&
      candidate.resolvedRow === row,
  );
}

function groupDesiredRows(entries, targetRow) {
  const sortedEntries = [...entries].sort(compareLayoutEntries);
  const hasDuplicateColumn =
    new Set(sortedEntries.map((entry) => entry.columnId)).size <
    sortedEntries.length;
  return new Map(
    sortedEntries.map((entry, index) => [
      entry.cardId,
      hasDuplicateColumn ? targetRow + index : targetRow,
    ]),
  );
}

function canPlaceGroupAtRow(layout, entries, targetRow) {
  const desiredRows = groupDesiredRows(entries, targetRow);
  return entries.every((entry) => {
    const desiredRow = desiredRows.get(entry.cardId);
    if (entry.fixed) return entry.resolvedRow === desiredRow;
    return !fixedBlockerAtRow(layout, entry, desiredRow);
  });
}

function candidateRowsNearestFirst(preferredRow) {
  const start = Math.max(1, preferredRow);
  const rows = [];
  for (
    let distance = 0;
    distance <= RESOLUTION_LIMITS.MAX_CANDIDATE_ROW_DISTANCE;
    distance += 1
  ) {
    if (distance === 0) {
      rows.push(start);
      continue;
    }
    rows.push(start + distance);
    if (start - distance >= 1) rows.push(start - distance);
  }
  return rows;
}

function repairCollisions(layout, conflicts, transactionContext = {}) {
  const warnings = [];
  let repairCount = 0;
  allColumnIds(layout).forEach((columnId) => {
    const byRow = new Map();
    entriesByColumn(layout, columnId).forEach((entry) => {
      if (!byRow.has(entry.resolvedRow)) byRow.set(entry.resolvedRow, []);
      byRow.get(entry.resolvedRow).push(entry);
    });
    [...byRow.values()].forEach((entries) => {
      if (entries.length < 2) return;
      const fixedEntries = entries
        .filter((entry) => entry.fixed)
        .sort(compareLayoutEntries);
      if (fixedEntries.length > 1) {
        warnings.push(
          createResolverWarning(
            "column_collision_unresolvable",
            "same_column_collision_with_fixed_cards",
            {
              transactionId: transactionContext.transactionId,
              cardIds: fixedEntries.map((entry) => entry.cardId),
              columnIds: [columnId],
            },
          ),
        );
        return;
      }
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
  return { repairCount, warnings };
}

function repairLinks(
  layout,
  linkGroups,
  conflicts,
  transactionContext,
  priorityRows,
) {
  const warnings = [];
  let repairCount = 0;
  linkGroups.forEach((group) => {
    const entries = (group.cardIds ?? [])
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
              linkIds: group.linkIds ?? [],
            },
          ),
        );
      return;
    }
    const candidates = new Set(fixedRows);
    entries.forEach((entry) => {
      const priority = priorityFor(priorityRows, entry.cardId);
      if (priority) candidates.add(priority.row);
      candidates.add(entry.resolvedRow);
    });
    let targetRow = fixedRows[0];
    if (!Number.isFinite(targetRow)) {
      const rows = entries.map((entry) => entry.resolvedRow);
      if (group.reorderStrategy === "move_to_last")
        candidates.add(Math.max(...rows));
      else if (group.reorderStrategy === "average_position")
        candidates.add(
          Math.round(rows.reduce((sum, row) => sum + row, 0) / rows.length),
        );
      else candidates.add(Math.min(...rows));
      targetRow = [...candidates]
        .filter(Number.isFinite)
        .map((row) => Math.max(1, row))
        .sort((a, b) => {
          const score =
            scoreGroupTarget(entries, a, priorityRows) -
            scoreGroupTarget(entries, b, priorityRows);
          if (score !== 0) return score;
          return a - b;
        })[0];
    }
    targetRow = Math.max(1, targetRow);
    const candidateRow = candidateRowsNearestFirst(targetRow).find((row) =>
      canPlaceGroupAtRow(layout, entries, row),
    );
    if (!Number.isFinite(candidateRow)) {
      warnings.push(
        createResolverWarning(
          "link_unresolvable",
          "link_target_blocked_by_fixed_card",
          {
            transactionId: transactionContext.transactionId,
            cardIds: entries.map((entry) => entry.cardId).sort(),
            linkIds: group.linkIds ?? [],
          },
        ),
      );
      return;
    }
    const desiredRows = groupDesiredRows(entries, candidateRow);
    entries.sort(compareLayoutEntries).forEach((entry) => {
      const desiredRow = desiredRows.get(entry.cardId);
      if (entry.resolvedRow !== desiredRow) {
        const result = moveWithinColumnToRow(layout, entry, desiredRow);
        if (result.moved) {
          repairCount += 1;
          const sourcePriority =
            priorityFor(priorityRows, entry.cardId)?.priority ??
            PROPAGATION_PRIORITY.LINKED_TO_INDIRECT_PUSH;
          setPriority(
            priorityRows,
            entry.cardId,
            desiredRow,
            Math.min(sourcePriority, PROPAGATION_PRIORITY.LINKED_TO_PUSHED_CARD),
          );
          result.displaced.forEach(({ cardId, row }) =>
            setPriority(
              priorityRows,
              cardId,
              row,
              sourcePriority >= PROPAGATION_PRIORITY.LINKED_TO_PUSHED_CARD
                ? PROPAGATION_PRIORITY.PUSHED_BY_LINKED_CARD
                : PROPAGATION_PRIORITY.LINKED_TO_INDIRECT_PUSH,
            ),
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
  { links = [], linkGroups = [], conflicts = [], transactionContext = {} } = {},
) {
  const next = Object.fromEntries(
    Object.entries(layout).map(([id, entry]) => [id, { ...entry }]),
  );
  const warnings = [];
  let repairCount = 0;
  const initialCollisionResult = repairCollisions(
    next,
    conflicts,
    transactionContext,
  );
  repairCount += initialCollisionResult.repairCount;
  warnings.push(...initialCollisionResult.warnings);
  const priorityRows = new Map();
  if (transactionContext.anchorCardId && next[transactionContext.anchorCardId]) {
    setPriority(
      priorityRows,
      transactionContext.anchorCardId,
      next[transactionContext.anchorCardId].resolvedRow,
      transactionContext.intent === "move"
        ? PROPAGATION_PRIORITY.USER_MOVE
        : PROPAGATION_PRIORITY.STABILITY_DEFAULT,
    );
  }
  (transactionContext.affectedCardIds ?? [])
    .filter((cardId) => next[cardId])
    .sort((a, b) => String(a).localeCompare(String(b)))
    .forEach((cardId) =>
      setPriority(
        priorityRows,
        cardId,
        next[cardId].resolvedRow,
        PROPAGATION_PRIORITY.PUSHED_BY_USER_MOVE,
      ),
    );
  Object.values(next)
    .sort(compareLayoutEntries)
    .filter(
      (entry) =>
        entry.cardId !== transactionContext.anchorCardId &&
        Number.isFinite(
          entry.previousResolvedRow ?? entry.card?.previousResolvedRow,
        ) &&
        (entry.previousResolvedRow ?? entry.card?.previousResolvedRow) !==
          entry.resolvedRow,
    )
    .forEach((entry) =>
      setPriority(
        priorityRows,
        entry.cardId,
        entry.resolvedRow,
        PROPAGATION_PRIORITY.PUSHED_BY_USER_MOVE,
      ),
    );
  const linkResult = repairLinks(
    next,
    linkGroups.length > 0
      ? linkGroups
      : links.map((link) => ({
          cardIds: link.targetCardIds ?? [],
          linkIds: [link.linkId],
          reorderStrategy: link.reorderStrategy,
        })),
    conflicts,
    transactionContext,
    priorityRows,
  );
  repairCount += linkResult.repairCount;
  warnings.push(...linkResult.warnings);
  const postLinkCollisionResult = repairCollisions(
    next,
    conflicts,
    transactionContext,
  );
  repairCount += postLinkCollisionResult.repairCount;
  warnings.push(...postLinkCollisionResult.warnings);
  const conflictResult = repairConflicts(next, conflicts, transactionContext);
  repairCount += conflictResult.repairCount;
  warnings.push(...conflictResult.warnings);
  const finalCollisionResult = repairCollisions(
    next,
    conflicts,
    transactionContext,
  );
  repairCount += finalCollisionResult.repairCount;
  warnings.push(...finalCollisionResult.warnings);
  return {
    layout: next,
    repairCount,
    warnings,
    changed: layoutHash(layout) !== layoutHash(next),
  };
}
