from rest_framework.exceptions import ValidationError
from .events import ALLOWED_EVENT_TYPES

SUPPORTED_SCHEMA_VERSION = 1

PAYLOAD_REQUIRED_FIELDS = {
    "jam_created": {"jamId", "name", "indicativeDate", "linkReorderStrategy"},
    "jam_updated": set(),
    "jam_link_reorder_strategy_changed": {"previousStrategy", "nextStrategy"},
    "instrument_added": {"instrumentId", "label", "orderKey", "visible", "isDefault"},
    "instrument_updated": {"instrumentId", "label"},
    "instruments_reordered": {"orderedInstrumentIds"},
    "instrument_visibility_changed": {"instrumentId", "visible", "confirmedDespiteActiveLinks"},
    "instrument_round_visibility_changed": {"instrumentId", "visibleRoundCount"},
    "participant_created": {"participantId", "name"},
    "participant_updated": {"participantId", "name"},
    "participant_removed": {"participantId"},
    "participant_marked_left": {"participantId", "confirmedDespiteFutureLockedAppearances"},
    "participation_added": {"participationId", "participantId", "instrumentId", "customInstrumentLabel", "insertionMode", "startAppearanceIndex", "afterTarget", "beforeTarget", "baseOrderKey"},
    "participation_removed": {"participationId", "confirmedDespiteLinksOrLocks"},
    "appearance_materialized": {"appearanceId", "participationId", "instrumentId", "appearanceIndex", "positionKey"},
    "appearance_moved_between": {"appearanceId", "instrumentId", "afterTarget", "beforeTarget", "movedLinkedGroup"},
    "appearance_locked": {"appearanceId"},
    "appearance_unlocked": {"appearanceId"},
    "appearance_skipped": {"appearanceId", "instrumentId", "originalPlateauIndex", "replacement", "createdHoleId", "removedLinkIds", "confirmedDelink"},
    "appearance_removed": {"appearanceId", "confirmedDespiteLink"},
    "hole_added": {"holeId", "instrumentId", "appearanceIndex", "reason", "afterTarget", "beforeTarget", "positionKey"},
    "hole_removed": {"holeId", "confirmedDespiteLink"},
    "hole_moved_between": {"holeId", "instrumentId", "afterTarget", "beforeTarget", "movedLinkedGroup"},
    "hole_locked": {"holeId"},
    "hole_unlocked": {"holeId"},
    "link_created": {"linkId", "targets", "anchorTarget", "reorderStrategy"},
    "link_removed": {"linkId"},
    "conflict_created": {"conflictId", "scope", "targetIds", "reason", "anchorTargetId"},
    "conflict_removed": {"conflictId"},
    "plateau_played": {"plateauIndex", "targets", "playedAt"},
    "plateau_unplayed": {"plateauIndex", "targets"},
    "transaction_reverted": {"targetTransactionId", "targetClientSequenceNumber", "reason"},
}

ENUM_FIELDS = {
    "jam_created.linkReorderStrategy": {"move_to_first", "move_to_last", "average_position"},
    "jam_link_reorder_strategy_changed.previousStrategy": {"move_to_first", "move_to_last", "average_position"},
    "jam_link_reorder_strategy_changed.nextStrategy": {"move_to_first", "move_to_last", "average_position"},
    "participation_added.insertionMode": {"end_of_visible_rounds", "between_targets"},
    "hole_added.reason": {"manual", "play_without", "call_drawer_without_musician", "played_empty_slot"},
    "link_created.reorderStrategy": {"move_to_first", "move_to_last", "average_position"},
    "conflict_created.scope": {"participation", "appearance"},
    "conflict_created.reason": {"instrument_constraint", "manual"},
    "transaction_reverted.reason": {"organizer_undo"},
}


