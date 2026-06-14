from django.db import transaction as db_transaction
from rest_framework.exceptions import ValidationError
from jams.models import JamEvent, JamTransaction
from .sessions import assert_active_lease
from .validation import validate_transaction_payload


@db_transaction.atomic
def push_transaction(jam, client_id, payload, require_lease=True):
    validate_transaction_payload(payload)
    existing = JamTransaction.objects.filter(transaction_id=payload['transactionId']).first()
    if existing:
        return existing, False
    if require_lease:
        assert_active_lease(jam, client_id)
    expected = JamTransaction.objects.filter(jam=jam, client_id=client_id).count() + 1
    if payload['clientSequenceNumber'] != expected:
        raise ValidationError({'clientSequenceNumber': f'Expected {expected}.'})
    start = jam.latest_server_sequence_number + 1
    end = start + len(payload['events']) - 1
    tx = JamTransaction.objects.create(
        jam=jam, transaction_id=payload['transactionId'], client_id=client_id,
        client_sequence_number=payload['clientSequenceNumber'], schema_version=payload['schemaVersion'],
        server_sequence_number_start=start, server_sequence_number_end=end,
    )
    sequence = start
    for event in payload['events']:
        JamEvent.objects.create(
            jam=jam, transaction=tx, event_id=event['eventId'], type=event['type'], payload=event.get('payload', {}),
            schema_version=payload['schemaVersion'], server_sequence_number=sequence,
        )
        if event['type'] == 'jam_created':
            p = event.get('payload', {})
            jam.name = p.get('name', jam.name)
            jam.indicative_date = p.get('indicativeDate') or jam.indicative_date
            jam.link_reorder_strategy = p.get('linkReorderStrategy', jam.link_reorder_strategy)
        sequence += 1
    jam.latest_server_sequence_number = end
    jam.save(update_fields=['name','indicative_date','link_reorder_strategy','latest_server_sequence_number','updated_at'])
    return tx, True
