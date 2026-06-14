from django.db import models


class Jam(models.Model):
    jam_id = models.CharField(max_length=80, unique=True)
    name = models.CharField(max_length=200)
    indicative_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, default='active')
    link_reorder_strategy = models.CharField(max_length=40, default='move_to_first')
    latest_server_sequence_number = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class JamTransaction(models.Model):
    jam = models.ForeignKey(Jam, on_delete=models.CASCADE, related_name='transactions')
    transaction_id = models.CharField(max_length=100, unique=True)
    client_id = models.CharField(max_length=100)
    client_sequence_number = models.PositiveIntegerField()
    schema_version = models.PositiveIntegerField(default=1)
    server_sequence_number_start = models.PositiveIntegerField()
    server_sequence_number_end = models.PositiveIntegerField()
    is_reverted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['server_sequence_number_start', 'id']
        constraints = [models.UniqueConstraint(fields=['jam','client_id','client_sequence_number'], name='unique_client_sequence_per_jam')]


class JamEvent(models.Model):
    jam = models.ForeignKey(Jam, on_delete=models.CASCADE, related_name='events')
    transaction = models.ForeignKey(JamTransaction, on_delete=models.CASCADE, related_name='events')
    event_id = models.CharField(max_length=100, unique=True)
    type = models.CharField(max_length=80)
    payload = models.JSONField(default=dict)
    schema_version = models.PositiveIntegerField(default=1)
    server_sequence_number = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['server_sequence_number', 'id']


class JamSnapshot(models.Model):
    jam = models.ForeignKey(Jam, on_delete=models.CASCADE, related_name='snapshots')
    snapshot_id = models.CharField(max_length=100, unique=True)
    last_server_sequence_number = models.PositiveIntegerField()
    state = models.JSONField(default=dict)
    created_by_client_id = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-last_server_sequence_number', '-created_at']


class JamClientSession(models.Model):
    jam = models.ForeignKey(Jam, on_delete=models.CASCADE, related_name='client_sessions')
    client_id = models.CharField(max_length=100)
    lease_token = models.CharField(max_length=120)
    is_active = models.BooleanField(default=True)
    lease_expires_at = models.DateTimeField()
    last_heartbeat_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['jam','client_id'], name='unique_client_session_per_jam')]
