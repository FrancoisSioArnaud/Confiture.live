import pytest
from django.core.management import call_command

from jams.models import Jam, JamEvent, JamTransaction

pytestmark = pytest.mark.django_db


def test_seed_demo_jams_only_simple_is_idempotent():
    call_command('seed_demo_jams', only='simple')
    call_command('seed_demo_jams', only='simple')

    jam = Jam.objects.get(jam_id='jam_demo_simple')
    assert jam.name == 'Jam simple — 4 instruments'
    assert JamTransaction.objects.filter(jam=jam).count() == 9
    assert JamEvent.objects.filter(jam=jam, type='jam_created').count() == 1
    assert JamEvent.objects.filter(jam=jam, type='participant_created').count() == 8


def test_seed_demo_jams_reset_and_all_use_event_streams():
    call_command('seed_demo_jams', reset=True)

    assert Jam.objects.filter(jam_id__startswith='jam_demo_').count() == 6
    assert JamTransaction.objects.filter(jam__jam_id__startswith='jam_demo_').exists()
    assert JamEvent.objects.filter(jam__jam_id='jam_demo_complex', type='transaction_reverted').exists()
    assert not JamEvent.objects.filter(type__in=['play_without_created', 'play_without_removed', 'link_updated', 'conflict_updated']).exists()
