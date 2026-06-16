# Generated for Confiture.live V0 foundation
import django.db.models.deletion
import jams.models
from django.utils import timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [
        migrations.CreateModel(
            name='Jam',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('jam_id', models.CharField(default=jams.models.generate_jam_id, max_length=64, unique=True)),
                ('name', models.CharField(max_length=255)),
                ('indicative_date', models.DateField(blank=True, null=True)),
                ('status', models.CharField(choices=[('active', 'Active'), ('archived', 'Archived')], default='active', max_length=16)),
                ('link_reorder_strategy', models.CharField(default='move_to_first', max_length=32)),
                ('latest_server_sequence_number', models.PositiveIntegerField(default=0)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(default=timezone.now)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name='JamClientSession',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('session_id', models.CharField(default=jams.models.generate_snapshot_id, max_length=96, unique=True)),
                ('client_id', models.CharField(max_length=96)),
                ('status', models.CharField(choices=[('active', 'Active'), ('released', 'Released'), ('expired', 'Expired')], default='active', max_length=16)),
                ('lease_expires_at', models.DateTimeField()),
                ('acquired_at', models.DateTimeField(default=timezone.now)),
                ('last_heartbeat_at', models.DateTimeField(default=timezone.now)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('jam', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='client_sessions', to='jams.jam')),
            ],
            options={'ordering': ['-last_heartbeat_at']},
        ),
        migrations.CreateModel(
            name='JamSnapshot',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('snapshot_id', models.CharField(default=jams.models.generate_snapshot_id, max_length=96, unique=True)),
                ('client_id', models.CharField(max_length=96)),
                ('last_server_sequence_number', models.PositiveIntegerField()),
                ('payload', models.JSONField(blank=True, default=dict)),
                ('schema_version', models.PositiveIntegerField(default=1)),
                ('created_at', models.DateTimeField(default=timezone.now)),
                ('jam', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='snapshots', to='jams.jam')),
            ],
            options={'ordering': ['-last_server_sequence_number', '-created_at']},
        ),
        migrations.CreateModel(
            name='JamTransaction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('transaction_id', models.CharField(max_length=96, unique=True)),
                ('client_id', models.CharField(max_length=96)),
                ('client_sequence_number', models.PositiveIntegerField()),
                ('server_sequence_number_start', models.PositiveIntegerField()),
                ('server_sequence_number_end', models.PositiveIntegerField()),
                ('schema_version', models.PositiveIntegerField(default=1)),
                ('payload', models.JSONField(blank=True, default=dict)),
                ('reverted', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(default=timezone.now)),
                ('jam', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='transactions', to='jams.jam')),
            ],
            options={'ordering': ['server_sequence_number_start', 'id']},
        ),
        migrations.CreateModel(
            name='JamEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_id', models.CharField(max_length=96, unique=True)),
                ('type', models.CharField(max_length=96)),
                ('payload', models.JSONField(blank=True, default=dict)),
                ('schema_version', models.PositiveIntegerField(default=1)),
                ('client_id', models.CharField(max_length=96)),
                ('client_sequence_number', models.PositiveIntegerField()),
                ('server_sequence_number', models.PositiveIntegerField()),
                ('created_at', models.DateTimeField(default=timezone.now)),
                ('jam', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='events', to='jams.jam')),
                ('transaction', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='events', to='jams.jamtransaction')),
            ],
            options={'ordering': ['server_sequence_number', 'id']},
        ),
        migrations.AddConstraint(model_name='jamtransaction', constraint=models.UniqueConstraint(fields=('jam', 'client_id', 'client_sequence_number'), name='unique_client_transaction_sequence_per_jam')),
        migrations.AddConstraint(model_name='jamevent', constraint=models.UniqueConstraint(fields=('jam', 'server_sequence_number'), name='unique_server_event_sequence_per_jam')),
    ]
