from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import Jam
from .serializers import JamEventSerializer, JamSerializer, JamSnapshotSerializer, JamTransactionSerializer
from .services.sessions import HEARTBEAT_INTERVAL_SECONDS, acquire_lease, heartbeat_lease, release_lease
from .services.snapshots import create_snapshot, latest_snapshot
from .services.transactions import push_transaction


def session_payload(session, status_label):
    return {
        'status': status_label,
        'clientId': session.client_id,
        'leaseToken': session.lease_token,
        'leaseExpiresAt': session.lease_expires_at,
        'heartbeatIntervalSeconds': HEARTBEAT_INTERVAL_SECONDS,
    }


@api_view(['GET'])
def health(request):
    return Response({'status': 'ok'})


@api_view(['GET','POST'])
def jams_collection(request):
    if request.method == 'GET':
        return Response({'results': JamSerializer(Jam.objects.all().order_by('-updated_at'), many=True).data})
    client_id = request.data.get('clientId')
    tx_payload = request.data.get('transaction')
    first_event = (tx_payload or {}).get('events', [{}])[0]
    jam_id = first_event.get('payload', {}).get('jamId') or request.data.get('jamId')
    jam = Jam.objects.create(jam_id=jam_id, name=first_event.get('payload', {}).get('name', 'Nouvelle jam'))
    acquire_lease(jam, client_id)
    tx, _ = push_transaction(jam, client_id, tx_payload, require_lease=False)
    return Response({'jamId': jam.jam_id, 'latestServerSequenceNumber': jam.latest_server_sequence_number, 'transactionAck': {'transactionId': tx.transaction_id, 'serverSequenceNumberStart': tx.server_sequence_number_start, 'serverSequenceNumberEnd': tx.server_sequence_number_end}}, status=status.HTTP_201_CREATED)


@api_view(['GET','PATCH'])
def jam_detail(request, jam_id):
    jam = get_object_or_404(Jam, jam_id=jam_id)
    if request.method == 'PATCH':
        jam.name = request.data.get('name', jam.name)
        jam.indicative_date = request.data.get('indicativeDate') or jam.indicative_date
        jam.link_reorder_strategy = request.data.get('linkReorderStrategy', jam.link_reorder_strategy)
        jam.save(update_fields=['name','indicative_date','link_reorder_strategy','updated_at'])
    from_seq = int(request.query_params.get('fromSequence', 0) or 0)
    snapshot = latest_snapshot(jam)
    return Response({'jam': JamSerializer(jam).data, 'snapshot': JamSnapshotSerializer(snapshot).data if snapshot else None, 'transactions': JamTransactionSerializer(jam.transactions.filter(server_sequence_number_end__gt=from_seq), many=True).data, 'events': JamEventSerializer(jam.events.filter(server_sequence_number__gt=from_seq), many=True).data})


@api_view(['GET','POST'])
def jam_transactions(request, jam_id):
    jam = get_object_or_404(Jam, jam_id=jam_id)
    if request.method == 'GET':
        from_seq = int(request.query_params.get('fromServerSequenceNumber', request.query_params.get('fromSequence', 0)) or 0)
        return Response({'latestServerSequenceNumber': jam.latest_server_sequence_number, 'transactions': JamTransactionSerializer(jam.transactions.filter(server_sequence_number_end__gt=from_seq), many=True).data, 'events': JamEventSerializer(jam.events.filter(server_sequence_number__gt=from_seq), many=True).data})
    tx, created = push_transaction(jam, request.data.get('clientId'), request.data.get('transaction'))
    return Response({'status': 'accepted' if created else 'already_accepted', 'transactionId': tx.transaction_id, 'created': created, 'serverSequenceNumberStart': tx.server_sequence_number_start, 'serverSequenceNumberEnd': tx.server_sequence_number_end, 'latestServerSequenceNumber': jam.latest_server_sequence_number})


@api_view(['GET','POST'])
def jam_snapshots(request, jam_id):
    jam = get_object_or_404(Jam, jam_id=jam_id)
    if request.method == 'POST':
        data = request.data.get('snapshot', request.data)
        snapshot = create_snapshot(jam, data, request.data.get('clientId'))
        return Response({'status': 'accepted', 'snapshotId': snapshot.snapshot_id, 'lastServerSequenceNumber': snapshot.last_server_sequence_number}, status=status.HTTP_201_CREATED)
    snapshot = latest_snapshot(jam)
    return Response({'snapshot': JamSnapshotSerializer(snapshot).data if snapshot else None})


@api_view(['GET'])
def latest_jam_snapshot(request, jam_id):
    snapshot = latest_snapshot(get_object_or_404(Jam, jam_id=jam_id))
    return Response({'snapshot': JamSnapshotSerializer(snapshot).data if snapshot else None})


@api_view(['POST'])
def client_session_acquire(request, jam_id):
    session = acquire_lease(get_object_or_404(Jam, jam_id=jam_id), request.data.get('clientId'), request.data.get('force', False))
    return Response(session_payload(session, 'acquired'))


@api_view(['POST'])
def client_session_heartbeat(request, jam_id):
    session = heartbeat_lease(get_object_or_404(Jam, jam_id=jam_id), request.data.get('clientId'), request.data.get('leaseToken'))
    return Response(session_payload(session, 'renewed'))


@api_view(['POST'])
def client_session_release(request, jam_id):
    release_lease(get_object_or_404(Jam, jam_id=jam_id), request.data.get('clientId'), request.data.get('leaseToken'))
    return Response({'status': 'released'})


@api_view(['POST'])
def client_session_takeover(request, jam_id):
    if not request.data.get('confirm', False):
        return Response({'error': 'takeover_requires_confirmation'}, status=status.HTTP_400_BAD_REQUEST)
    session = acquire_lease(get_object_or_404(Jam, jam_id=jam_id), request.data.get('clientId'), force=True)
    return Response(session_payload(session, 'acquired'))


jam_lease = client_session_acquire
