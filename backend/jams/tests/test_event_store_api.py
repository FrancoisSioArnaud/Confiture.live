import pytest
from django.contrib.auth import get_user_model
from jams.models import Jam, JamEvent, JamTransaction

pytestmark = pytest.mark.django_db


def create_jam(client, jam_id="jam_test", client_id="client_1"):
    response = client.post("/api/jams/", {
        "clientId": client_id,
        "transaction": {
            "transactionId": f"transaction_create_{jam_id}",
            "jamId": jam_id,
            "clientSequenceNumber": 1,
            "schemaVersion": 1,
            "events": [{
                "eventId": f"event_create_{jam_id}",
                "jamId": jam_id,
                "type": "jam_created",
                "payload": {"jamId": jam_id, "name": "Jam test", "indicativeDate": "2026-06-17", "linkReorderStrategy": "move_to_first"},
                "schemaVersion": 1,
            }],
        },
    }, content_type="application/json")
    assert response.status_code == 201
    return response.json()


def create_jam_with_instruments(client, jam_id="jam_with_instruments", client_id="client_1"):
    response = client.post("/api/jams/", {
        "clientId": client_id,
        "transaction": {
            "transactionId": f"transaction_create_{jam_id}",
            "jamId": jam_id,
            "clientSequenceNumber": 1,
            "schemaVersion": 1,
            "events": [
                {
                    "eventId": f"event_create_{jam_id}",
                    "jamId": jam_id,
                    "type": "jam_created",
                    "payload": {
                        "jamId": jam_id,
                        "name": "Jam avec instruments",
                        "indicativeDate": "2026-06-17",
                        "linkReorderStrategy": "move_to_first",
                    },
                    "schemaVersion": 1,
                },
                {
                    "eventId": f"event_add_voice_{jam_id}",
                    "jamId": jam_id,
                    "type": "instrument_added",
                    "payload": {
                        "instrumentId": "instrument_vocals",
                        "label": "Chant",
                        "orderKey": "order_0",
                        "visible": True,
                        "isDefault": True,
                    },
                    "schemaVersion": 1,
                },
                {
                    "eventId": f"event_add_guitar_{jam_id}",
                    "jamId": jam_id,
                    "type": "instrument_added",
                    "payload": {
                        "instrumentId": "instrument_guitar",
                        "label": "Guitare",
                        "orderKey": "order_1",
                        "visible": True,
                        "isDefault": True,
                    },
                    "schemaVersion": 1,
                },
            ],
        },
    }, content_type="application/json")
    assert response.status_code == 201
    return response.json()



def transaction_payload(jam_id="jam_test", tx_id="transaction_2", event_id="event_2", sequence=2):
    return {
        "transactionId": tx_id,
        "jamId": jam_id,
        "clientSequenceNumber": sequence,
        "schemaVersion": 1,
        "events": [{
            "eventId": event_id,
            "jamId": jam_id,
            "type": "jam_updated",
            "payload": {"name": "Jam renommée"},
            "schemaVersion": 1,
        }],
    }


def test_create_list_and_retrieve_jam(client):
    create_jam(client)

    list_response = client.get("/api/jams/")
    assert list_response.status_code == 200
    assert list_response.json()["results"][0]["jamId"] == "jam_test"

    detail_response = client.get("/api/jams/jam_test/")
    assert detail_response.status_code == 200
    payload = detail_response.json()
    assert payload["jam"]["jamId"] == "jam_test"
    assert payload["events"][0]["type"] == "jam_created"


def test_create_jam_with_instruments_persists_transaction_and_events(client):
    response = create_jam_with_instruments(client)

    jam = Jam.objects.get(jam_id=response["jamId"])
    transactions = JamTransaction.objects.filter(jam=jam)
    events = JamEvent.objects.filter(jam=jam).order_by("server_sequence_number")

    assert jam.latest_server_sequence_number == 3
    assert transactions.count() == 1
    assert transactions.first().reverted is False
    assert events.count() == 3
    assert [event.type for event in events] == ["jam_created", "instrument_added", "instrument_added"]


