from rest_framework.exceptions import ValidationError
from .events import is_allowed_event_type

SUPPORTED_SCHEMA_VERSION = 1


def validate_transaction_payload(data):
    if not isinstance(data, dict):
        raise ValidationError('Transaction must be an object.')
    for field in ['transactionId', 'clientSequenceNumber', 'schemaVersion', 'events']:
        if field not in data:
            raise ValidationError(f'Missing {field}.')
    if data['schemaVersion'] != SUPPORTED_SCHEMA_VERSION:
        raise ValidationError('Unsupported schemaVersion.')
    if not isinstance(data['events'], list) or not data['events']:
        raise ValidationError('Transaction events must be a non-empty list.')
    for event in data['events']:
        validate_event_payload(event)


def validate_event_payload(event):
    if not isinstance(event, dict):
        raise ValidationError('Event must be an object.')
    if not event.get('eventId') or not event.get('type'):
        raise ValidationError('Event requires eventId and type.')
    if not is_allowed_event_type(event['type']):
        raise ValidationError(f'Unsupported event type: {event["type"]}.')
    if not isinstance(event.get('payload', {}), dict):
        raise ValidationError('Event payload must be an object.')
