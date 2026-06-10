from django.db import IntegrityError
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ClientAction, Jam
from .serializers import ClientActionCreateSerializer, ClientActionSerializer, JamDetailSerializer, JamListSerializer
from .services.action_service import ActionApplicationError, record_and_apply_action


def jam_queryset():
    return Jam.objects.annotate(
        unique_musicians_count=Count("participants", distinct=True),
        participant_entries_count=Count("entries", distinct=True),
        played_plateaus_count=Count("played_passages__line_index", distinct=True),
        unplayed_active_entries_count=Count(
            "entries",
            filter=Q(entries__participant__status="active", entries__played_passages__isnull=True),
            distinct=True,
        ),
    ).prefetch_related(
        "instruments",
        "participants",
        "entries__participant",
        "entries__instrument",
        "holes__instrument",
        "link_groups__entries",
        "link_groups__holes",
        "played_passages",
        "client_actions",
    )


@api_view(["GET"])
def api_root(_request):
    return Response({"name": "Confiture API", "status": "ready"})


class JamListCreateView(generics.ListCreateAPIView):
    serializer_class = JamListSerializer

    def get_queryset(self):
        return jam_queryset()


class JamDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = JamDetailSerializer
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        return jam_queryset()


class JamActionsView(APIView):
    def get(self, _request, jam_id):
        jam = get_object_or_404(Jam, id=jam_id)
        serializer = ClientActionSerializer(jam.client_actions.all(), many=True)
        return Response(serializer.data)

    def post(self, request, jam_id):
        jam = get_object_or_404(Jam, id=jam_id)
        serializer = ClientActionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            client_action, applied = record_and_apply_action(
                jam,
                client_action_id=data["client_action_id"],
                action_type=data["type"],
                payload=data.get("payload", {}),
            )
        except (ActionApplicationError, IntegrityError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        response_status = status.HTTP_201_CREATED if applied else status.HTTP_200_OK
        return Response(
            {
                "status": client_action.status,
                "applied": applied,
                "duplicate": not applied,
                "action": ClientActionSerializer(client_action).data,
            },
            status=response_status,
        )


def _get_lock_token(request):
    return (
        request.data.get("editing_lock_token")
        or request.data.get("editingLockToken")
        or request.data.get("lock_token")
        or request.data.get("lockToken")
    )


class LockEditingView(APIView):
    def post(self, request, jam_id):
        jam = get_object_or_404(Jam, id=jam_id)
        client_id = request.data.get("client_id") or request.data.get("clientId")
        lock_token = _get_lock_token(request)
        if not client_id:
            return Response({"detail": "client_id est obligatoire."}, status=status.HTTP_400_BAD_REQUEST)
        if not lock_token:
            return Response({"detail": "editing_lock_token est obligatoire."}, status=status.HTTP_400_BAD_REQUEST)

        if not jam.lock_editing(client_id, lock_token):
            return Response(
                {
                    "detail": "Cette jam est déjà ouverte en édition sur un autre appareil.",
                    "hint": "Réessaie plus tard.",
                    "locked_by": jam.editing_locked_by,
                    "locked_at": jam.editing_locked_at,
                },
                status=423,
            )

        return Response({
            "status": "locked",
            "locked_by": jam.editing_locked_by,
            "locked_at": jam.editing_locked_at,
            "expires_after_seconds": int(Jam.EDITING_LOCK_TTL.total_seconds()),
        })


class UnlockEditingView(APIView):
    def post(self, request, jam_id):
        jam = get_object_or_404(Jam, id=jam_id)
        lock_token = _get_lock_token(request)
        if not lock_token:
            return Response({"detail": "editing_lock_token est obligatoire."}, status=status.HTTP_400_BAD_REQUEST)

        if not jam.unlock_editing(lock_token):
            return Response(
                {
                    "detail": "Cette jam est verrouillée par un autre appareil.",
                    "locked_by": jam.editing_locked_by,
                    "locked_at": jam.editing_locked_at,
                },
                status=423,
            )

        return Response({"status": "unlocked"})
