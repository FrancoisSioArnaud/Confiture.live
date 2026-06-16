from django.db import transaction as db_transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from .models import Jam, JamTransaction
from .serializers import JamSerializer
from .services.sessions import (
    HEARTBEAT_INTERVAL_SECONDS,
    assert_active_lease,
    create_or_renew_session,
    release_session,
    renew_session,
)
from .services.snapshots import create_snapshot, serialize_snapshot
from .services.transactions import accept_transaction, serialize_event, serialize_transaction


def _client_id(request):
    return request.data.get("clientId")


def _lease_token(request):
    return request.data.get("leaseToken")


def _session_response(session):
    return {
        "status": "acquired",
        "clientId": session.client_id,
        "leaseToken": session.lease_token,
        "leaseExpiresAt": session.lease_expires_at.isoformat().replace("+00:00", "Z"),
        "heartbeatIntervalSeconds": HEARTBEAT_INTERVAL_SECONDS,
    }


@api_view(["GET"])
def health(request):
    return Response({"status": "ok"})


class JamViewSet(viewsets.ModelViewSet):
    queryset = Jam.objects.all().order_by("-updated_at")
    serializer_class = JamSerializer
    lookup_field = "jam_id"

    def list(self, request, *args, **kwargs):
        return Response({"results": JamSerializer(self.get_queryset(), many=True).data})

    def create(self, request, *args, **kwargs):
        client_id = _client_id(request)
        transaction_payload = request.data.get("transaction")
        if not client_id:
            raise ValidationError({"clientId": "This field is required."})
        if not isinstance(transaction_payload, dict):
            raise ValidationError({"transaction": "This field is required."})
        events = transaction_payload.get("events") or []
        jam_created = next((event for event in events if event.get("type") == "jam_created"), None)
        if not jam_created:
            raise ValidationError({"transaction.events": "POST /api/jams/ requires a jam_created event."})
        payload = jam_created.get("payload") or {}
        jam_id = payload.get("jamId")
        if not jam_id:
            raise ValidationError({"transaction.events.jam_created.payload.jamId": "This field is required."})
        if Jam.objects.filter(jam_id=jam_id).exists():
            raise ValidationError({"jamId": "Jam already exists."})

        with db_transaction.atomic():
            jam = Jam.objects.create(
                jam_id=jam_id,
                name=payload.get("name", "Nouvelle jam"),
                indicative_date=payload.get("indicativeDate") or None,
                link_reorder_strategy=payload.get("linkReorderStrategy", "move_to_first"),
            )
            transaction_payload = {**transaction_payload, "jamId": jam.jam_id}
            transaction, _created = accept_transaction(jam, client_id, transaction_payload, require_lease=False)

        return Response({
            "jamId": jam.jam_id,
            "latestServerSequenceNumber": transaction.server_sequence_number_end,
            "transactionAck": {
                "transactionId": transaction.transaction_id,
                "serverSequenceNumberStart": transaction.server_sequence_number_start,
                "serverSequenceNumberEnd": transaction.server_sequence_number_end,
            },
        }, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        jam = self.get_object()
        from_sequence = request.query_params.get("fromSequence")
        events = jam.events.all()
        transactions = jam.transactions.prefetch_related("events").all()
        if from_sequence is not None:
            from_sequence = int(from_sequence)
            events = events.filter(server_sequence_number__gt=from_sequence)
            transactions = transactions.filter(server_sequence_number_end__gt=from_sequence)
        snapshot = jam.snapshots.first() if request.query_params.get("includeSnapshot", "true") != "false" else None
        return Response({
            "jam": JamSerializer(jam).data,
            "snapshot": serialize_snapshot(snapshot),
            "transactions": [serialize_transaction(tx) for tx in transactions],
            "events": [serialize_event(event) for event in events],
        })

    def partial_update(self, request, *args, **kwargs):
        jam = self.get_object()
        serializer = self.get_serializer(jam, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        jam = self.get_object()
        jam.status = Jam.Status.ARCHIVED
        jam.save(update_fields=["status", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get", "post"], url_path="transactions")
    def transactions(self, request, jam_id=None):
        jam = self.get_object()
        if request.method == "GET":
            from_sequence = int(request.query_params.get("fromServerSequenceNumber", 0))
            transactions = jam.transactions.prefetch_related("events").filter(server_sequence_number_end__gt=from_sequence)
            return Response({
                "latestServerSequenceNumber": jam.latest_server_sequence_number,
                "transactions": [serialize_transaction(tx) for tx in transactions],
            })

        transaction_payload = request.data.get("transaction") or {}
        existing = JamTransaction.objects.filter(transaction_id=transaction_payload.get("transactionId"), jam=jam).first()
        if existing:
            return Response({
                "status": "already_accepted",
                "transactionId": existing.transaction_id,
                "serverSequenceNumberStart": existing.server_sequence_number_start,
                "serverSequenceNumberEnd": existing.server_sequence_number_end,
                "latestServerSequenceNumber": jam.latest_server_sequence_number,
            })
        base_sequence = request.data.get("baseServerSequenceNumber")
        if base_sequence is not None and base_sequence != jam.latest_server_sequence_number:
            return Response({
                "error": "sequence_conflict",
                "message": "Le serveur possède déjà des events inconnus du client.",
                "latestServerSequenceNumber": jam.latest_server_sequence_number,
                "clientBaseServerSequenceNumber": base_sequence,
            }, status=status.HTTP_409_CONFLICT)
        transaction, created = accept_transaction(jam, _client_id(request), transaction_payload, _lease_token(request))
        return Response({
            "status": "accepted" if created else "already_accepted",
            "transactionId": transaction.transaction_id,
            "serverSequenceNumberStart": transaction.server_sequence_number_start,
            "serverSequenceNumberEnd": transaction.server_sequence_number_end,
            "latestServerSequenceNumber": transaction.server_sequence_number_end if created else transaction.jam.latest_server_sequence_number,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="snapshot/latest")
    def latest_snapshot(self, request, jam_id=None):
        snapshot = self.get_object().snapshots.first()
        return Response({"snapshot": serialize_snapshot(snapshot)})

    @action(detail=True, methods=["post"], url_path="snapshots")
    def snapshots(self, request, jam_id=None):
        jam = self.get_object()
        client_id = _client_id(request)
        if not client_id:
            raise ValidationError({"clientId": "This field is required."})
        assert_active_lease(jam, client_id, _lease_token(request))
        snapshot = create_snapshot(jam, client_id, request.data.get("snapshot"))
        return Response({
            "status": "accepted",
            "snapshotId": snapshot.snapshot_id,
            "lastServerSequenceNumber": snapshot.last_server_sequence_number,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="client-session/acquire")
    def acquire_client_session(self, request, jam_id=None):
        client_id = _client_id(request)
        if not client_id:
            raise ValidationError({"clientId": "This field is required."})
        session, locked = create_or_renew_session(self.get_object(), client_id, request.data.get("deviceLabel", ""), force=request.data.get("force", False))
        if locked:
            return locked
        return Response(_session_response(session))

    @action(detail=True, methods=["post"], url_path="client-session/heartbeat")
    def heartbeat_client_session(self, request, jam_id=None):
        session = renew_session(self.get_object(), _client_id(request), _lease_token(request))
        return Response({"status": "renewed", "leaseExpiresAt": session.lease_expires_at.isoformat().replace("+00:00", "Z")})

    @action(detail=True, methods=["post"], url_path="client-session/release")
    def release_client_session(self, request, jam_id=None):
        release_session(self.get_object(), _client_id(request), _lease_token(request))
        return Response({"status": "released"})

    @action(detail=True, methods=["post"], url_path="client-session/takeover")
    def takeover_client_session(self, request, jam_id=None):
        if request.data.get("confirm") is not True:
            raise ValidationError({"confirm": "Must be true."})
        client_id = _client_id(request)
        if not client_id:
            raise ValidationError({"clientId": "This field is required."})
        session, _locked = create_or_renew_session(self.get_object(), client_id, request.data.get("deviceLabel", ""), force=True)
        return Response(_session_response(session))
