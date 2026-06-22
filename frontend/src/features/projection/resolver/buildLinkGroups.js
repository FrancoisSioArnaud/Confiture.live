import { createResolverWarning } from "./resolverWarnings";

function find(parent, id) {
  if (parent.get(id) !== id) parent.set(id, find(parent, parent.get(id)));
  return parent.get(id);
}
function union(parent, a, b) {
  const ra = find(parent, a);
  const rb = find(parent, b);
  if (ra !== rb) parent.set(rb, ra);
}

export function buildLinkGroups({
  cards = [],
  links = [],
  hiddenColumnIds = [],
  transactionContext = {},
} = {}) {
  const visibleIds = new Set(cards.map((card) => card.cardId));
  const hidden = new Set(hiddenColumnIds);
  const parent = new Map(cards.map((card) => [card.cardId, card.cardId]));
  const warnings = [];
  const usableLinks = [];

  [...links]
    .filter((link) => link.active === true || link.status === "active")
    .sort((a, b) => String(a.linkId).localeCompare(String(b.linkId)))
    .forEach((link) => {
      const targets = link.targetCardIds ?? [];
      const visibleTargets = targets.filter((id) => visibleIds.has(id));
      const hiddenTargets = targets.filter((id) => !visibleIds.has(id));
      const hasHiddenColumnTarget =
        hiddenTargets.length > 0 && cards.length > 0;
      if (visibleTargets.length > 0 && hasHiddenColumnTarget) {
        warnings.push(
          createResolverWarning(
            "hidden_column_constraint_ignored",
            "hidden_column_not_resolved",
            {
              transactionId: transactionContext.transactionId,
              cardIds: targets,
              linkIds: [link.linkId],
              columnIds: [...hidden],
            },
          ),
        );
      }
      if (visibleTargets.length >= 2) {
        usableLinks.push({ ...link, targetCardIds: visibleTargets });
        for (let i = 1; i < visibleTargets.length; i += 1)
          union(parent, visibleTargets[0], visibleTargets[i]);
      }
    });

  const byRoot = new Map();
  cards.forEach((card) => {
    const root = find(parent, card.cardId);
    if (!byRoot.has(root)) byRoot.set(root, []);
    byRoot.get(root).push(card.cardId);
  });
  const groups = [...byRoot.values()]
    .filter((ids) => ids.length > 1)
    .map((cardIds) => ({
      cardIds: cardIds.sort((a, b) => a.localeCompare(b)),
    }));
  return { groups, links: usableLinks, warnings };
}
