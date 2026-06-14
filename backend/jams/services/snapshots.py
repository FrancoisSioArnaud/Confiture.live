from rest_framework.exceptions import ValidationError
from jams.models import JamSnapshot


def create_snapshot(jam, data, client_id):
    if data.get('lastServerSequenceNumber', 0) > jam.latest_server_sequence_number:
        raise ValidationError('Snapshot sequence is ahead of jam sequence.')
    return JamSnapshot.objects.create(
        jam=jam, snapshot_id=data['snapshotId'], last_server_sequence_number=data['lastServerSequenceNumber'],
        state=data.get('state', {}), created_by_client_id=client_id,
    )


def latest_snapshot(jam):
    return jam.snapshots.first()
