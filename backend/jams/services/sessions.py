from datetime import timedelta
from uuid import uuid4
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework import status
from rest_framework.exceptions import APIException
from jams.models import JamClientSession

LEASE_SECONDS = 120

class Locked(APIException):
    status_code = status.HTTP_423_LOCKED
    default_detail = 'Jam is controlled by another active client.'


def active_session_for(jam):
    now = timezone.now()
    return jam.client_sessions.filter(is_active=True, lease_expires_at__gt=now).first()


def acquire_lease(jam, client_id, force=False):
    current = active_session_for(jam)
    if current and current.client_id != client_id and not force:
        raise Locked()
    if current and current.client_id != client_id and force:
        current.is_active = False
        current.save(update_fields=['is_active'])
    session, _ = JamClientSession.objects.update_or_create(
        jam=jam, client_id=client_id,
        defaults={'lease_token': f'lease_{uuid4().hex}', 'is_active': True, 'lease_expires_at': timezone.now() + timedelta(seconds=LEASE_SECONDS)},
    )
    return session


def assert_active_lease(jam, client_id):
    current = active_session_for(jam)
    if not current or current.client_id != client_id:
        raise PermissionDenied('Client does not hold the active lease.')
    return current
