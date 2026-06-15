import pytest
from django.utils import timezone
from jams.models import JamClientSession

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


def acquire(client, jam_id="jam_test", client_id="client_1"):
    response = client.post(f"/api/jams/{jam_id}/client-session/acquire/", {"clientId": client_id}, content_type="application/json")
    assert response.status_code == 200
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
    lease = acquire(client)

    response = client.post("/api/jams/jam_test/transactions/", {
        "clientId": "client_1",
        "leaseToken": lease["leaseToken"],
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


def test_transaction_idempotence_does_not_duplicate(client):
    create_jam(client)
    lease = acquire(client)
    body = {
        "clientId": "client_1",
        "leaseToken": lease["leaseToken"],
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


def test_rejects_client_sequence_gap(client):
    create_jam(client)
    lease = acquire(client)
    response = client.post("/api/jams/jam_test/transactions/", {
        "clientId": "client_1",
        "leaseToken": lease["leaseToken"],
        "baseServerSequenceNumber": 1,
        "transaction": transaction_payload(sequence=3),
    }, content_type="application/json")
    assert response.status_code == 409
    assert response.json()["expectedClientSequenceNumber"] == 2


def test_snapshot_latest(client):
    create_jam(client)
    lease = acquire(client)
    post_response = client.post("/api/jams/jam_test/snapshots/", {
        "clientId": "client_1",
        "leaseToken": lease["leaseToken"],
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


def test_acquire_heartbeat_release_and_takeover(client):
    create_jam(client)
    lease = acquire(client, client_id="client_1")

    heartbeat = client.post("/api/jams/jam_test/client-session/heartbeat/", {
        "clientId": "client_1",
        "leaseToken": lease["leaseToken"],
    }, content_type="application/json")
    assert heartbeat.status_code == 200
    assert heartbeat.json()["status"] == "renewed"

    locked = client.post("/api/jams/jam_test/client-session/acquire/", {"clientId": "client_2"}, content_type="application/json")
    assert locked.status_code == 423

    takeover = client.post("/api/jams/jam_test/client-session/takeover/", {"clientId": "client_2", "previousClientId": "client_1", "confirm": True}, content_type="application/json")
    assert takeover.status_code == 200
    assert takeover.json()["clientId"] == "client_2"

    release = client.post("/api/jams/jam_test/client-session/release/", {
        "clientId": "client_2",
        "leaseToken": takeover.json()["leaseToken"],
    }, content_type="application/json")
    assert release.status_code == 200
    assert release.json()["status"] == "released"


def test_expired_session_allows_another_client(client):
    create_jam(client)
    acquire(client, client_id="client_1")
    JamClientSession.objects.update(lease_expires_at=timezone.now() - timezone.timedelta(seconds=1))

    response = client.post("/api/jams/jam_test/client-session/acquire/", {"clientId": "client_2"}, content_type="application/json")
    assert response.status_code == 200
    assert response.json()["clientId"] == "client_2"
