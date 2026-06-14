const DEFAULT_GAP = 1000;

export function compareOrderKeys(left, right) {
  return String(left.orderKey ?? '').localeCompare(String(right.orderKey ?? ''), undefined, { numeric: true });
}

export function orderItems(items) {
  return [...items].sort(compareOrderKeys);
}

export function targetMatchesItem(target, item) {
  if (!target || !item) return false;
  const targetType = target.type ?? target.targetType;
  const targetId = target.id ?? target.targetId;
  if (targetType !== item.type) return false;
  return targetId === (item.appearanceId ?? item.holeId ?? item.id);
}

export function makePositionKey({ previousKey = null, nextKey = null, fallbackIndex = 0 } = {}) {
  const previous = Number.parseFloat(previousKey);
  const next = Number.parseFloat(nextKey);
  if (Number.isFinite(previous) && Number.isFinite(next)) return String((previous + next) / 2);
  if (Number.isFinite(previous)) return String(previous + DEFAULT_GAP);
  if (Number.isFinite(next)) return String(next - DEFAULT_GAP);
  return String((fallbackIndex + 1) * DEFAULT_GAP);
}

export function orderKeyBetweenTargets(items, { afterTarget = null, beforeTarget = null, fallbackIndex = 0 } = {}) {
  const ordered = orderItems(items);
  const after = ordered.find((item) => targetMatchesItem(afterTarget, item));
  const before = ordered.find((item) => targetMatchesItem(beforeTarget, item));
  return makePositionKey({ previousKey: after?.orderKey, nextKey: before?.orderKey, fallbackIndex });
}
