export function stableOrderValue(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const numericText = String(value).replace(/[^0-9.-]/g, '');
  const numeric = Number(numericText);
  if (numericText && Number.isFinite(numeric)) return numeric;
  return [...String(value)].reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

export function getCardRoundIndex(entity) {
  return Number.isFinite(entity?.appearanceIndex) ? entity.appearanceIndex : 1;
}

export function getPositionInRound(entity) {
  if (Number.isFinite(entity?.positionInRound)) return entity.positionInRound;
  if (Number.isFinite(entity?.roundOrder)) return entity.roundOrder;
  if (Number.isFinite(entity?.manualRoundOrder)) return entity.manualRoundOrder;
  return stableOrderValue(entity?.positionKey ?? entity?.baseOrderKey ?? entity?.orderKey ?? entity?.id);
}

export function getEntityOrder(entity) {
  return getPositionInRound(entity);
}

export function orderBetween(afterEntity, beforeEntity, fallback) {
  const after = afterEntity ? getPositionInRound(afterEntity) : null;
  const before = beforeEntity ? getPositionInRound(beforeEntity) : null;
  if (after != null && before != null) return (after + before) / 2;
  if (after != null) return after + 1;
  if (before != null) return before - 1;
  return fallback;
}

export function sortByColumnOrder(a, b) {
  const visualOrder = (a.visualIndex ?? Number.MAX_SAFE_INTEGER) - (b.visualIndex ?? Number.MAX_SAFE_INTEGER);
  if (visualOrder !== 0) return visualOrder;

  const resolvedRowOrder = (a.resolvedRow ?? Number.MAX_SAFE_INTEGER) - (b.resolvedRow ?? Number.MAX_SAFE_INTEGER);
  if (resolvedRowOrder !== 0) return resolvedRowOrder;

  const cardIndexOrder = (a.cardIndexInColumn ?? Number.MAX_SAFE_INTEGER) - (b.cardIndexInColumn ?? Number.MAX_SAFE_INTEGER);
  if (cardIndexOrder !== 0) return cardIndexOrder;

  const fallbackOrder = getPositionInRound(a) - getPositionInRound(b);
  if (fallbackOrder !== 0) return fallbackOrder;

  return String(a.id).localeCompare(String(b.id));
}

export function targetKey(target) {
  return `${target.type}:${target.id}`;
}
