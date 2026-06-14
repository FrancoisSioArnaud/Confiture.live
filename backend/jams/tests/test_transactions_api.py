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
