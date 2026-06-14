from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import Jam
from .serializers import JamEventSerializer, JamSerializer, JamSnapshotSerializer, JamTransactionSerializer, JamClientSessionSerializer
from .services.sessions import acquire_lease
from .services.snapshots import create_snapshot, latest_snapshot
from .services.transactions import push_transaction

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
        jam.name = request.data.get('name', jam.name); jam.save(update_fields=['name','updated_at'])
    from_seq = int(request.query_params.get('fromSequence', 0) or 0)
    return Response({'jam': JamSerializer(jam).data, 'snapshot': JamSnapshotSerializer(latest_snapshot(jam)).data if latest_snapshot(jam) else None, 'transactions': JamTransactionSerializer(jam.transactions.filter(server_sequence_number_end__gt=from_seq), many=True).data, 'events': JamEventSerializer(jam.events.filter(server_sequence_number__gt=from_seq), many=True).data})

@api_view(['POST'])
def jam_transactions(request, jam_id):
    jam = get_object_or_404(Jam, jam_id=jam_id)
    tx, created = push_transaction(jam, request.data.get('clientId'), request.data.get('transaction'))
    return Response({'transactionId': tx.transaction_id, 'created': created, 'serverSequenceNumberStart': tx.server_sequence_number_start, 'serverSequenceNumberEnd': tx.server_sequence_number_end})

@api_view(['GET','POST'])
def jam_snapshots(request, jam_id):
    jam = get_object_or_404(Jam, jam_id=jam_id)
    if request.method == 'POST':
        snapshot = create_snapshot(jam, request.data, request.data.get('clientId'))
        return Response(JamSnapshotSerializer(snapshot).data, status=status.HTTP_201_CREATED)
    snapshot = latest_snapshot(jam)
    return Response(JamSnapshotSerializer(snapshot).data if snapshot else None)

@api_view(['POST'])
def jam_lease(request, jam_id):
    session = acquire_lease(get_object_or_404(Jam, jam_id=jam_id), request.data.get('clientId'), request.data.get('force', False))
    return Response(JamClientSessionSerializer(session).data)
