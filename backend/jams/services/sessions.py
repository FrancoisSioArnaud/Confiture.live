import uuid
from datetime import timedelta
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied
from rest_framework.response import Response
from jams.models import JamClientSession

class JamLocked(APIException):
    status_code = 423
    default_detail = "Jam is locked by another active client."
    default_code = "jam_locked_by_other_client"


LEASE_SECONDS = 30
HEARTBEAT_INTERVAL_SECONDS = 10


def _new_expiry():
    return timezone.now() + timedelta(seconds=LEASE_SECONDS)


def expire_stale_sessions(jam):
    now = timezone.now()
    JamClientSession.objects.filter(jam=jam, status=JamClientSession.Status.ACTIVE, lease_expires_at__lte=now).update(status=JamClientSession.Status.EXPIRED)


def get_active_session(jam):
    expire_stale_sessions(jam)
    return JamClientSession.objects.filter(jam=jam, status=JamClientSession.Status.ACTIVE).order_by("-last_heartbeat_at").first()


def locked_response(active_session):
    return Response({
        "error": "jam_locked_by_other_client",
        "activeClientId": active_session.client_id,
        "leaseExpiresAt": active_session.lease_expires_at.isoformat().replace("+00:00", "Z"),
        "canForceTakeover": True,
    }, status=423)


def create_or_renew_session(jam, client_id, device_label="", force=False):
    active = get_active_session(jam)
    if active and active.client_id != client_id and not force:
        return None, locked_response(active)
    if active and active.client_id != client_id and force:
        active.status = JamClientSession.Status.RELEASED
        active.save(update_fields=["status"])

    session = JamClientSession.objects.filter(jam=jam, client_id=client_id, status=JamClientSession.Status.ACTIVE).first()
    now = timezone.now()
    if session is None:
        session = JamClientSession(jam=jam, client_id=client_id, lease_token=f"lease_{uuid.uuid4().hex}", acquired_at=now)
    session.status = JamClientSession.Status.ACTIVE
    session.last_heartbeat_at = now
    session.lease_expires_at = _new_expiry()
    session.metadata = {**(session.metadata or {}), "deviceLabel": device_label} if device_label else (session.metadata or {})
    session.save()
    return session, None


def renew_session(jam, client_id, lease_token):
    active = get_active_session(jam)
    if not active or active.client_id != client_id or active.lease_token != lease_token:
        raise PermissionDenied("Client does not hold the active lease.")
    active.last_heartbeat_at = timezone.now()
    active.lease_expires_at = _new_expiry()
    active.save(update_fields=["last_heartbeat_at", "lease_expires_at"])
    return active


def release_session(jam, client_id, lease_token):
    active = get_active_session(jam)
    if not active or active.client_id != client_id or active.lease_token != lease_token:
        raise PermissionDenied("Client does not hold the active lease.")
    active.status = JamClientSession.Status.RELEASED
    active.save(update_fields=["status"])
    return active


def assert_active_lease(jam, client_id, lease_token=None):
    active = get_active_session(jam)
    if not active:
        raise PermissionDenied("No active client session for this jam.")
    if active.client_id != client_id:
        raise JamLocked("Jam is locked by another active client.")
    if not lease_token:
        raise PermissionDenied("Lease token is required.")
    if active.lease_token != lease_token:
        raise PermissionDenied("Invalid lease token.")
