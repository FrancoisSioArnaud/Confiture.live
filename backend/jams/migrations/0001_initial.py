# Generated for Confiture V0 backend models.
import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Jam",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=255)),
                ("indicative_date", models.DateField(blank=True, null=True)),
                ("editing_locked_by", models.CharField(blank=True, max_length=255, null=True)),
                ("editing_locked_at", models.DateTimeField(blank=True, null=True)),
            ],
            options={"ordering": ["indicative_date", "name"]},
        ),
        migrations.CreateModel(
            name="ClientAction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("client_action_id", models.CharField(max_length=255, unique=True)),
                ("type", models.CharField(max_length=64)),
                ("payload", models.JSONField(blank=True, default=dict)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("synced", "Synced"), ("failed", "Failed")], default="pending", max_length=16)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("synced_at", models.DateTimeField(blank=True, null=True)),
                ("jam", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="client_actions", to="jams.jam")),
            ],
            options={"ordering": ["created_at", "id"]},
        ),
        migrations.CreateModel(
            name="Instrument",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=120)),
                ("order", models.PositiveIntegerField(default=0)),
                ("is_default", models.BooleanField(default=True)),
                ("jam", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="instruments", to="jams.jam")),
            ],
            options={"ordering": ["order", "name"], "unique_together": {("jam", "name")}},
        ),
        migrations.CreateModel(
            name="Participant",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=255)),
                ("status", models.CharField(choices=[("active", "Active"), ("left", "Left")], default="active", max_length=16)),
                ("jam", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="participants", to="jams.jam")),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="Hole",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("position", models.PositiveIntegerField(default=0)),
                ("created_by_action", models.CharField(max_length=64)),
                ("instrument", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="holes", to="jams.instrument")),
                ("jam", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="holes", to="jams.jam")),
            ],
            options={"ordering": ["instrument__order", "position", "id"]},
        ),
        migrations.CreateModel(
            name="ParticipantEntry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("custom_instrument_label", models.CharField(blank=True, max_length=120, null=True)),
                ("base_order", models.PositiveIntegerField(default=0)),
                ("instrument", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="entries", to="jams.instrument")),
                ("jam", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="entries", to="jams.jam")),
                ("participant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="entries", to="jams.participant")),
            ],
            options={"ordering": ["instrument__order", "base_order", "id"]},
        ),
        migrations.CreateModel(
            name="LinkGroup",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("entries", models.ManyToManyField(blank=True, related_name="link_groups", to="jams.participantentry")),
                ("holes", models.ManyToManyField(blank=True, related_name="link_groups", to="jams.hole")),
                ("jam", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="link_groups", to="jams.jam")),
            ],
            options={"ordering": ["id"]},
        ),
        migrations.CreateModel(
            name="PlayedPassage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("line_index", models.PositiveIntegerField(default=0)),
                ("played_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("hole", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="played_passages", to="jams.hole")),
                ("jam", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="played_passages", to="jams.jam")),
                ("participant_entry", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="played_passages", to="jams.participantentry")),
            ],
            options={"ordering": ["line_index", "played_at", "id"]},
        ),
        migrations.AddConstraint(
            model_name="participant",
            constraint=models.UniqueConstraint(fields=("jam", "name"), name="unique_participant_name_per_jam"),
        ),
    ]
