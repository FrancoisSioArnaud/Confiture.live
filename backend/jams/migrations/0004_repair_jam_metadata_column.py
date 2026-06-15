from django.db import migrations


def add_missing_jam_metadata_column(apps, schema_editor):
    """Repair SQLite databases whose applied migration state predates Jam.metadata."""
    if schema_editor.connection.vendor != "sqlite":
        return

    with schema_editor.connection.cursor() as cursor:
        cursor.execute("PRAGMA table_info(jams_jam)")
        columns = {row[1] for row in cursor.fetchall()}
        if "metadata" in columns:
            return
        cursor.execute("ALTER TABLE jams_jam ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}'")


def noop_reverse(apps, schema_editor):
    # Intentionally keep jams_jam.metadata on rollback to avoid data loss.
    return


class Migration(migrations.Migration):
    dependencies = [
        ("jams", "0003_alter_jamclientsession_session_id_and_more"),
    ]

    # This repairs SQLite databases where 0001_initial was applied before
    # Jam.metadata was added. It is idempotent so it also runs safely on
    # clean databases where the metadata column already exists.
    operations = [
        migrations.RunPython(add_missing_jam_metadata_column, noop_reverse),
    ]
