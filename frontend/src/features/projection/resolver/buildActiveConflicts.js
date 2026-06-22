import { createResolverWarning } from "./resolverWarnings";

export function buildActiveConflicts({
  cards = [],
  conflicts = [],
  hiddenColumnIds = [],
  transactionContext = {},
} = {}) {
  const visibleIds = new Set(cards.map((card) => card.cardId));
  const byParticipation = new Map();
  cards.forEach((card) => {
    if (!card.participationId) return;
    if (!byParticipation.has(card.participationId))
      byParticipation.set(card.participationId, []);
    byParticipation.get(card.participationId).push(card.cardId);
  });
  const hidden = new Set(hiddenColumnIds);
  const warnings = [];
  const activeConflicts = [];

  [...conflicts]
    .filter(
      (conflict) => conflict.active === true || conflict.status === "active",
    )
    .sort((a, b) => String(a.conflictId).localeCompare(String(b.conflictId)))
    .forEach((conflict) => {
      let targetCardIds = conflict.targetCardIds ?? conflict.targetIds ?? [];
      if (conflict.scope === "participation") {
        const parts =
          conflict.targetParticipationIds ?? conflict.targetIds ?? [];
        targetCardIds = parts.flatMap((id) => byParticipation.get(id) ?? []);
      }
      const visibleTargets = targetCardIds.filter((id) => visibleIds.has(id));
      const hiddenTargets = targetCardIds.filter((id) => !visibleIds.has(id));
      if (visibleTargets.length > 0 && hiddenTargets.length > 0) {
        warnings.push(
          createResolverWarning(
            "hidden_column_constraint_ignored",
            "hidden_column_not_resolved",
            {
              transactionId: transactionContext.transactionId,
              cardIds: targetCardIds,
              conflictIds: [conflict.conflictId],
              columnIds: [...hidden],
            },
          ),
        );
      }
      if (visibleTargets.length >= 2)
        activeConflicts.push({ ...conflict, targetCardIds: visibleTargets });
    });
  return { conflicts: activeConflicts, warnings };
}
