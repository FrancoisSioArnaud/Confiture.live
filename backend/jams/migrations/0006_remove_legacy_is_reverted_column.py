from django.db import migrations


def table_columns(cursor, table_name):
    cursor.execute(f"PRAGMA table_info({table_name})")
    return {row[1] for row in cursor.fetchall()}


def remove_legacy_is_reverted_column(apps, schema_editor):
    """Remove the legacy is_reverted column left by earlier SQLite schemas.

    The current model uses JamTransaction.reverted. Some production SQLite
    databases still have an extra NOT NULL is_reverted column without a
    database default. Django does not know that legacy column, so inserts into
    jams_jamtransaction fail with:
    NOT NULL constraint failed: jams_jamtransaction.is_reverted.
    """
    if schema_editor.connection.vendor != "sqlite":
        return

    with schema_editor.connection.cursor() as cursor:
        columns = table_columns(cursor, "jams_jamtransaction")
        if "reverted" not in columns:
            cursor.execute("ALTER TABLE jams_jamtransaction ADD COLUMN reverted bool NOT NULL DEFAULT 0")
            columns = table_columns(cursor, "jams_jamtransaction")

        if "is_reverted" not in columns:
            return

        cursor.execute("UPDATE jams_jamtransaction SET reverted = COALESCE(is_reverted, reverted, 0)")
        cursor.execute("ALTER TABLE jams_jamtransaction DROP COLUMN is_reverted")


def noop_reverse(apps, schema_editor):
    # Do not recreate the broken legacy column on rollback.
    return


class Migration(migrations.Migration):
    dependencies = [
        ("jams", "0005_repair_event_store_schema_columns"),
    ]

    operations = [
        migrations.RunPython(remove_legacy_is_reverted_column, noop_reverse),
    ]
