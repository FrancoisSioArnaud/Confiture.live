from django.db import migrations


def table_columns(cursor, table_name):
    cursor.execute(f"PRAGMA table_info({table_name})")
    return {row[1] for row in cursor.fetchall()}


def add_column_if_missing(cursor, table_name, column_name, column_definition):
    columns = table_columns(cursor, table_name)
    if column_name not in columns:
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_definition}")


def repair_event_store_schema_columns(apps, schema_editor):
    """Repair SQLite databases whose applied migration state predates current event-store models."""
    if schema_editor.connection.vendor != "sqlite":
        return

    with schema_editor.connection.cursor() as cursor:
        add_column_if_missing(
            cursor,
            "jams_jamtransaction",
            "payload",
            "payload TEXT NOT NULL DEFAULT '{}'",
        )
        add_column_if_missing(
            cursor,
            "jams_jamtransaction",
            "reverted",
            "reverted bool NOT NULL DEFAULT 0",
        )

        transaction_columns = table_columns(cursor, "jams_jamtransaction")
        if "is_reverted" in transaction_columns and "reverted" in transaction_columns:
            cursor.execute("UPDATE jams_jamtransaction SET reverted = COALESCE(is_reverted, 0)")

        add_column_if_missing(
            cursor,
            "jams_jamevent",
            "client_id",
            "client_id varchar(96) NOT NULL DEFAULT ''",
        )
        add_column_if_missing(
            cursor,
            "jams_jamevent",
            "client_sequence_number",
            "client_sequence_number integer unsigned NOT NULL DEFAULT 0",
        )

        event_columns = table_columns(cursor, "jams_jamevent")
        transaction_columns = table_columns(cursor, "jams_jamtransaction")
        if "client_id" in event_columns and "client_id" in transaction_columns:
            cursor.execute(
                """
                UPDATE jams_jamevent
                SET client_id = COALESCE((
                    SELECT jams_jamtransaction.client_id
                    FROM jams_jamtransaction
                    WHERE jams_jamtransaction.id = jams_jamevent.transaction_id
                ), client_id)
                WHERE client_id = ''
                """
            )
        if "client_sequence_number" in event_columns and "client_sequence_number" in transaction_columns:
            cursor.execute(
                """
                UPDATE jams_jamevent
                SET client_sequence_number = COALESCE((
                    SELECT jams_jamtransaction.client_sequence_number
                    FROM jams_jamtransaction
                    WHERE jams_jamtransaction.id = jams_jamevent.transaction_id
                ), client_sequence_number)
                WHERE client_sequence_number = 0
                """
            )


def noop_reverse(apps, schema_editor):
    # Intentionally keep repaired columns on rollback to avoid data loss.
    return


class Migration(migrations.Migration):
    dependencies = [
        ("jams", "0004_repair_jam_metadata_column"),
    ]

    # This repairs SQLite databases where 0001_initial was applied before the
    # current event-store columns existed. It is idempotent so it also runs
    # safely on clean databases where these columns already exist.
    operations = [
        migrations.RunPython(repair_event_store_schema_columns, noop_reverse),
    ]