def test_create_jam_rolls_back_if_initial_transaction_fails(client, monkeypatch):
    def fail_accept_transaction(*args, **kwargs):
        raise RuntimeError("forced transaction failure")

    monkeypatch.setattr("jams.views.accept_transaction", fail_accept_transaction)
    client.raise_request_exception = False

    response = client.post("/api/jams/", {
        "clientId": "client_rollback",
        "transaction": {
            "transactionId": "transaction_create_jam_rollback",
            "jamId": "jam_rollback",
            "clientSequenceNumber": 1,
            "schemaVersion": 1,
            "events": [{
                "eventId": "event_create_jam_rollback",
                "jamId": "jam_rollback",
                "type": "jam_created",
                "payload": {"jamId": "jam_rollback", "name": "Jam rollback", "indicativeDate": "2026-06-17", "linkReorderStrategy": "move_to_first"},
                "schemaVersion": 1,
            }],
        },
    }, content_type="application/json")

    assert response.status_code == 500
    assert not Jam.objects.filter(jam_id="jam_rollback").exists()



def test_api_post_create_jam_ignores_admin_session_csrf(client):
    User = get_user_model()
    user = User.objects.create_superuser(username="admin", email="admin@example.com", password="password")
    client.enforce_csrf_checks = True
    client.force_login(user)

    response = client.post("/api/jams/", {
        "clientId": "client_admin_session",
        "transaction": {
            "transactionId": "transaction_admin_session_create",
            "jamId": "jam_admin_session",
            "clientSequenceNumber": 1,
            "schemaVersion": 1,
            "events": [{
                "eventId": "event_admin_session_create",
                "jamId": "jam_admin_session",
                "type": "jam_created",
                "payload": {
                    "jamId": "jam_admin_session",
                    "name": "Jam admin session",
                    "indicativeDate": "2026-06-17",
                    "linkReorderStrategy": "move_to_first",
                },
                "schemaVersion": 1,
            }],
        },
    }, content_type="application/json")

    assert response.status_code == 201
    assert Jam.objects.filter(jam_id="jam_admin_session").exists()


def test_patch_and_archive_jam(client):
    create_jam(client)
    patch_response = client.patch("/api/jams/jam_test/", {"name": "Jam patchée"}, content_type="application/json")
    assert patch_response.status_code == 200
    assert patch_response.json()["name"] == "Jam patchée"

    delete_response = client.delete("/api/jams/jam_test/")
    assert delete_response.status_code == 204
    detail_response = client.get("/api/jams/jam_test/")
    assert detail_response.json()["jam"]["status"] == "archived"


def test_post_valid_transaction_and_get_transactions(client):
    create_jam(client)

    response = client.post("/api/jams/jam_test/transactions/", {
        "clientId": "client_1",
        "baseServerSequenceNumber": 1,
        "transaction": transaction_payload(),
    }, content_type="application/json")

    assert response.status_code == 201
    assert response.json()["serverSequenceNumberStart"] == 2
    assert response.json()["latestServerSequenceNumber"] == 2

    get_response = client.get("/api/jams/jam_test/transactions/?fromServerSequenceNumber=1")
    assert get_response.status_code == 200
    transactions = get_response.json()["transactions"]
    assert len(transactions) == 1
    assert transactions[0]["events"][0]["serverSequenceNumber"] == 2


def test_post_participant_transaction_persists_expected_events(client):
    create_jam_with_instruments(client, jam_id="jam_participant")

    response = client.post("/api/jams/jam_participant/transactions/", {
        "clientId": "client_1",
        "baseServerSequenceNumber": 3,
        "transaction": {
            "transactionId": "transaction_add_participant",
            "jamId": "jam_participant",
            "clientSequenceNumber": 2,
            "schemaVersion": 1,
            "events": [
                {
                    "eventId": "event_participant_created",
                    "jamId": "jam_participant",
                    "type": "participant_created",
                    "payload": {"participantId": "participant_nico", "name": "Nico"},
                    "schemaVersion": 1,
                },
                {
                    "eventId": "event_participation_added",
                    "jamId": "jam_participant",
                    "type": "participation_added",
                    "payload": {
                        "participationId": "participation_nico_guitar",
                        "participantId": "participant_nico",
                        "instrumentId": "instrument_guitar",
                        "customInstrumentLabel": None,
                        "insertionMode": "end_of_visible_rounds",
                        "startAppearanceIndex": 1,
                        "afterTarget": None,
                        "beforeTarget": None,
                        "baseOrderKey": "position_participation_nico_guitar",
                    },
                    "schemaVersion": 1,
                },
            ],
        },
    }, content_type="application/json")

    assert response.status_code == 201
    assert response.json()["serverSequenceNumberStart"] == 4
    assert response.json()["latestServerSequenceNumber"] == 5

    jam = Jam.objects.get(jam_id="jam_participant")
    events = JamEvent.objects.filter(jam=jam).order_by("server_sequence_number")
    assert jam.latest_server_sequence_number == 5
    assert [event.type for event in events][3:] == ["participant_created", "participation_added"]
    assert events[4].payload["instrumentId"] == "instrument_guitar"


