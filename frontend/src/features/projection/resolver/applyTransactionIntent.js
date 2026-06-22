import { compareLayoutEntries } from "./compareResolverEntities";

function columnEntries(layout, columnId) {
  return Object.values(layout)
    .filter((entry) => entry.columnId === columnId)
    .sort(compareLayoutEntries);
}
function assignColumnOrder(entries) {
  entries.forEach((entry, index) => {
    if (!entry.fixed) entry.resolvedRow = index + 1;
  });
}
function moveToIndex(entries, fromIndex, toIndex) {
  const next = [...entries];
  const [item] = next.splice(fromIndex, 1);
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, item);
  return next;
}

export function applyTransactionIntent(layout, transactionContext = {}) {
  const next = Object.fromEntries(
    Object.entries(layout).map(([id, entry]) => [id, { ...entry }]),
  );
  const anchor = next[transactionContext.anchorCardId];
  if (transactionContext.intent === "move" && anchor && !anchor.fixed) {
    const entries = columnEntries(next, anchor.columnId);
    const from = entries.findIndex((entry) => entry.cardId === anchor.cardId);
    const before = transactionContext.beforeTargetCardId
      ? entries.findIndex(
          (entry) => entry.cardId === transactionContext.beforeTargetCardId,
        )
      : -1;
    const after = transactionContext.afterTargetCardId
      ? entries.findIndex(
          (entry) => entry.cardId === transactionContext.afterTargetCardId,
        )
      : -1;
    if (
      (transactionContext.beforeTargetCardId && before < 0) ||
      (transactionContext.afterTargetCardId && after < 0)
    )
      return next;
    let to = entries.length - 1;
    if (before >= 0) to = before;
    else if (after >= 0) to = after + 1;
    assignColumnOrder(moveToIndex(entries, from, to));
  }
  if (
    transactionContext.intent === "skip" &&
    anchor &&
    !anchor.fixed &&
    Number.isFinite(transactionContext.preferredResolvedRow)
  )
    anchor.resolvedRow = Math.max(1, transactionContext.preferredResolvedRow);
  if (
    transactionContext.intent === "card_created" &&
    anchor &&
    Number.isFinite(transactionContext.preferredResolvedRow)
  )
    anchor.resolvedRow = Math.max(1, transactionContext.preferredResolvedRow);
  if (
    (transactionContext.intent === "lock" ||
      transactionContext.intent === "play") &&
    anchor &&
    Number.isFinite(transactionContext.preferredResolvedRow)
  )
    anchor.resolvedRow = Math.max(1, transactionContext.preferredResolvedRow);
  return next;
}
