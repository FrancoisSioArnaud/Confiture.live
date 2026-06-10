from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("jams", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="jam",
            name="editing_lock_token",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]
