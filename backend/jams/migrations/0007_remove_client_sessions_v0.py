from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("jams", "0006_remove_legacy_is_reverted_column"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="jamtransaction",
            name="unique_client_transaction_sequence_per_jam",
        ),
        migrations.DeleteModel(
            name="JamClientSession",
        ),
    ]
