import pytest
from django.core.management import call_command

from jams.models import Jam, JamEvent, JamSnapshot, JamTransaction


@pytest.mark.django_db
def test_seed_demo_jams_simple_creates_event_sourced_rows():
    call_command("seed_demo_jams", "--only", "simple")

    jam = Jam.objects.get(jam_id="jam_demo_simple")
    assert jam.metadata["demoSeed"] == "simple"
    assert JamTransaction.objects.filter(jam=jam).count() > 0
    assert JamEvent.objects.filter(jam=jam, type="participant_created").count() == 8
    assert jam.latest_server_sequence_number == JamEvent.objects.filter(jam=jam).count()


@pytest.mark.django_db
def test_seed_demo_jams_reset_recreates_selected_seed():
    call_command("seed_demo_jams", "--only", "complex")
    first_event_count = JamEvent.objects.filter(jam__jam_id="jam_demo_complex").count()

    call_command("seed_demo_jams", "--reset", "--only", "complex")

    jam = Jam.objects.get(jam_id="jam_demo_complex")
    assert JamEvent.objects.filter(jam=jam).count() == first_event_count
    assert JamSnapshot.objects.filter(jam=jam, snapshot_id="snapshot_demo_complex_latest").exists()
