from rest_framework.exceptions import ValidationError
from .events import ALLOWED_EVENT_TYPES

SUPPORTED_SCHEMA_VERSION = 1


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
        event_schema_version = event.get("schemaVersion", schema_version)
        if event_schema_version != SUPPORTED_SCHEMA_VERSION:
            raise ValidationError({f"transaction.events[{index}].schemaVersion": "Unsupported schemaVersion."})

    return {
        "transaction_id": transaction_id,
        "client_sequence_number": client_sequence_number,
        "schema_version": schema_version,
        "events": events,
    }
