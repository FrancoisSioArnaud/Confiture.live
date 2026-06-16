from django.db import transaction as db_transaction
from rest_framework.exceptions import APIException, ValidationError
from jams.models import JamEvent, JamTransaction
from .validation import validate_transaction_payload
from .sessions import assert_active_lease


class ClientSequenceConflict(APIException):
    status_code = 409
    default_code = "client_sequence_conflict"

    def __init__(self, detail=None, code=None):
        # Keep numeric values as JSON numbers. APIException.__init__ wraps
        # nested values as ErrorDetail strings, which breaks sequence clients.
        self.detail = detail or {"error": self.default_code}



def serialize_event(event):
    return {
        "eventId": event.event_id,
        "transactionId": event.transaction.transaction_id,
        "type": event.type,
        "payload": event.payload,
        "schemaVersion": event.schema_version,
        "clientId": event.client_id,
        "clientSequenceNumber": event.client_sequence_number,
        "serverSequenceNumber": event.server_sequence_number,
        "createdAt": event.created_at.isoformat().replace("+00:00", "Z"),
    }


def serialize_transaction(transaction, include_events=True):
    data = {
        "transactionId": transaction.transaction_id,
        "clientId": transaction.client_id,
        "clientSequenceNumber": transaction.client_sequence_number,
        "serverSequenceNumberStart": transaction.server_sequence_number_start,
        "serverSequenceNumberEnd": transaction.server_sequence_number_end,
        "schemaVersion": transaction.schema_version,
        "payload": transaction.payload,
        "reverted": transaction.reverted,
        "createdAt": transaction.created_at.isoformat().replace("+00:00", "Z"),
    }
    if include_events:
        data["events"] = [serialize_event(event) for event in transaction.events.all()]
    return data


def expected_client_sequence(jam, client_id):
    last = JamTransaction.objects.filter(jam=jam, client_id=client_id).order_by("-client_sequence_number").first()
    return 1 if last is None else last.client_sequence_number + 1


def accept_transaction(jam, client_id, transaction_payload, lease_token=None, require_lease=True):
    validated = validate_transaction_payload(jam.jam_id, client_id, transaction_payload)
    existing = JamTransaction.objects.filter(transaction_id=validated["transaction_id"]).prefetch_related("events").first()
    if existing:
        if existing.jam_id != jam.id:
            raise ValidationError({"transaction.transactionId": "Already used for another jam."})
        return existing, False

    if require_lease:
        assert_active_lease(jam, client_id, lease_token)

    expected_sequence = expected_client_sequence(jam, client_id)
    if validated["client_sequence_number"] != expected_sequence:
        raise ClientSequenceConflict({
            "error": "client_sequence_conflict",
            "expectedClientSequenceNumber": expected_sequence,
            "receivedClientSequenceNumber": validated["client_sequence_number"],
        })

    events = validated["events"]
    event_ids = [event["eventId"] for event in events]
    if JamEvent.objects.filter(event_id__in=event_ids).exists():
        raise ValidationError({"transaction.events": "An eventId has already been accepted."})
    with db_transaction.atomic():
        jam = type(jam).objects.select_for_update().get(pk=jam.pk)
        start = jam.latest_server_sequence_number + 1
        end = jam.latest_server_sequence_number + len(events)
        tx = JamTransaction.objects.create(
            jam=jam,
            transaction_id=validated["transaction_id"],
            client_id=client_id,
            client_sequence_number=validated["client_sequence_number"],
            server_sequence_number_start=start,
            server_sequence_number_end=end,
            schema_version=validated["schema_version"],
            payload={k: v for k, v in transaction_payload.items() if k != "events"},
            reverted=False,
        )
        for offset, event in enumerate(events):
            JamEvent.objects.create(
                jam=jam,
                transaction=tx,
                event_id=event["eventId"],
                type=event["type"],
                payload=event["payload"],
                schema_version=event.get("schemaVersion", validated["schema_version"]),
                client_id=client_id,
                client_sequence_number=event.get("clientSequenceNumber", validated["client_sequence_number"]),
                server_sequence_number=start + offset,
            )
        jam.latest_server_sequence_number = end
        jam.save(update_fields=["latest_server_sequence_number", "updated_at"])
    return JamTransaction.objects.prefetch_related("events").get(pk=tx.pk), True