def test_accepts_transaction_without_lease_token(client):
    create_jam(client)
    response = client.post("/api/jams/jam_test/transactions/", {
        "clientId": "client_1",
        "baseServerSequenceNumber": 1,
        "transaction": transaction_payload(),
    }, content_type="application/json")

    assert response.status_code == 201


def test_accepts_stale_base_server_sequence(client):
    create_jam(client)

    response = client.post("/api/jams/jam_test/transactions/", {
        "clientId": "client_1",
        "baseServerSequenceNumber": 0,
        "transaction": transaction_payload(),
    }, content_type="application/json")

    assert response.status_code == 201


def test_transaction_idempotence_does_not_duplicate(client):
    create_jam(client)
    body = {
        "clientId": "client_1",
        "baseServerSequenceNumber": 1,
        "transaction": transaction_payload(),
    }
    first = client.post("/api/jams/jam_test/transactions/", body, content_type="application/json")
    assert first.status_code == 201
    second = client.post("/api/jams/jam_test/transactions/", body, content_type="application/json")
    assert second.status_code == 200
    assert second.json()["status"] == "already_accepted"

    all_transactions = client.get("/api/jams/jam_test/transactions/").json()["transactions"]
    assert [tx["transactionId"] for tx in all_transactions].count("transaction_2") == 1


def test_accepts_client_sequence_gap_as_metadata(client):
    create_jam(client)
    response = client.post("/api/jams/jam_test/transactions/", {
        "clientId": "client_1",
        "baseServerSequenceNumber": 1,
        "transaction": transaction_payload(sequence=3),
    }, content_type="application/json")
    assert response.status_code == 201
    assert JamTransaction.objects.get(transaction_id="transaction_2").client_sequence_number == 3


def test_snapshot_latest(client):
    create_jam(client)
    post_response = client.post("/api/jams/jam_test/snapshots/", {
        "clientId": "client_1",
        "snapshot": {
            "snapshotId": "snapshot_1",
            "lastServerSequenceNumber": 1,
            "schemaVersion": 1,
            "projectionVersion": 1,
            "payload": {"projection": {"jamId": "jam_test"}},
        },
    }, content_type="application/json")
    assert post_response.status_code == 201

    latest_response = client.get("/api/jams/jam_test/snapshot/latest/")
    assert latest_response.status_code == 200
    assert latest_response.json()["snapshot"]["snapshotId"] == "snapshot_1"


def test_accepts_snapshot_without_lease_token(client):
    create_jam(client)
    response = client.post("/api/jams/jam_test/snapshots/", {
        "clientId": "client_1",
        "snapshot": {
            "snapshotId": "snapshot_without_lease",
            "lastServerSequenceNumber": 1,
            "schemaVersion": 1,
            "projectionVersion": 1,
            "payload": {"projection": {"jamId": "jam_test"}},
        },
    }, content_type="application/json")

    assert response.status_code == 201


def test_rejects_event_payload_missing_required_fields(client):
    jam = create_jam(client)
    response = client.post(f"/api/jams/{jam['jamId']}/transactions/", {
        "clientId": "client_payload",
        "transaction": {
            "transactionId": "tx_bad_payload",
            "jamId": jam["jamId"],
            "clientSequenceNumber": 1,
            "schemaVersion": 1,
            "events": [{
                "eventId": "event_bad_payload",
                "jamId": jam["jamId"],
                "type": "participant_created",
                "payload": {"participantId": "participant_missing_name"},
                "schemaVersion": 1,
            }],
        },
    }, content_type="application/json")

    assert response.status_code == 400



def test_accepts_transactions_from_multiple_client_ids(client):
    create_jam(client)

    first = client.post("/api/jams/jam_test/transactions/", {
        "clientId": "client_1",
        "baseServerSequenceNumber": 1,
        "transaction": transaction_payload(tx_id="transaction_client_1", event_id="event_client_1", sequence=2),
    }, content_type="application/json")
    second = client.post("/api/jams/jam_test/transactions/", {
        "clientId": "client_2",
        "baseServerSequenceNumber": 1,
        "transaction": transaction_payload(tx_id="transaction_client_2", event_id="event_client_2", sequence=1),
    }, content_type="application/json")

    assert first.status_code == 201
    assert second.status_code == 201
    assert JamTransaction.objects.filter(jam__jam_id="jam_test").count() == 3


