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
  const resolvedOrder = (a.resolvedColumnOrder ?? Number.MAX_SAFE_INTEGER) - (b.resolvedColumnOrder ?? Number.MAX_SAFE_INTEGER);
  if (resolvedOrder !== 0) return resolvedOrder;

  const roundOrder = getCardRoundIndex(a) - getCardRoundIndex(b);
  if (roundOrder !== 0) return roundOrder;

  const positionOrder = getPositionInRound(a) - getPositionInRound(b);
  if (positionOrder !== 0) return positionOrder;

  return String(a.id).localeCompare(String(b.id));
}

export function targetKey(target) {
  return `${target.type}:${target.id}`;
}
