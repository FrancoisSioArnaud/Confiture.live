export const EVENT_TYPES = Object.freeze({
  JAM_CREATED: 'jam_created',
  JAM_UPDATED: 'jam_updated',
  INSTRUMENT_ADDED: 'instrument_added',
  INSTRUMENT_UPDATED: 'instrument_updated',
  INSTRUMENTS_REORDERED: 'instruments_reordered',
  INSTRUMENT_VISIBILITY_CHANGED: 'instrument_visibility_changed',
  JAM_LINK_REORDER_STRATEGY_CHANGED: 'jam_link_reorder_strategy_changed',
  PARTICIPANT_CREATED: 'participant_created',
  PARTICIPANT_UPDATED: 'participant_updated',
  PARTICIPANT_REMOVED: 'participant_removed',
  PARTICIPANT_MARKED_LEFT: 'participant_marked_left',
  PARTICIPATION_ADDED: 'participation_added',
  PARTICIPATION_REMOVED: 'participation_removed',
  APPEARANCE_MATERIALIZED: 'appearance_materialized',
  APPEARANCE_MOVED_BETWEEN: 'appearance_moved_between',
  APPEARANCE_REMOVED: 'appearance_removed',
  APPEARANCE_LOCKED: 'appearance_locked',
  APPEARANCE_UNLOCKED: 'appearance_unlocked',
  APPEARANCE_SKIPPED: 'appearance_skipped',
  HOLE_ADDED: 'hole_added',
  HOLE_REMOVED: 'hole_removed',
  HOLE_MOVED_BETWEEN: 'hole_moved_between',
  HOLE_LOCKED: 'hole_locked',
  HOLE_UNLOCKED: 'hole_unlocked',
  LINK_CREATED: 'link_created',
  LINK_REMOVED: 'link_removed',
  CONFLICT_CREATED: 'conflict_created',
  CONFLICT_REMOVED: 'conflict_removed',
  INSTRUMENT_ROUND_VISIBILITY_CHANGED: 'instrument_round_visibility_changed',
  PLATEAU_PLAYED: 'plateau_played',
  PLATEAU_UNPLAYED: 'plateau_unplayed',
  TRANSACTION_REVERTED: 'transaction_reverted',
});

export const ALLOWED_EVENT_TYPES = Object.freeze(Object.values(EVENT_TYPES));

export const FORBIDDEN_EVENT_TYPES = Object.freeze([
  'play_without_created',
  'play_without_removed',
  'link_updated',
  'conflict_updated',
  'participation_note',
  'appearance_note',
  'participation_note_updated',
  'appearance_note_updated',
  'temporarily_away',
]);

export function isAllowedEventType(type) {
  return ALLOWED_EVENT_TYPES.includes(type);
}

export function assertAllowedEventType(type) {
  if (!isAllowedEventType(type) || FORBIDDEN_EVENT_TYPES.includes(type)) {
    throw new Error(`Unsupported Confiture V0 event type: ${type}`);
  }
}
