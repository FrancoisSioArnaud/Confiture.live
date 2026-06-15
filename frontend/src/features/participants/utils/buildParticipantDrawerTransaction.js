import { z } from 'zod';
import {
  conflictCreated,
  participantCreated,
  participantUpdated,
  participationAdded,
  participationRemoved,
} from '../../transactions/eventFactories';
import { createTransaction } from '../../transactions/createTransaction';
import { createId } from '../../../shared/utils/createId';

const participantDraftSchema = z.object({
  name: z.string().trim().min(1, 'Nom requis'),
  selectedInstrumentIds: z.array(z.string().min(1)).min(1, 'Sélectionne au moins un instrument'),
  customInstrumentLabels: z.record(z.string()).default({}),
}).strict();

function toTarget(card) {
  if (!card) return null;
  return { type: card.type, id: card.id };
}

function baseParticipationPayload({ participationId, participantId, instrumentId, customInstrumentLabel, insertionContext }) {
  return {
    participationId,
    participantId,
    instrumentId,
    customInstrumentLabel: customInstrumentLabel || null,
    insertionMode: insertionContext?.afterCard || insertionContext?.beforeCard ? 'between_targets' : 'end_of_visible_rounds',
    startAppearanceIndex: insertionContext?.appearanceIndex ?? 1,
    afterTarget: toTarget(insertionContext?.afterCard ?? null),
    beforeTarget: toTarget(insertionContext?.beforeCard ?? null),
    baseOrderKey: `position_${participationId}`,
  };
}

function addInstrumentConstraintConflicts(events, participationIds) {
  participationIds.forEach((leftId, leftIndex) => {
    participationIds.slice(leftIndex + 1).forEach((rightId) => {
      events.push(conflictCreated({
        conflictId: createId('conflict'),
        scope: 'participation',
        targetIds: [leftId, rightId],
        reason: 'instrument_constraint',
        anchorTargetId: leftId,
      }));
    });
  });
}

export function validateParticipantDraft({ draft, projection, participantId = null, instruments }) {
  const parsed = participantDraftSchema.safeParse(draft);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Formulaire invalide' };
  const name = parsed.data.name.trim();
  const duplicate = Object.values(projection.participants ?? {}).some((participant) => participant.status !== 'removed' && participant.participantId !== participantId && participant.name.trim() === name);
  if (duplicate) return { ok: false, error: 'Un musicien porte déjà ce nom dans cette jam.' };
  const selectedOtherInstrument = instruments.find((instrument) => parsed.data.selectedInstrumentIds.includes(instrument.instrumentId) && instrument.label.trim().toLowerCase() === 'autre');
  if (selectedOtherInstrument && !parsed.data.customInstrumentLabels[selectedOtherInstrument.instrumentId]?.trim()) return { ok: false, error: 'Précise l’instrument “Autre”.' };
  return { ok: true, draft: { ...parsed.data, name } };
}

export function buildCreateParticipantTransaction({ jamId, clientId, clientSequenceNumber, projection, draft, instruments, insertionContext = null }) {
  const validation = validateParticipantDraft({ draft, projection, instruments });
  if (!validation.ok) return validation;
  const participantId = createId('participant');
  const events = [participantCreated({ participantId, name: validation.draft.name })];
  const participationIds = validation.draft.selectedInstrumentIds.map((instrumentId) => {
    const participationId = createId('participation');
    events.push(participationAdded(baseParticipationPayload({
      participationId,
      participantId,
      instrumentId,
      customInstrumentLabel: validation.draft.customInstrumentLabels[instrumentId]?.trim() || null,
      insertionContext,
    })));
    return participationId;
  });
  addInstrumentConstraintConflicts(events, participationIds);
  return { ok: true, transaction: createTransaction({ jamId, clientId, clientSequenceNumber, label: 'Créer participant', events }) };
}

export function buildEditParticipantTransaction({ jamId, clientId, clientSequenceNumber, projection, participantId, draft, instruments, confirmedRemovedParticipationIds = [], insertionContext = null }) {
  const validation = validateParticipantDraft({ draft, projection, participantId, instruments });
  if (!validation.ok) return validation;
  const participant = projection.participants[participantId];
  const activeParticipations = Object.values(projection.participations ?? {}).filter((participation) => participation.participantId === participantId && participation.status === 'active');
  const activeByInstrument = new Map(activeParticipations.map((participation) => [participation.instrumentId, participation]));
  const selected = new Set(validation.draft.selectedInstrumentIds);
  const events = [];
  if (participant?.name !== validation.draft.name) events.push(participantUpdated({ participantId, name: validation.draft.name }));

  const addedParticipationIds = [];
  validation.draft.selectedInstrumentIds.forEach((instrumentId) => {
    if (!activeByInstrument.has(instrumentId)) {
      const participationId = createId('participation');
      addedParticipationIds.push(participationId);
      events.push(participationAdded(baseParticipationPayload({
        participationId,
        participantId,
        instrumentId,
        customInstrumentLabel: validation.draft.customInstrumentLabels[instrumentId]?.trim() || null,
        insertionContext,
      })));
    }
  });

  activeParticipations.filter((participation) => !selected.has(participation.instrumentId)).forEach((participation) => {
    events.push(participationRemoved({ participationId: participation.participationId, confirmedDespiteLinksOrLocks: confirmedRemovedParticipationIds.includes(participation.participationId) }));
  });

  const keptParticipationIds = activeParticipations.filter((participation) => selected.has(participation.instrumentId)).map((participation) => participation.participationId);
  addedParticipationIds.forEach((addedId, index) => {
    [...keptParticipationIds, ...addedParticipationIds.slice(index + 1)].forEach((otherId) => {
      events.push(conflictCreated({
        conflictId: createId('conflict'),
        scope: 'participation',
        targetIds: [addedId, otherId],
        reason: 'instrument_constraint',
        anchorTargetId: addedId,
      }));
    });
  });
  if (events.length === 0) return { ok: true, transaction: null };
  return { ok: true, transaction: createTransaction({ jamId, clientId, clientSequenceNumber, label: 'Modifier participant', events }) };
}

export function impactedRemovedParticipations({ projection, participantId, selectedInstrumentIds }) {
  const selected = new Set(selectedInstrumentIds);
  return Object.values(projection.participations ?? {}).filter((participation) => participation.participantId === participantId && participation.status === 'active' && !selected.has(participation.instrumentId)).filter((participation) => {
    const appearances = Object.values(projection.appearances ?? {}).filter((appearance) => appearance.participationId === participation.participationId && appearance.status !== 'removed');
    const hasLink = Object.values(projection.links ?? {}).some((link) => link.status === 'active' && link.targets.some((target) => appearances.some((appearance) => target.type === 'appearance' && target.id === appearance.appearanceId)));
    return appearances.length > 0 || hasLink || appearances.some((appearance) => appearance.locked || appearance.played);
  });
}
