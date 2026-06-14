from rest_framework import serializers
from .models import Jam, JamClientSession, JamEvent, JamSnapshot, JamTransaction

class JamSerializer(serializers.ModelSerializer):
    jamId = serializers.CharField(source='jam_id')
    indicativeDate = serializers.DateField(source='indicative_date', allow_null=True)
    latestServerSequenceNumber = serializers.IntegerField(source='latest_server_sequence_number')
    updatedAt = serializers.DateTimeField(source='updated_at')
    class Meta:
        model = Jam
        fields = ['jamId','name','indicativeDate','status','link_reorder_strategy','latestServerSequenceNumber','updatedAt']

class JamEventSerializer(serializers.ModelSerializer):
    eventId = serializers.CharField(source='event_id')
    serverSequenceNumber = serializers.IntegerField(source='server_sequence_number')
    schemaVersion = serializers.IntegerField(source='schema_version')
    class Meta:
        model = JamEvent
        fields = ['eventId','type','payload','schemaVersion','serverSequenceNumber','created_at']

class JamTransactionSerializer(serializers.ModelSerializer):
    transactionId = serializers.CharField(source='transaction_id')
    clientId = serializers.CharField(source='client_id')
    clientSequenceNumber = serializers.IntegerField(source='client_sequence_number')
    schemaVersion = serializers.IntegerField(source='schema_version')
    serverSequenceNumberStart = serializers.IntegerField(source='server_sequence_number_start')
    serverSequenceNumberEnd = serializers.IntegerField(source='server_sequence_number_end')
    class Meta:
        model = JamTransaction
        fields = ['transactionId','clientId','clientSequenceNumber','schemaVersion','serverSequenceNumberStart','serverSequenceNumberEnd','created_at']

class JamSnapshotSerializer(serializers.ModelSerializer):
    snapshotId = serializers.CharField(source='snapshot_id')
    lastServerSequenceNumber = serializers.IntegerField(source='last_server_sequence_number')
    createdByClientId = serializers.CharField(source='created_by_client_id')
    class Meta:
        model = JamSnapshot
        fields = ['snapshotId','lastServerSequenceNumber','state','createdByClientId','created_at']

class JamClientSessionSerializer(serializers.ModelSerializer):
    clientId = serializers.CharField(source='client_id')
    leaseToken = serializers.CharField(source='lease_token')
    leaseExpiresAt = serializers.DateTimeField(source='lease_expires_at')
    class Meta:
        model = JamClientSession
        fields = ['clientId','leaseToken','is_active','leaseExpiresAt','last_heartbeat_at']
