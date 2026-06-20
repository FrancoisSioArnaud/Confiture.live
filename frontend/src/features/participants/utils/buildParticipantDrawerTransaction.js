import { z } from 'zod';
import {
  appearanceMaterialized,
  conflictCreated,
  conflictRemoved,
  linkCreated,
  linkRemoved,
  participantCreated,
  participantUpdated,
  participationAdded,
  participationRemoved,
} from '../../transactions/eventFactories';
import { createTransaction } from '../../transactions/createTransaction';
import { createId } from '../../../shared/utils/createId';

const participantDraftSchema = z.object({
  name: z.string().trim().min(1, 'Nom requis'),
  selectedInstrumentIds: z.array(z.string().min(1)).min(1, 'Au moins un instrument doit être sélectionné.'),
  initialLinkedInstrumentPairs: z.array(z.string()).default([]),
  customInstrumentLabels: z.record(z.string()).default({}),
}).strict();

function nextBaseOrderKey(projection, instrumentId) {
  const activeParticipations = Object.values(projection.participations ?? {})
    .filter((participation) => (
      participation.instrumentId === instrumentId
      && participation.status === 'active'
    ));

  const numericOrders = activeParticipations
    .map((participation) => {
      const match = String(participation.baseOrderKey ?? '').match(/(-?\d+(?:\.\d+)?)/);
      return match ? Number(match[1]) : null;
    })
    .filter((value) => Number.isFinite(value));

  const nextOrder = numericOrders.length > 0 ? Math.max(...numericOrders) + 1 : activeParticipations.length;

  return `order_${nextOrder}`;
}

function baseParticipationPayload({ projection, participationId, participantId, instrumentId, customInstrumentLabel }) {
  return {
    participationId,
    participantId,
    instrumentId,
    customInstrumentLabel: customInstrumentLabel || null,
    insertionMode: 'end_of_visible_rounds',
    startAppearanceIndex: 1,
    afterTarget: null,
    beforeTarget: null,
    baseOrderKey: nextBaseOrderKey(projection, instrumentId),
  };
}
function pairKey(leftInstrumentId, rightInstrumentId) {
  return [leftInstrumentId, rightInstrumentId].sort().join('__');
}

function appearanceIdFor(participationId, appearanceIndex) {
  return `appearance_${participationId}_${appearanceIndex}`;
}

function addAppearanceMaterialized(events, participation, appearanceIndex = 1) {
  events.push(appearanceMaterialized({
    appearanceId: appearanceIdFor(participation.participationId, appearanceIndex),
    participationId: participation.participationId,
    instrumentId: participation.instrumentId,
    appearanceIndex,
    positionKey: `${participation.baseOrderKey}:${appearanceIndex}`,
  }));
}

function findActiveInstrumentConstraintConflict(projection, leftId, rightId) {
  return Object.values(projection.conflicts ?? {}).find((conflict) => conflict.status === 'active' && conflict.reason === 'instrument_constraint' && conflict.scope === 'participation' && conflict.targetIds?.includes(leftId) && conflict.targetIds?.includes(rightId));
}

function hasActiveConflict(projection, leftId, rightId) {
  return Boolean(findActiveInstrumentConstraintConflict(projection, leftId, rightId));
}

function editableInstrumentIdSet(instruments) {
  return new Set(instruments.map((instrument) => instrument.instrumentId));
}

function findActiveFirstAppearanceLink(projection, leftAppearanceId, rightAppearanceId) {
  return Object.values(projection.links ?? {}).find((link) => link.status === 'active' && link.targets?.some((target) => target.type === 'appearance' && target.id === leftAppearanceId) && link.targets?.some((target) => target.type === 'appearance' && target.id === rightAppearanceId));
}

function addInitialPairEvents(events, { projection, participations, linkedPairKeys, linkReorderStrategy }) {
  participations.forEach((left, leftIndex) => {
    participations.slice(leftIndex + 1).forEach((right) => {
      const isLinked = linkedPairKeys.has(pairKey(left.instrumentId, right.instrumentId));
      const leftAppearanceId = appearanceIdFor(left.participationId, left.startAppearanceIndex ?? 1);
      const rightAppearanceId = appearanceIdFor(right.participationId, right.startAppearanceIndex ?? 1);
      const existingLink = findActiveFirstAppearanceLink(projection, leftAppearanceId, rightAppearanceId);
      if (isLinked) {
        const existingConflict = findActiveInstrumentConstraintConflict(projection, left.participationId, right.participationId);
        if (existingConflict) events.push(conflictRemoved({ conflictId: existingConflict.conflictId }));
        if (!projection.appearances?.[leftAppearanceId]) addAppearanceMaterialized(events, left, left.startAppearanceIndex ?? 1);
        if (!projection.appearances?.[rightAppearanceId]) addAppearanceMaterialized(events, right, right.startAppearanceIndex ?? 1);
        if (!existingLink) {
          events.push(linkCreated({
            linkId: createId('link'),
            targets: [{ type: 'appearance', id: leftAppearanceId }, { type: 'appearance', id: rightAppearanceId }],
            reorderStrategy: linkReorderStrategy,
          }));
        }
      } else {
        if (existingLink) events.push(linkRemoved({ linkId: existingLink.linkId }));
        if (!hasActiveConflict(projection, left.participationId, right.participationId)) {
          events.push(conflictCreated({
            conflictId: createId('conflict'),
            scope: 'participation',
            targetIds: [left.participationId, right.participationId].sort((a, b) => a.localeCompare(b)),
            reason: 'instrument_constraint',
          }));
        }
      }
    });
  });
}