def test_accepts_duplicate_client_sequence_number_as_metadata(client):
    create_jam(client)

    first = client.post("/api/jams/jam_test/transactions/", {
        "clientId": "client_1",
        "transaction": transaction_payload(tx_id="transaction_dup_1", event_id="event_dup_1", sequence=2),
    }, content_type="application/json")
    second = client.post("/api/jams/jam_test/transactions/", {
        "clientId": "client_1",
        "transaction": transaction_payload(tx_id="transaction_dup_2", event_id="event_dup_2", sequence=2),
    }, content_type="application/json")

    assert first.status_code == 201
    assert second.status_code == 201
    assert list(JamTransaction.objects.filter(transaction_id__startswith="transaction_dup_").values_list("client_sequence_number", flat=True)) == [2, 2]


def test_client_session_endpoints_return_404(client):
    create_jam(client)

    for action in ["acquire", "heartbeat", "release", "takeover"]:
        response = client.post(f"/api/jams/jam_test/client-session/{action}/", {"clientId": "client_1"}, content_type="application/json")
        assert response.status_code == 404


def test_list_empty_jams_returns_json_results(client):
    response = client.get("/api/jams/")

    assert response.status_code == 200
    assert response["Content-Type"].startswith("application/json")
    assert response.json() == {"results": []}


def test_list_jams_returns_json_results_with_existing_jam(client):
    create_jam(client)

    response = client.get("/api/jams/")

    assert response.status_code == 200
    assert response["Content-Type"].startswith("application/json")
    payload = response.json()
    assert "results" in payload
    assert payload["results"][0]["jamId"] == "jam_test"


def test_retrieve_jam_with_snapshot_includes_transactions_and_events(client):
    create_jam(client)
    transaction_response = client.post("/api/jams/jam_test/transactions/", {
        "clientId": "client_1",
        "baseServerSequenceNumber": 1,
        "transaction": transaction_payload(),
    }, content_type="application/json")
    assert transaction_response.status_code == 201

    response = client.get("/api/jams/jam_test/?includeSnapshot=true")

    assert response.status_code == 200
    assert response["Content-Type"].startswith("application/json")
    payload = response.json()
    assert payload["jam"]["jamId"] == "jam_test"
    assert "snapshot" in payload
    assert len(payload["transactions"]) == 2
    assert len(payload["events"]) == 2
    assert payload["transactions"][1]["payload"]["transactionId"] == "transaction_2"
    assert payload["events"][1]["type"] == "jam_updated"


def test_link_created_accepts_non_oriented_payload_without_anchor(client):
    create_jam_with_instruments(client, jam_id="jam_link_validation")

    response = client.post("/api/jams/jam_link_validation/transactions/", {
        "clientId": "client_1",
        "baseServerSequenceNumber": 3,
        "transaction": {
            "transactionId": "transaction_link_without_anchor",
            "jamId": "jam_link_validation",
            "clientSequenceNumber": 2,
            "schemaVersion": 1,
            "events": [{
                "eventId": "event_link_without_anchor",
                "jamId": "jam_link_validation",
                "type": "link_created",
                "payload": {
                    "linkId": "link_without_anchor",
                    "targets": [
                        {"type": "appearance", "id": "appearance_a"},
                        {"type": "appearance", "id": "appearance_b"},
                    ],
                    "reorderStrategy": "move_to_first",
                },
                "schemaVersion": 1,
            }],
        },
    }, content_type="application/json")

    assert response.status_code == 201
    event = JamEvent.objects.get(jam__jam_id="jam_link_validation", event_id="event_link_without_anchor")
    assert "anchorTarget" not in event.payload


def test_link_created_rejects_less_than_two_targets(client):
    create_jam_with_instruments(client, jam_id="jam_link_invalid")

    response = client.post("/api/jams/jam_link_invalid/transactions/", {
        "clientId": "client_1",
        "baseServerSequenceNumber": 3,
        "transaction": {
            "transactionId": "transaction_bad_link",
            "jamId": "jam_link_invalid",
            "clientSequenceNumber": 2,
            "schemaVersion": 1,
            "events": [{
                "eventId": "event_bad_link",
                "jamId": "jam_link_invalid",
                "type": "link_created",
                "payload": {
                    "linkId": "link_bad",
                    "targets": [{"type": "appearance", "id": "appearance_a"}],
                    "reorderStrategy": "move_to_first",
                },
                "schemaVersion": 1,
            }],
        },
    }, content_type="application/json")

    assert response.status_code == 400
    assert "at least two targets" in str(response.json())
