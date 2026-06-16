import uuid

from django.db import models
from django.utils import timezone


def generate_jam_id():
    return f"jam_{uuid.uuid4().hex}"


def generate_snapshot_id():
    return f"snapshot_{uuid.uuid4().hex}"


def generate_session_id():
    return f"session_{uuid.uuid4().hex}"


class Jam(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        ARCHIVED = "archived", "Archived"

    jam_id = models.CharField(max_length=64, unique=True, default=generate_jam_id)
    name = models.CharField(max_length=255)
    indicative_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    link_reorder_strategy = models.CharField(max_length=32, default="move_to_first")
    latest_server_sequence_number = models.PositiveIntegerField(default=0)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.jam_id})"


class JamTransaction(models.Model):
    jam = models.ForeignKey(Jam, related_name="transactions", on_delete=models.CASCADE)
    transaction_id = models.CharField(max_length=96, unique=True)
    client_id = models.CharField(max_length=96)
    client_sequence_number = models.PositiveIntegerField()
    server_sequence_number_start = models.PositiveIntegerField()
    server_sequence_number_end = models.PositiveIntegerField()
    schema_version = models.PositiveIntegerField(default=1)
    payload = models.JSONField(default=dict, blank=True)
    reverted = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["server_sequence_number_start", "id"]
        constraints = [models.UniqueConstraint(fields=["jam", "client_id", "client_sequence_number"], name="unique_client_transaction_sequence_per_jam")]

    def __str__(self):
        return f"{self.transaction_id} — {self.jam.jam_id}"


class JamEvent(models.Model):
    jam = models.ForeignKey(Jam, related_name="events", on_delete=models.CASCADE)
    transaction = models.ForeignKey(JamTransaction, related_name="events", on_delete=models.CASCADE)
    event_id = models.CharField(max_length=96, unique=True)
    type = models.CharField(max_length=96)
    payload = models.JSONField(default=dict, blank=True)
    schema_version = models.PositiveIntegerField(default=1)
    client_id = models.CharField(max_length=96)
    client_sequence_number = models.PositiveIntegerField()
    server_sequence_number = models.PositiveIntegerField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["server_sequence_number", "id"]
        constraints = [models.UniqueConstraint(fields=["jam", "server_sequence_number"], name="unique_server_event_sequence_per_jam")]

    def __str__(self):
        return f"{self.server_sequence_number} {self.type} — {self.jam.jam_id}"


class JamSnapshot(models.Model):
    snapshot_id = models.CharField(max_length=96, unique=True, default=generate_snapshot_id)
    jam = models.ForeignKey(Jam, related_name="snapshots", on_delete=models.CASCADE)
    client_id = models.CharField(max_length=96)
    last_server_sequence_number = models.PositiveIntegerField()
    payload = models.JSONField(default=dict, blank=True)
    schema_version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-last_server_sequence_number", "-created_at"]

    def __str__(self):
        return self.snapshot_id


class JamClientSession(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        RELEASED = "released", "Released"
        EXPIRED = "expired", "Expired"

    session_id = models.CharField(max_length=96, unique=True, default=generate_session_id)
    lease_token = models.CharField(max_length=96, unique=True, default=generate_session_id)
    jam = models.ForeignKey(Jam, related_name="client_sessions", on_delete=models.CASCADE)
    client_id = models.CharField(max_length=96)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    lease_expires_at = models.DateTimeField()
    acquired_at = models.DateTimeField(default=timezone.now)
    last_heartbeat_at = models.DateTimeField(default=timezone.now)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-last_heartbeat_at"]

    def __str__(self):
        return f"{self.client_id} — {self.jam.jam_id}"
