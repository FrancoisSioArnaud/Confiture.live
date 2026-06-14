import { orderItems } from './ordering.js';
import { decorateCardState } from './selectors.js';

function isParticipantActiveForFuture(state, participantId) {
  const participant = state.participants[participantId];
  return Boolean(participant && participant.removed !== true && participant.presenceStatus !== 'left');
}

function calculatedAppearanceId(participationId, appearanceIndex) {
  return `calculated:${participationId}:${appearanceIndex}`;
}

function calculatedAppearancesFor(state, instrumentId) {
  const visibleRoundCount = state.instruments[instrumentId]?.visibleRoundCount ?? 1;
  return Object.values(state.participations)
    .filter((participation) => !participation.removed && participation.instrumentId === instrumentId && isParticipantActiveForFuture(state, participation.participantId))
    .flatMap((participation, participationIndex) => {
      const startAppearanceIndex = participation.startAppearanceIndex ?? 1;
      return Array.from({ length: Math.max(0, visibleRoundCount - startAppearanceIndex + 1) }, (_, offset) => {
        const appearanceIndex = startAppearanceIndex + offset;
        return {
          type: 'appearance',
          appearanceId: calculatedAppearanceId(participation.participationId, appearanceIndex),
          participationId: participation.participationId,
          participantId: participation.participantId,
          instrumentId,
          appearanceIndex,
          orderKey: `${appearanceIndex}:${participation.baseOrderKey ?? participationIndex}`,
          positionKey: `${appearanceIndex}:${participation.baseOrderKey ?? participationIndex}`,
          isCalculated: true,
        };
      });
    });
}

function materializedAppearancesFor(state, instrumentId) {
  return Object.values(state.appearances)
    .filter((appearance) => appearance.instrumentId === instrumentId && !appearance.removed && !appearance.skipped)
    .map((appearance) => ({ type: 'appearance', ...appearance, isCalculated: false }));
}

function holesFor(state, instrumentId) {
  return Object.values(state.holes)
    .filter((hole) => hole.instrumentId === instrumentId && !hole.removed)
    .map((hole) => ({ type: 'hole', ...hole }));
}

function materializedKey(appearance) {
  return `${appearance.participationId}:${appearance.appearanceIndex}`;
}

export function buildColumns(state) {
  const columns = {};
  const visibleInstrumentIds = state.instrumentOrder.filter((instrumentId) => state.instruments[instrumentId]?.isVisible !== false);

  for (const instrumentId of visibleInstrumentIds) {
    const materialized = materializedAppearancesFor(state, instrumentId);
    const materializedKeys = new Set(materialized.map(materializedKey));
    const calculated = calculatedAppearancesFor(state, instrumentId).filter((appearance) => !materializedKeys.has(materializedKey(appearance)));
    columns[instrumentId] = orderItems([...calculated, ...materialized, ...holesFor(state, instrumentId)]).map((item) => decorateCardState(state, item));
  }

  return columns;
}

export function buildPlateaus(columns, instrumentOrder) {
  const max = Math.max(0, ...Object.values(columns).map((items) => items.length));
  return Array.from({ length: max }, (_, index) => ({
    index: index + 1,
    cells: Object.fromEntries(instrumentOrder.filter((instrumentId) => columns[instrumentId]).map((instrumentId) => [instrumentId, columns[instrumentId][index] ?? null])),
  }));
}
