import jams.models
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("jams", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="jamclientsession",
            name="lease_token",
            field=models.CharField(default=jams.models.generate_snapshot_id, max_length=96, unique=True),
        ),
    ]
