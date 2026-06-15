from rest_framework.exceptions import ValidationError
from jams.models import JamSnapshot


def serialize_snapshot(snapshot):
    if snapshot is None:
        return None
    return {
        "snapshotId": snapshot.snapshot_id,
        "clientId": snapshot.client_id,
        "lastServerSequenceNumber": snapshot.last_server_sequence_number,
        "payload": snapshot.payload,
        "schemaVersion": snapshot.schema_version,
        "createdAt": snapshot.created_at.isoformat().replace("+00:00", "Z"),
    }


def create_snapshot(jam, client_id, snapshot_payload):
    if not isinstance(snapshot_payload, dict):
        raise ValidationError({"snapshot": "Must be a JSON object."})
    last_sequence = snapshot_payload.get("lastServerSequenceNumber")
    if not isinstance(last_sequence, int) or last_sequence < 0:
        raise ValidationError({"snapshot.lastServerSequenceNumber": "Must be a non-negative integer."})
    if last_sequence > jam.latest_server_sequence_number:
        raise ValidationError({"snapshot.lastServerSequenceNumber": "Cannot be greater than latestServerSequenceNumber."})
    payload = snapshot_payload.get("payload")
    if not isinstance(payload, dict):
        raise ValidationError({"snapshot.payload": "Must be a JSON object."})
    create_kwargs = {
        "jam": jam,
        "client_id": client_id,
        "last_server_sequence_number": last_sequence,
        "payload": payload,
        "schema_version": snapshot_payload.get("schemaVersion", 1),
    }
    if snapshot_payload.get("snapshotId"):
        create_kwargs["snapshot_id"] = snapshot_payload["snapshotId"]
    return JamSnapshot.objects.create(**create_kwargs)