export function findDuplicateParticipantByName(projection, name, participantId = null) {
  const normalizedName = String(name ?? '').trim().toLowerCase();
  if (!normalizedName) return null;
  return Object.values(projection.participants ?? {}).find((participant) => (
    participant.status !== 'removed'
    && participant.participantId !== participantId
    && String(participant.name ?? '').trim().toLowerCase() === normalizedName
  )) ?? null;
}

export function activeInstrumentIdsForParticipant(projection, participantId) {
  return Object.values(projection.participations ?? {})
    .filter((participation) => participation.participantId === participantId && participation.status === 'active')
    .map((participation) => participation.instrumentId);
}

export function missingInstrumentIdsForParticipant(projection, participantId, selectedInstrumentIds) {
  const existing = new Set(activeInstrumentIdsForParticipant(projection, participantId));
  return selectedInstrumentIds.filter((instrumentId) => !existing.has(instrumentId));
}

export function validateParticipantDraft({ draft, projection, participantId = null, instruments, allowDuplicateName = false }) {
  const parsed = participantDraftSchema.safeParse(draft);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Formulaire invalide' };
  const name = parsed.data.name.trim();
  const duplicateParticipant = findDuplicateParticipantByName(projection, name, participantId);
  if (duplicateParticipant && !allowDuplicateName) return { ok: false, error: 'Un musicien porte déjà ce nom dans cette jam.', duplicateParticipant };
  const selectedOtherInstrument = instruments.find((instrument) => parsed.data.selectedInstrumentIds.includes(instrument.instrumentId) && instrument.label.trim().toLowerCase() === 'autre');
  if (selectedOtherInstrument && !parsed.data.customInstrumentLabels[selectedOtherInstrument.instrumentId]?.trim()) return { ok: false, error: 'Précise l’instrument “Autre”.' };
  return { ok: true, draft: { ...parsed.data, name, initialLinkedInstrumentPairs: parsed.data.initialLinkedInstrumentPairs ?? [] } };
}

export function buildCreateParticipantTransaction({ jamId, clientId, clientSequenceNumber, projection, draft, instruments }) {
  const validation = validateParticipantDraft({ draft, projection, instruments });
  if (!validation.ok) return validation;
  const participantId = createId('participant');
  const events = [participantCreated({ participantId, name: validation.draft.name })];
  const participations = validation.draft.selectedInstrumentIds.map((instrumentId) => {
    const participationId = createId('participation');
    const payload = baseParticipationPayload({
      projection,
      participationId,
      participantId,
      instrumentId,
      customInstrumentLabel: validation.draft.customInstrumentLabels[instrumentId]?.trim() || null,
    });
    events.push(participationAdded(payload));
    return payload;
  });
  addInitialPairEvents(events, { projection, participations, linkedPairKeys: new Set(validation.draft.initialLinkedInstrumentPairs), linkReorderStrategy: projection.jam?.linkReorderStrategy ?? 'move_to_last' });
  return { ok: true, transaction: createTransaction({ jamId, clientId, clientSequenceNumber, label: 'Créer participant', events }) };
}

