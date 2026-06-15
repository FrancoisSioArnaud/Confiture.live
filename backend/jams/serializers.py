from rest_framework import serializers
from .models import Jam, JamClientSession, JamEvent, JamSnapshot, JamTransaction


class JamSerializer(serializers.ModelSerializer):
    jamId = serializers.CharField(source="jam_id", read_only=True)
    indicativeDate = serializers.DateField(source="indicative_date", required=False, allow_null=True)
    latestServerSequenceNumber = serializers.IntegerField(source="latest_server_sequence_number", read_only=True)
    linkReorderStrategy = serializers.CharField(source="link_reorder_strategy", required=False)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = Jam
        fields = ["jamId", "name", "indicativeDate", "status", "linkReorderStrategy", "latestServerSequenceNumber", "metadata", "createdAt", "updatedAt"]


class JamTransactionSerializer(serializers.ModelSerializer):
    transactionId = serializers.CharField(source="transaction_id")
    clientId = serializers.CharField(source="client_id")
    clientSequenceNumber = serializers.IntegerField(source="client_sequence_number")
    serverSequenceNumberStart = serializers.IntegerField(source="server_sequence_number_start")
    serverSequenceNumberEnd = serializers.IntegerField(source="server_sequence_number_end")
    schemaVersion = serializers.IntegerField(source="schema_version")

    class Meta:
        model = JamTransaction
        fields = ["transactionId", "clientId", "clientSequenceNumber", "serverSequenceNumberStart", "serverSequenceNumberEnd", "schemaVersion", "payload", "reverted", "created_at"]


class JamEventSerializer(serializers.ModelSerializer):
    eventId = serializers.CharField(source="event_id")
    transactionId = serializers.CharField(source="transaction.transaction_id", read_only=True)
    schemaVersion = serializers.IntegerField(source="schema_version")
    clientId = serializers.CharField(source="client_id")
    clientSequenceNumber = serializers.IntegerField(source="client_sequence_number")
    serverSequenceNumber = serializers.IntegerField(source="server_sequence_number")

    class Meta:
        model = JamEvent
        fields = ["eventId", "transactionId", "type", "payload", "schemaVersion", "clientId", "clientSequenceNumber", "serverSequenceNumber", "created_at"]


class JamSnapshotSerializer(serializers.ModelSerializer):
    snapshotId = serializers.CharField(source="snapshot_id")
    clientId = serializers.CharField(source="client_id")
    lastServerSequenceNumber = serializers.IntegerField(source="last_server_sequence_number")
    schemaVersion = serializers.IntegerField(source="schema_version")

    class Meta:
        model = JamSnapshot
        fields = ["snapshotId", "clientId", "lastServerSequenceNumber", "payload", "schemaVersion", "created_at"]


class JamClientSessionSerializer(serializers.ModelSerializer):
    sessionId = serializers.CharField(source="session_id")
    clientId = serializers.CharField(source="client_id")
    leaseToken = serializers.CharField(source="lease_token")
    leaseExpiresAt = serializers.DateTimeField(source="lease_expires_at")
    acquiredAt = serializers.DateTimeField(source="acquired_at")
    lastHeartbeatAt = serializers.DateTimeField(source="last_heartbeat_at")

    class Meta:
        model = JamClientSession
        fields = ["sessionId", "leaseToken", "clientId", "status", "leaseExpiresAt", "acquiredAt", "lastHeartbeatAt", "metadata"]
