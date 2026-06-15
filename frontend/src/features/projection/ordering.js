export function stableOrderValue(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const numericText = String(value).replace(/[^0-9.-]/g, '');
  const numeric = Number(numericText);
  if (numericText && Number.isFinite(numeric)) return numeric;
  return [...String(value)].reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

export function getEntityOrder(entity) {
  return entity.orderScore ?? stableOrderValue(entity.positionKey ?? entity.baseOrderKey ?? entity.orderKey);
}

export function orderBetween(afterEntity, beforeEntity, fallback) {
  const after = afterEntity ? getEntityOrder(afterEntity) : null;
  const before = beforeEntity ? getEntityOrder(beforeEntity) : null;
  if (after != null && before != null) return (after + before) / 2;
  if (after != null) return after + 1;
  if (before != null) return before - 1;
  return fallback;
}

export function sortByColumnOrder(a, b) {
  const order = getEntityOrder(a) - getEntityOrder(b);
  if (order !== 0) return order;
  return String(a.id).localeCompare(String(b.id));
}

export function targetKey(target) {
  return `${target.type}:${target.id}`;
}