def validate_event_payload_shape(event_type, payload, field_name):
    required = PAYLOAD_REQUIRED_FIELDS.get(event_type)
    if required is None:
        return
    missing = sorted(required - set(payload.keys()))
    if missing:
        raise ValidationError({field_name: f"Missing required payload field(s): {', '.join(missing)}."})
    for key, allowed_values in ENUM_FIELDS.items():
        type_name, payload_key = key.split(".")
        if type_name == event_type and payload.get(payload_key) not in allowed_values:
            raise ValidationError({f"{field_name}.{payload_key}": "Unsupported value."})
    for target_key in ("afterTarget", "beforeTarget", "anchorTarget"):
        if target_key in payload and payload[target_key] is not None:
            validate_target(payload[target_key], f"{field_name}.{target_key}")
    if "targets" in payload:
        if not isinstance(payload["targets"], list):
            raise ValidationError({f"{field_name}.targets": "Must be an array."})
        for target_index, target in enumerate(payload["targets"]):
            validate_target(target, f"{field_name}.targets[{target_index}]")


def validate_target(value, field_name):
    if not isinstance(value, dict):
        raise ValidationError({field_name: "Must be an object."})
    if value.get("type") not in {"appearance", "hole"} or not value.get("id"):
        raise ValidationError({field_name: "Must contain type appearance/hole and id."})


def require_object(value, field_name):
    if not isinstance(value, dict):
        raise ValidationError({field_name: "Must be a JSON object."})
    return value


def validate_transaction_payload(jam_id, client_id, transaction):
    if not client_id:
        raise ValidationError({"clientId": "This field is required."})
    require_object(transaction, "transaction")

    transaction_id = transaction.get("transactionId")
    if not transaction_id:
        raise ValidationError({"transaction.transactionId": "This field is required."})

    tx_jam_id = transaction.get("jamId")
    if tx_jam_id and tx_jam_id != jam_id:
        raise ValidationError({"transaction.jamId": "Must match the URL jamId."})

    schema_version = transaction.get("schemaVersion")
    if schema_version != SUPPORTED_SCHEMA_VERSION:
        raise ValidationError({"transaction.schemaVersion": "Unsupported or missing schemaVersion."})

    client_sequence_number = transaction.get("clientSequenceNumber")
    if not isinstance(client_sequence_number, int) or client_sequence_number < 1:
        raise ValidationError({"transaction.clientSequenceNumber": "Must be a positive integer."})

    events = transaction.get("events")
    if not isinstance(events, list) or not events:
        raise ValidationError({"transaction.events": "Must be a non-empty array."})

    seen_event_ids = set()
    for index, event in enumerate(events):
        require_object(event, f"transaction.events[{index}]")
        event_id = event.get("eventId")
        if not event_id:
            raise ValidationError({f"transaction.events[{index}].eventId": "This field is required."})
        if event_id in seen_event_ids:
            raise ValidationError({f"transaction.events[{index}].eventId": "Duplicate eventId in transaction."})
        seen_event_ids.add(event_id)
        event_jam_id = event.get("jamId")
        if event_jam_id and event_jam_id != jam_id:
            raise ValidationError({f"transaction.events[{index}].jamId": "Must match the URL jamId."})
        event_type = event.get("type")
        if event_type not in ALLOWED_EVENT_TYPES:
            raise ValidationError({f"transaction.events[{index}].type": "Unsupported event type."})
        if not isinstance(event.get("payload"), dict):
            raise ValidationError({f"transaction.events[{index}].payload": "Must be a JSON object."})
        validate_event_payload_shape(event_type, event["payload"], f"transaction.events[{index}].payload")
        event_schema_version = event.get("schemaVersion", schema_version)
        if event_schema_version != SUPPORTED_SCHEMA_VERSION:
            raise ValidationError({f"transaction.events[{index}].schemaVersion": "Unsupported schemaVersion."})

    return {
        "transaction_id": transaction_id,
        "client_sequence_number": client_sequence_number,
        "schema_version": schema_version,
        "events": events,
    }
