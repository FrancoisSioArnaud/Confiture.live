import { getEntityOrder, orderBetween } from './ordering';

export function addHole(state, payload) {
  const after = payload.afterTarget ? getTargetEntity(state, payload.afterTarget) : null;
  const before = payload.beforeTarget ? getTargetEntity(state, payload.beforeTarget) : null;
  const positionInRound = orderBetween(after, before, getEntityOrder({ positionKey: payload.positionKey }));
  state.holes[payload.holeId] = {
    id: payload.holeId,
    holeId: payload.holeId,
    type: 'hole',
    instrumentId: payload.instrumentId,
    appearanceIndex: payload.appearanceIndex,
    reason: payload.reason,
    status: 'active',
    played: false,
    locked: false,
    positionKey: payload.positionKey,
    positionInRound,
    roundOrder: positionInRound,
    orderScore: payload.appearanceIndex * 1_000_000 + positionInRound,
  };
}

export function getTargetEntity(state, target) {
  if (!target) return null;
  return target.type === 'appearance' ? state.appearances[target.id] : state.holes[target.id];
}