export function buildEditParticipantTransaction({ jamId, clientId, clientSequenceNumber, projection, participantId, draft, instruments, confirmedRemovedParticipationIds = [] }) {
  const validation = validateParticipantDraft({ draft, projection, participantId, instruments });
  if (!validation.ok) return validation;
  const participant = projection.participants[participantId];
  const activeParticipations = Object.values(projection.participations ?? {}).filter((participation) => participation.participantId === participantId && participation.status === 'active');
  const editableInstrumentIds = editableInstrumentIdSet(instruments);
  const editableActiveParticipations = activeParticipations.filter((participation) => editableInstrumentIds.has(participation.instrumentId));
  const activeByInstrument = new Map(editableActiveParticipations.map((participation) => [participation.instrumentId, participation]));
  const selected = new Set(validation.draft.selectedInstrumentIds);
  const addedInstrumentIds = validation.draft.selectedInstrumentIds.filter((instrumentId) => !activeByInstrument.has(instrumentId));
  if (participant?.status === 'left' && addedInstrumentIds.length > 0) return { ok: false, error: 'Impossible d’ajouter un instrument à un musicien marqué parti.' };

  const impactedRemovals = impactedRemovedParticipations({ projection, participantId, selectedInstrumentIds: validation.draft.selectedInstrumentIds, instruments });
  const unconfirmedImpactedRemovals = impactedRemovals.filter((participation) => !confirmedRemovedParticipationIds.includes(participation.participationId));
  if (unconfirmedImpactedRemovals.length > 0) return { ok: false, error: 'Confirmation requise pour retirer cet instrument.' };

  const events = [];
  if (participant?.name !== validation.draft.name) events.push(participantUpdated({ participantId, name: validation.draft.name }));

  validation.draft.selectedInstrumentIds.forEach((instrumentId) => {
    if (!activeByInstrument.has(instrumentId)) {
      const participationId = createId('participation');
      const payload = baseParticipationPayload({
        projection,
        participationId,
        participantId,
        instrumentId,
        customInstrumentLabel: validation.draft.customInstrumentLabels[instrumentId]?.trim() || null,
      });
      events.push(participationAdded(payload));
    }
  });

  editableActiveParticipations.filter((participation) => !selected.has(participation.instrumentId)).forEach((participation) => {
    events.push(participationRemoved({ participationId: participation.participationId, confirmedDespiteLinksOrLocks: confirmedRemovedParticipationIds.includes(participation.participationId) }));
  });

  const selectedParticipations = validation.draft.selectedInstrumentIds.map((instrumentId) => {
    const existing = activeByInstrument.get(instrumentId);
    if (existing) return existing;
    const addedEvent = events.find((event) => event.type === 'participation_added' && event.payload.instrumentId === instrumentId);
    return addedEvent?.payload;
  }).filter(Boolean);
  const removedEditableParticipationIds = editableActiveParticipations.filter((participation) => !selected.has(participation.instrumentId)).map((participation) => participation.participationId);
  const conflictsToRemove = Object.values(projection.conflicts ?? {}).filter((conflict) => conflict.status === 'active' && conflict.reason === 'instrument_constraint' && conflict.scope === 'participation' && conflict.targetIds?.some((id) => removedEditableParticipationIds.includes(id)));
  conflictsToRemove.forEach((conflict) => events.push(conflictRemoved({ conflictId: conflict.conflictId })));
  addInitialPairEvents(events, { projection, participations: selectedParticipations, linkedPairKeys: new Set(validation.draft.initialLinkedInstrumentPairs), linkReorderStrategy: projection.jam?.linkReorderStrategy ?? 'move_to_last' });
  if (events.length === 0) return { ok: true, transaction: null };
  return { ok: true, transaction: createTransaction({ jamId, clientId, clientSequenceNumber, label: 'Modifier participant', events }) };
}

export function buildAddInstrumentsToExistingParticipantTransaction({ jamId, clientId, clientSequenceNumber, projection, existingParticipantId, draft, instruments }) {
  const participant = projection.participants?.[existingParticipantId];
  if (!participant || participant.status === 'removed') return { ok: false, error: 'Participant existant introuvable.' };
  const validation = validateParticipantDraft({ draft: { ...draft, name: participant.name }, projection, participantId: existingParticipantId, instruments, allowDuplicateName: true });
  if (!validation.ok) return validation;
  const editableInstrumentIds = editableInstrumentIdSet(instruments);
  const existingInstrumentIds = activeInstrumentIdsForParticipant(projection, existingParticipantId).filter((instrumentId) => editableInstrumentIds.has(instrumentId));
  const mergedInstrumentIds = [...new Set([...existingInstrumentIds, ...validation.draft.selectedInstrumentIds])]
    .sort((left, right) => instruments.findIndex((instrument) => instrument.instrumentId === left) - instruments.findIndex((instrument) => instrument.instrumentId === right));
  const missingInstrumentIds = missingInstrumentIdsForParticipant(projection, existingParticipantId, validation.draft.selectedInstrumentIds);
  if (missingInstrumentIds.length === 0) return { ok: false, error: 'Ce musicien joue déjà les instruments sélectionnés.' };
  return buildEditParticipantTransaction({
    jamId,
    clientId,
    clientSequenceNumber,
    projection,
    participantId: existingParticipantId,
    instruments,
    confirmedRemovedParticipationIds: [],
    draft: {
      ...validation.draft,
      name: participant.name,
      selectedInstrumentIds: mergedInstrumentIds,
      initialLinkedInstrumentPairs: validation.draft.initialLinkedInstrumentPairs ?? [],
    },
  });
}

export function impactedRemovedParticipations({ projection, participantId, selectedInstrumentIds, instruments = null }) {
  const selected = new Set(selectedInstrumentIds);
  const editableInstrumentIds = instruments ? editableInstrumentIdSet(instruments) : null;
  return Object.values(projection.participations ?? {}).filter((participation) => participation.participantId === participantId && participation.status === 'active' && !selected.has(participation.instrumentId) && (!editableInstrumentIds || editableInstrumentIds.has(participation.instrumentId))).filter((participation) => {
    const appearances = Object.values(projection.appearances ?? {}).filter((appearance) => appearance.participationId === participation.participationId && appearance.status !== 'removed');
    const hasLink = Object.values(projection.links ?? {}).some((link) => link.status === 'active' && link.targets.some((target) => appearances.some((appearance) => target.type === 'appearance' && target.id === appearance.appearanceId)));
    return appearances.length > 0 || hasLink || appearances.some((appearance) => appearance.locked || appearance.played);
  });
}
