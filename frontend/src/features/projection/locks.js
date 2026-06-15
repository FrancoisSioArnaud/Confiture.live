export function isLocked(state, target) {
  return Boolean(state.locks[`${target.type}:${target.id}`]);
}

export function setLock(state, target, locked) {
  const key = `${target.type}:${target.id}`;
  if (locked) state.locks[key] = true;
  else delete state.locks[key];
}
