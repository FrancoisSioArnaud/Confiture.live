import { z } from 'zod';
import { EVENT_TYPES } from '../../shared/constants/eventTypes';

export const SCHEMA_VERSION = 1;

const id = z.string().min(1);
const orderKey = z.string().min(1);
const isoDate = z.string().min(1);
const nullableTarget = z.union([z.object({ type: z.enum(['appearance', 'hole']), id }).strict(), z.null()]);
const target = z.object({ type: z.enum(['appearance', 'hole']), id }).strict();
const linkReorderStrategy = z.enum(['move_to_first', 'move_to_last', 'average_position']);
const insertionMode = z.enum(['end_of_visible_rounds', 'between_targets']);
const replacement = z.union([
  z.object({ mode: z.literal('appearance'), appearanceId: id }).strict(),
  z.object({ mode: z.literal('hole'), holeId: id }).strict(),
  z.object({ mode: z.literal('none') }).strict(),
]);

function event(type, schema, payload) {
  return { type, payload: schema.parse(payload) };
}

export function jamCreated(payload) {
  return event(EVENT_TYPES.JAM_CREATED, z.object({
    jamId: id,
    name: z.string().min(1),
    indicativeDate: isoDate,
    linkReorderStrategy,
  }).strict(), payload);
}

export function jamUpdated(payload) {
  return event(EVENT_TYPES.JAM_UPDATED, z.object({ name: z.string().min(1).optional(), indicativeDate: isoDate.optional() }).strict(), payload);
}

export function jamLinkReorderStrategyChanged(payload) {
  return event(EVENT_TYPES.JAM_LINK_REORDER_STRATEGY_CHANGED, z.object({ previousStrategy: linkReorderStrategy, nextStrategy: linkReorderStrategy }).strict(), payload);
}

export function instrumentAdded(payload) {
  return event(EVENT_TYPES.INSTRUMENT_ADDED, z.object({ instrumentId: id, label: z.string().min(1), orderKey, visible: z.boolean(), isDefault: z.boolean() }).strict(), payload);
}

export function instrumentUpdated(payload) {
  return event(EVENT_TYPES.INSTRUMENT_UPDATED, z.object({ instrumentId: id, label: z.string().min(1) }).strict(), payload);
}

export function instrumentsReordered(payload) {
  return event(EVENT_TYPES.INSTRUMENTS_REORDERED, z.object({ orderedInstrumentIds: z.array(id).min(1) }).strict(), payload);
}

export function instrumentVisibilityChanged(payload) {
  return event(EVENT_TYPES.INSTRUMENT_VISIBILITY_CHANGED, z.object({ instrumentId: id, visible: z.boolean(), confirmedDespiteActiveLinks: z.boolean() }).strict(), payload);
}

export function instrumentRoundVisibilityChanged(payload) {
  return event(EVENT_TYPES.INSTRUMENT_ROUND_VISIBILITY_CHANGED, z.object({ instrumentId: id, visibleRoundCount: z.number().int().positive() }).strict(), payload);
}

export function participantCreated(payload) {
  return event(EVENT_TYPES.PARTICIPANT_CREATED, z.object({ participantId: id, name: z.string().min(1) }).strict(), payload);
}

export function participantUpdated(payload) {
  return event(EVENT_TYPES.PARTICIPANT_UPDATED, z.object({ participantId: id, name: z.string().min(1) }).strict(), payload);
}

export function participantRemoved(payload) {
  return event(EVENT_TYPES.PARTICIPANT_REMOVED, z.object({ participantId: id }).strict(), payload);
}

export function participantMarkedLeft(payload) {
  return event(EVENT_TYPES.PARTICIPANT_MARKED_LEFT, z.object({ participantId: id, confirmedDespiteFutureLockedAppearances: z.boolean() }).strict(), payload);
}

export function participationAdded(payload) {
  return event(EVENT_TYPES.PARTICIPATION_ADDED, z.object({
    participationId: id,
    participantId: id,
    instrumentId: id,
    customInstrumentLabel: z.string().min(1).nullable(),
    insertionMode,
    startAppearanceIndex: z.number().int().positive(),
    afterTarget: nullableTarget,
    beforeTarget: nullableTarget,
    baseOrderKey: orderKey,
  }).strict(), payload);
}

export function participationRemoved(payload) {
  return event(EVENT_TYPES.PARTICIPATION_REMOVED, z.object({ participationId: id, confirmedDespiteLinksOrLocks: z.boolean() }).strict(), payload);
}

