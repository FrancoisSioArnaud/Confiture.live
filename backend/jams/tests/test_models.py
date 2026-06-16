import pytest
from jams.models import Jam, JamEvent, JamSnapshot, JamTransaction


@pytest.mark.django_db
def test_event_log_models_store_json_payloads():
    jam = Jam.objects.create(name="Jam test")
    transaction = JamTransaction.objects.create(
        jam=jam,
        transaction_id="transaction_1",
        client_id="client_1",
        client_sequence_number=1,
        server_sequence_number_start=1,
        server_sequence_number_end=1,
        schema_version=1,
        payload={"source": "test"},
    )
    event = JamEvent.objects.create(
        jam=jam,
        transaction=transaction,
        event_id="event_1",
        type="jam_created",
        payload={"jamId": jam.jam_id},
        schema_version=1,
        client_id="client_1",
        client_sequence_number=1,
        server_sequence_number=1,
    )
    snapshot = JamSnapshot.objects.create(
        jam=jam,
        client_id="client_1",
        last_server_sequence_number=1,
        payload={"projection": {"jamId": jam.jam_id}},
    )


    assert event.payload["jamId"] == jam.jam_id
    assert snapshot.payload["projection"]["jamId"] == jam.jam_id
