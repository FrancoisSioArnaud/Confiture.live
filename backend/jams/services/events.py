EVENT_TYPES = {
    'jam_created','jam_metadata_updated','jam_link_reorder_strategy_changed',
    'instrument_added','instrument_updated','instrument_visibility_changed',
    'participant_created','participant_updated','participant_left','participation_added','participation_removed',
    'appearance_materialized','appearance_reordered','appearance_deleted','appearance_skipped',
    'hole_added','hole_removed','hole_reordered','link_created','link_removed','conflict_created','conflict_removed',
    'lock_added','lock_removed','plateau_played','transaction_reverted',
}


def is_allowed_event_type(event_type):
    return event_type in EVENT_TYPES