export function appearanceMaterialized(payload) {
  return event(EVENT_TYPES.APPEARANCE_MATERIALIZED, z.object({ appearanceId: id, participationId: id, instrumentId: id, appearanceIndex: z.number().int().positive(), positionKey: orderKey }).strict(), payload);
}

export function appearanceMovedBetween(payload) {
  return event(EVENT_TYPES.APPEARANCE_MOVED_BETWEEN, z.object({ appearanceId: id, instrumentId: id, afterTarget: nullableTarget, beforeTarget: nullableTarget, movedLinkedGroup: z.boolean() }).strict(), payload);
}

export function appearanceRemoved(payload) {
  return event(EVENT_TYPES.APPEARANCE_REMOVED, z.object({ appearanceId: id, confirmedDespiteLink: z.boolean() }).strict(), payload);
}

export function appearanceLocked(payload) {
  return event(EVENT_TYPES.APPEARANCE_LOCKED, z.object({ appearanceId: id }).strict(), payload);
}

export function appearanceUnlocked(payload) {
  return event(EVENT_TYPES.APPEARANCE_UNLOCKED, z.object({ appearanceId: id }).strict(), payload);
}

export function appearanceSkipped(payload) {
  return event(EVENT_TYPES.APPEARANCE_SKIPPED, z.object({
    appearanceId: id,
    instrumentId: id,
    originalPlateauIndex: z.number().int().nonnegative(),
    replacement,
    createdHoleId: id.nullable(),
    removedLinkIds: z.array(id),
    confirmedDelink: z.boolean(),
  }).strict(), payload);
}

export function holeAdded(payload) {
  return event(EVENT_TYPES.HOLE_ADDED, z.object({
    holeId: id,
    instrumentId: id,
    appearanceIndex: z.number().int().positive(),
    reason: z.enum(['manual', 'play_without', 'call_drawer_without_musician']),
    afterTarget: nullableTarget,
    beforeTarget: nullableTarget,
    positionKey: orderKey,
  }).strict(), payload);
}

export function holeRemoved(payload) {
  return event(EVENT_TYPES.HOLE_REMOVED, z.object({ holeId: id, confirmedDespiteLink: z.boolean() }).strict(), payload);
}

export function holeMovedBetween(payload) {
  return event(EVENT_TYPES.HOLE_MOVED_BETWEEN, z.object({ holeId: id, instrumentId: id, afterTarget: nullableTarget, beforeTarget: nullableTarget, movedLinkedGroup: z.boolean() }).strict(), payload);
}

export function holeLocked(payload) {
  return event(EVENT_TYPES.HOLE_LOCKED, z.object({ holeId: id }).strict(), payload);
}

export function holeUnlocked(payload) {
  return event(EVENT_TYPES.HOLE_UNLOCKED, z.object({ holeId: id }).strict(), payload);
}

export function linkCreated(payload) {
  return event(EVENT_TYPES.LINK_CREATED, z.object({ linkId: id, targets: z.array(target).min(2), anchorTarget: target, reorderStrategy: linkReorderStrategy }).strict(), payload);
}

export function linkRemoved(payload) {
  return event(EVENT_TYPES.LINK_REMOVED, z.object({ linkId: id }).strict(), payload);
}

export function conflictCreated(payload) {
  return event(EVENT_TYPES.CONFLICT_CREATED, z.object({ conflictId: id, scope: z.enum(['participation', 'appearance']), targetIds: z.array(id).min(2), reason: z.enum(['instrument_constraint', 'manual']), anchorTargetId: id }).strict(), payload);
}

export function conflictRemoved(payload) {
  return event(EVENT_TYPES.CONFLICT_REMOVED, z.object({ conflictId: id }).strict(), payload);
}

export function plateauPlayed(payload) {
  return event(EVENT_TYPES.PLATEAU_PLAYED, z.object({ plateauIndex: z.number().int().nonnegative(), targets: z.array(target), playedAt: isoDate }).strict(), payload);
}

export function plateauUnplayed(payload) {
  return event(EVENT_TYPES.PLATEAU_UNPLAYED, z.object({ plateauIndex: z.number().int().nonnegative(), targets: z.array(target) }).strict(), payload);
}

export function transactionReverted(payload) {
  return event(EVENT_TYPES.TRANSACTION_REVERTED, z.object({ targetTransactionId: id, targetClientSequenceNumber: z.number().int().positive(), reason: z.literal('organizer_undo') }).strict(), payload);
}
