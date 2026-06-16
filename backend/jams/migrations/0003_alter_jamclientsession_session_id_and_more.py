import jams.models
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("jams", "0002_jamclientsession_lease_token"),
    ]

    operations = [
        migrations.AlterField(
            model_name="jamclientsession",
            name="session_id",
            field=models.CharField(default=jams.models.generate_snapshot_id, max_length=96, unique=True),
        ),
        migrations.AlterField(
            model_name="jamsnapshot",
            name="snapshot_id",
            field=models.CharField(default=jams.models.generate_snapshot_id, max_length=96, unique=True),
        ),
    ]
