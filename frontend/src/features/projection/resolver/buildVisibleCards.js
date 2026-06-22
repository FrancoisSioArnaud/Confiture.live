import { compareResolverEntities } from "./compareResolverEntities";

export function buildVisibleCards({ cards = [], hiddenColumnIds = [] } = {}) {
  const hidden = new Set(hiddenColumnIds);
  return [...cards]
    .filter(
      (card) =>
        card &&
        card.deleted !== true &&
        card.hidden !== true &&
        !hidden.has(card.columnId),
    )
    .sort(compareResolverEntities);
}
