import pytest
from django.urls import reverse

pytestmark = pytest.mark.django_db


def tx(seq=1, transaction_id='tx_1'):
    return {'transactionId': transaction_id, 'clientSequenceNumber': seq, 'schemaVersion': 1, 'events': [{'eventId': f'event_{seq}', 'type': 'jam_created', 'payload': {'jamId': 'jam_1', 'name': 'Jam'}}]}


def test_create_jam_stores_transaction_and_events(client):
    response = client.post('/api/jams/', {'clientId': 'client_1', 'transaction': tx()}, content_type='application/json')
    assert response.status_code == 201
    assert response.json()['latestServerSequenceNumber'] == 1


def test_push_transaction_requires_sequence(client):
    client.post('/api/jams/', {'clientId': 'client_1', 'transaction': tx()}, content_type='application/json')
    bad = {'transactionId': 'tx_2', 'clientSequenceNumber': 3, 'schemaVersion': 1, 'events': [{'eventId': 'event_2', 'type': 'instrument_added', 'payload': {'instrumentId': 'guitar', 'name': 'Guitare'}}]}
    response = client.post('/api/jams/jam_1/transactions/', {'clientId': 'client_1', 'transaction': bad}, content_type='application/json')
    assert response.status_code == 400


def test_legacy_event_types_are_rejected(client):
    client.post('/api/jams/', {'clientId': 'client_1', 'transaction': tx()}, content_type='application/json')
    legacy = {
        'transactionId': 'tx_legacy',
        'clientSequenceNumber': 2,
        'schemaVersion': 1,
        'events': [{'eventId': 'event_legacy', 'type': 'jam_metadata_updated', 'payload': {'name': 'Legacy'}}],
    }
    response = client.post('/api/jams/jam_1/transactions/', {'clientId': 'client_1', 'transaction': legacy}, content_type='application/json')
    assert response.status_code == 400
    assert 'Unsupported event type' in str(response.content)


def test_v0_event_types_are_accepted(client):
    client.post('/api/jams/', {'clientId': 'client_1', 'transaction': tx()}, content_type='application/json')
    v0 = {
        'transactionId': 'tx_v0',
        'clientSequenceNumber': 2,
        'schemaVersion': 1,
        'events': [
            {'eventId': 'event_v0_1', 'type': 'jam_updated', 'payload': {'name': 'Jam V0'}},
            {'eventId': 'event_v0_2', 'type': 'instruments_reordered', 'payload': {'instrumentIds': []}},
            {'eventId': 'event_v0_3', 'type': 'plateau_unplayed', 'payload': {'plateauId': 'plateau_1'}},
        ],
    }
    response = client.post('/api/jams/jam_1/transactions/', {'clientId': 'client_1', 'transaction': v0}, content_type='application/json')
    assert response.status_code == 200


def test_health_and_transactions_read_endpoints(client):
    assert client.get('/api/health/').status_code == 200
    client.post('/api/jams/', {'clientId': 'client_1', 'transaction': tx()}, content_type='application/json')
    response = client.get('/api/jams/jam_1/transactions/?fromServerSequenceNumber=0')
    assert response.status_code == 200
    assert response.json()['latestServerSequenceNumber'] == 1
    assert len(response.json()['transactions']) == 1


def test_snapshot_latest_and_client_session_flow(client):
    client.post('/api/jams/', {'clientId': 'client_1', 'transaction': tx()}, content_type='application/json')
    snapshot = {'clientId': 'client_1', 'snapshot': {'snapshotId': 'snapshot_1', 'lastServerSequenceNumber': 1, 'state': {'ok': True}}}
    created = client.post('/api/jams/jam_1/snapshots/', snapshot, content_type='application/json')
    assert created.status_code == 201
    latest = client.get('/api/jams/jam_1/snapshot/latest/')
    assert latest.status_code == 200
    assert latest.json()['snapshot']['snapshotId'] == 'snapshot_1'

    acquired = client.post('/api/jams/jam_1/client-session/acquire/', {'clientId': 'client_1'}, content_type='application/json')
    assert acquired.status_code == 200
    lease_token = acquired.json()['leaseToken']
    heartbeat = client.post('/api/jams/jam_1/client-session/heartbeat/', {'clientId': 'client_1', 'leaseToken': lease_token}, content_type='application/json')
    assert heartbeat.status_code == 200
    released = client.post('/api/jams/jam_1/client-session/release/', {'clientId': 'client_1', 'leaseToken': lease_token}, content_type='application/json')
    assert released.status_code == 200
