import { stableOrderValue } from './ordering';

export function ensureVisibleRoundCount(state, instrumentId) {
  if (!state.visibleRoundsByInstrument[instrumentId]) state.visibleRoundsByInstrument[instrumentId] = 1;
}

export function materializeCalculatedAppearances(state) {
  Object.values(state.participations).forEach((participation) => {
    if (participation.status !== 'active') return;
    const participant = state.participants[participation.participantId];
    if (!participant || participant.status === 'removed' || participant.status === 'left') return;
    ensureVisibleRoundCount(state, participation.instrumentId);
    const visibleRoundCount = state.visibleRoundsByInstrument[participation.instrumentId];
    for (let index = participation.startAppearanceIndex; index <= visibleRoundCount; index += 1) {
      const appearanceId = `appearance_${participation.participationId}_${index}`;
      if (!state.appearances[appearanceId]) {
        const positionInRound = stableOrderValue(participation.baseOrderKey);
        state.appearances[appearanceId] = {
          id: appearanceId,
          appearanceId,
          type: 'appearance',
          participationId: participation.participationId,
          participantId: participation.participantId,
          instrumentId: participation.instrumentId,
          appearanceIndex: index,
          status: 'active',
          played: false,
          locked: false,
          materialized: false,
          positionKey: `${participation.baseOrderKey}:${index}`,
          positionInRound,
          roundOrder: positionInRound,
          orderScore: index * 1_000_000 + positionInRound,
        };
      }
    }
  });
}
