import { compareResolverEntities } from "./compareResolverEntities";

function seedRow(card, previousLayout) {
  return (
    previousLayout?.byCardId?.[card.cardId]?.resolvedRow ??
    card.previousResolvedRow ??
    card.resolvedRow ??
    card.baseOrder ??
    card.createdAtOrder ??
    1
  );
}

export function buildInitialLayout({ cards = [], previousLayout = null } = {}) {
  const layout = {};
  [...cards].sort(compareResolverEntities).forEach((card) => {
    layout[card.cardId] = {
      cardId: card.cardId,
      columnId: card.columnId,
      resolvedRow: Math.max(1, seedRow(card, previousLayout)),
      card,
      fixed: card.played === true || card.locked === true,
    };
  });
  return layout;
}
