from datetime import date

from django.core.management.base import BaseCommand
from django.db import transaction

from jams.models import Jam, JamEvent, JamTransaction

CLIENT_ID = 'demo_seed'
SCHEMA_VERSION = 1
DEFAULT_INSTRUMENTS = [
    ('instrument_vocals', 'Chant'),
    ('instrument_guitar', 'Guitare'),
    ('instrument_bass', 'Basse'),
    ('instrument_drums', 'Batterie'),
    ('instrument_piano', 'Piano'),
    ('instrument_other', 'Autre'),
]


def app_id(participation_id, round_index=1):
    return f'calculated:{participation_id}:{round_index}'


def tx(label, events):
    return {'label': label, 'events': events}


def event(event_type, payload):
    return {'type': event_type, 'payload': payload}


def create_jam_tx(jam_id, name, indicative_date='2026-01-15', instruments=None):
    instruments = instruments or DEFAULT_INSTRUMENTS
    return tx('Create jam', [
        event('jam_created', {'jamId': jam_id, 'name': name, 'indicativeDate': indicative_date, 'linkReorderStrategy': 'move_to_first'}),
        *[event('instrument_added', {'instrumentId': instrument_id, 'name': label, 'order': order, 'visible': True}) for order, (instrument_id, label) in enumerate(instruments)],
    ])


def participant_tx(name, instruments, prefix=None, start_round=1):
    participant_id = f'participant_{(prefix or name).lower()}'
    events = [event('participant_created', {'participantId': participant_id, 'name': name})]
    for index, instrument_id in enumerate(instruments):
        participation_id = f'participation_{participant_id.removeprefix("participant_")}_{instrument_id.removeprefix("instrument_")}'
        events.append(event('participation_added', {
            'participationId': participation_id,
            'participantId': participant_id,
            'instrumentId': instrument_id,
            'startAppearanceIndex': start_round,
            'baseOrderKey': f'{name.lower()}_{index}',
        }))
    return tx(f'Create participant {name}', events)


def simple_seed():
    instruments = DEFAULT_INSTRUMENTS[:4]
    return {
        'key': 'simple',
        'jam_id': 'jam_demo_simple',
        'name': 'Jam simple — 4 instruments',
        'indicative_date': date(2026, 1, 15),
        'transactions': [
            create_jam_tx('jam_demo_simple', 'Jam simple — 4 instruments', '2026-01-15', instruments),
            participant_tx('Sarah', ['instrument_vocals']),
            participant_tx('Nicolas', ['instrument_guitar']),
            participant_tx('Tom', ['instrument_bass']),
            participant_tx('Jérémy', ['instrument_drums'], 'jeremy'),
            participant_tx('Léa', ['instrument_vocals'], 'lea'),
            participant_tx('Paul', ['instrument_guitar']),
            participant_tx('Max', ['instrument_bass']),
            participant_tx('Rayan', ['instrument_drums']),
        ],
    }


def rounds_seed():
    seed = simple_seed()
    seed.update({'key': 'rounds', 'jam_id': 'jam_demo_rounds', 'name': 'Jam rounds — ajout après reveal', 'indicative_date': date(2026, 1, 16)})
    seed['transactions'][0] = create_jam_tx(seed['jam_id'], seed['name'], '2026-01-16', DEFAULT_INSTRUMENTS[:4])
    seed['transactions'].extend([
        tx('Reveal guitar and drums round 2', [
            event('instrument_round_visibility_changed', {'instrumentId': 'instrument_guitar', 'visibleRoundCount': 2}),
            event('instrument_round_visibility_changed', {'instrumentId': 'instrument_drums', 'visibleRoundCount': 2}),
        ]),
        participant_tx('Julie', ['instrument_guitar']),
        participant_tx('Emma', ['instrument_drums'], start_round=2),
    ])
    return seed


def links_seed():
    seed = simple_seed()
    seed.update({'key': 'links', 'jam_id': 'jam_demo_links_conflicts', 'name': 'Jam links et conflicts', 'indicative_date': date(2026, 1, 17)})
    seed['transactions'][0] = create_jam_tx(seed['jam_id'], seed['name'], '2026-01-17', DEFAULT_INSTRUMENTS[:5])
    seed['transactions'].extend([
        participant_tx('Alice', ['instrument_piano']),
        participant_tx('Hugo', ['instrument_guitar']),
        tx('Create demo links and conflict', [
            event('link_created', {'linkId': 'link_demo_nicolas_jeremy', 'anchorTarget': {'type': 'appearance', 'id': app_id('participation_nicolas_guitar')}, 'targets': [{'type': 'appearance', 'id': app_id('participation_nicolas_guitar')}, {'type': 'appearance', 'id': app_id('participation_jeremy_drums')}], 'reorderStrategy': 'move_to_first'}),
            event('link_created', {'linkId': 'link_demo_lea_paul_alice', 'anchorTarget': {'type': 'appearance', 'id': app_id('participation_lea_vocals')}, 'targets': [{'type': 'appearance', 'id': app_id('participation_lea_vocals')}, {'type': 'appearance', 'id': app_id('participation_paul_guitar')}, {'type': 'appearance', 'id': app_id('participation_alice_piano')}], 'reorderStrategy': 'move_to_first'}),
            event('conflict_created', {'conflictId': 'conflict_demo_sarah_hugo', 'scope': 'appearance', 'targetIds': [app_id('participation_sarah_vocals'), app_id('participation_hugo_guitar')], 'reason': 'manual', 'anchorTargetId': app_id('participation_sarah_vocals')}),
        ]),
    ])
    return seed


def multi_seed():
    return {
        'key': 'multi',
        'jam_id': 'jam_demo_multi_instruments',
        'name': 'Jam multi-instruments',
        'indicative_date': date(2026, 1, 18),
        'transactions': [
            create_jam_tx('jam_demo_multi_instruments', 'Jam multi-instruments', '2026-01-18', DEFAULT_INSTRUMENTS[:5]),
            participant_tx('Nicolas', ['instrument_vocals', 'instrument_guitar', 'instrument_bass']),
            participant_tx('Sarah', ['instrument_vocals', 'instrument_piano']),
            participant_tx('Tom', ['instrument_bass', 'instrument_drums']),
            participant_tx('Léa', ['instrument_vocals'], 'lea'),
            participant_tx('Jérémy', ['instrument_drums'], 'jeremy'),
            participant_tx('Paul', ['instrument_guitar']),
            participant_tx('Alice', ['instrument_piano']),
            tx('Multi constraints and links', [
                event('conflict_created', {'conflictId': 'conflict_nicolas_guitar_bass', 'scope': 'participation', 'targetIds': ['participation_nicolas_guitar', 'participation_nicolas_bass'], 'reason': 'instrument_constraint', 'anchorTargetId': 'participation_nicolas_guitar'}),
                event('conflict_created', {'conflictId': 'conflict_tom_bass_drums', 'scope': 'participation', 'targetIds': ['participation_tom_bass', 'participation_tom_drums'], 'reason': 'instrument_constraint', 'anchorTargetId': 'participation_tom_bass'}),
                event('link_created', {'linkId': 'link_nicolas_vocals_guitar_r1', 'anchorTarget': {'type': 'appearance', 'id': app_id('participation_nicolas_vocals')}, 'targets': [{'type': 'appearance', 'id': app_id('participation_nicolas_vocals')}, {'type': 'appearance', 'id': app_id('participation_nicolas_guitar')}], 'reorderStrategy': 'move_to_first'}),
                event('instrument_round_visibility_changed', {'instrumentId': 'instrument_vocals', 'visibleRoundCount': 2}),
                event('instrument_round_visibility_changed', {'instrumentId': 'instrument_guitar', 'visibleRoundCount': 2}),
                event('link_created', {'linkId': 'link_nicolas_guitar_r2_sarah_piano', 'anchorTarget': {'type': 'appearance', 'id': app_id('participation_nicolas_guitar', 2)}, 'targets': [{'type': 'appearance', 'id': app_id('participation_nicolas_guitar', 2)}, {'type': 'appearance', 'id': app_id('participation_sarah_piano')}], 'reorderStrategy': 'average_position'}),
            ]),
        ],
    }


def complex_seed():
    seed = multi_seed()
    seed.update({'key': 'complex', 'jam_id': 'jam_demo_complex', 'name': 'Jam live complexe', 'indicative_date': date(2026, 1, 19)})
    seed['transactions'][0] = create_jam_tx(seed['jam_id'], seed['name'], '2026-01-19', DEFAULT_INSTRUMENTS)
    seed['transactions'].extend([
        participant_tx('Hugo', ['instrument_other']),
        participant_tx('Emma', ['instrument_vocals', 'instrument_guitar']),
        participant_tx('Jules', ['instrument_bass', 'instrument_drums']),
        participant_tx('Julie', ['instrument_piano']),
        participant_tx('Maya', ['instrument_other']),
        tx('Live complex actions', [
            event('plateau_played', {'plateauIndex': 1, 'targets': [{'type': 'appearance', 'id': app_id('participation_sarah_vocals')}, {'type': 'appearance', 'id': app_id('participation_nicolas_guitar')}, {'type': 'appearance', 'id': app_id('participation_tom_bass')}, {'type': 'appearance', 'id': app_id('participation_jeremy_drums')}]}),
            event('instrument_round_visibility_changed', {'instrumentId': 'instrument_guitar', 'visibleRoundCount': 2}),
            event('appearance_locked', {'appearanceId': app_id('participation_nicolas_guitar', 2)}),
            event('hole_added', {'holeId': 'hole_demo_drums_r2', 'instrumentId': 'instrument_drums', 'appearanceIndex': 2, 'reason': 'manual', 'positionKey': '2:hole_demo_drums_r2'}),
            event('link_created', {'linkId': 'link_emma_vocals_guitar', 'anchorTarget': {'type': 'appearance', 'id': app_id('participation_emma_vocals')}, 'targets': [{'type': 'appearance', 'id': app_id('participation_emma_vocals')}, {'type': 'appearance', 'id': app_id('participation_emma_guitar')}], 'reorderStrategy': 'move_to_first'}),
            event('hole_added', {'holeId': 'hole_demo_paul_without_bass', 'instrumentId': 'instrument_bass', 'appearanceIndex': 1, 'reason': 'play_without', 'positionKey': '1:hole_demo_paul_without_bass'}),
            event('link_created', {'linkId': 'link_paul_without_bass', 'anchorTarget': {'type': 'appearance', 'id': app_id('participation_paul_guitar')}, 'targets': [{'type': 'appearance', 'id': app_id('participation_paul_guitar')}, {'type': 'hole', 'id': 'hole_demo_paul_without_bass'}], 'reorderStrategy': 'move_to_first'}),
            event('appearance_skipped', {'appearanceId': app_id('participation_alice_piano'), 'instrumentId': 'instrument_piano', 'originalPlateauIndex': 1, 'replacement': {'mode': 'participant', 'participantId': 'participant_julie'}, 'removedLinkIds': [], 'confirmedDelink': True}),
            event('participant_marked_left', {'participantId': 'participant_hugo'}),
            event('instrument_visibility_changed', {'instrumentId': 'instrument_other', 'visible': False, 'confirmedDespiteActiveLinks': True}),
        ]),
        tx('Undo hidden other instrument', [event('transaction_reverted', {'targetTransactionId': 'tx_jam_demo_complex_015', 'reason': 'demo_undo'})]),
    ])
    return seed


def sync_seed():
    seed = simple_seed()
    seed.update({'key': 'sync', 'jam_id': 'jam_demo_sync_pending', 'name': 'Jam sync pending/offline', 'indicative_date': date(2026, 1, 20)})
    seed['transactions'][0] = create_jam_tx(seed['jam_id'], seed['name'], '2026-01-20', DEFAULT_INSTRUMENTS[:4])
    seed['transactions'].extend([
        participant_tx('Camille', ['instrument_vocals']),
        tx('Pending-like demo actions', [
            event('link_created', {'linkId': 'link_camille_paul', 'anchorTarget': {'type': 'appearance', 'id': app_id('participation_camille_vocals')}, 'targets': [{'type': 'appearance', 'id': app_id('participation_camille_vocals')}, {'type': 'appearance', 'id': app_id('participation_paul_guitar')}], 'reorderStrategy': 'move_to_first'}),
            event('hole_added', {'holeId': 'hole_demo_sync_drums', 'instrumentId': 'instrument_drums', 'appearanceIndex': 1, 'reason': 'sync_demo', 'positionKey': '1:hole_demo_sync_drums'}),
        ]),
    ])
    return seed


SEED_BUILDERS = {
    'simple': simple_seed,
    'rounds': rounds_seed,
    'links': links_seed,
    'multi': multi_seed,
    'complex': complex_seed,
    'sync': sync_seed,
}


class Command(BaseCommand):
    help = 'Seed demo jams as JamTransaction/JamEvent event streams.'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true', help='Delete demo jams before seeding.')
        parser.add_argument('--only', choices=SEED_BUILDERS.keys(), help='Seed only one demo jam.')

    @transaction.atomic
    def handle(self, *args, **options):
        selected_keys = [options['only']] if options.get('only') else list(SEED_BUILDERS.keys())
        if options['reset']:
            Jam.objects.filter(jam_id__startswith='jam_demo_').delete()

        created = 0
        skipped = 0
        for key in selected_keys:
            seed = SEED_BUILDERS[key]()
            if Jam.objects.filter(jam_id=seed['jam_id']).exists():
                skipped += 1
                continue
            self.create_seed(seed)
            created += 1

        self.stdout.write(self.style.SUCCESS(f'Seeded demo jams: created={created}, skipped={skipped}'))

    def create_seed(self, seed):
        jam = Jam.objects.create(jam_id=seed['jam_id'], name=seed['name'], indicative_date=seed['indicative_date'])
        server_sequence = 1
        for tx_index, tx_data in enumerate(seed['transactions'], start=1):
            transaction_id = f'tx_{seed["jam_id"]}_{tx_index:03d}'
            events = tx_data['events']
            jam_tx = JamTransaction.objects.create(
                jam=jam,
                transaction_id=transaction_id,
                client_id=CLIENT_ID,
                client_sequence_number=tx_index,
                schema_version=SCHEMA_VERSION,
                server_sequence_number_start=server_sequence,
                server_sequence_number_end=server_sequence + len(events) - 1,
            )
            for event_index, event_data in enumerate(events, start=1):
                payload = dict(event_data['payload'])
                payload.setdefault('jamId', seed['jam_id'])
                JamEvent.objects.create(
                    jam=jam,
                    transaction=jam_tx,
                    event_id=f'evt_{seed["jam_id"]}_{tx_index:03d}_{event_index:02d}',
                    type=event_data['type'],
                    payload=payload,
                    schema_version=SCHEMA_VERSION,
                    server_sequence_number=server_sequence,
                )
                if event_data['type'] in {'jam_created', 'jam_updated'}:
                    jam.name = payload.get('name', jam.name)
                    if payload.get('indicativeDate'):
                        jam.indicative_date = payload['indicativeDate']
                    jam.link_reorder_strategy = payload.get('linkReorderStrategy', jam.link_reorder_strategy)
                elif event_data['type'] == 'jam_link_reorder_strategy_changed':
                    jam.link_reorder_strategy = payload.get('nextStrategy', payload.get('linkReorderStrategy', jam.link_reorder_strategy))
                server_sequence += 1
            jam.latest_server_sequence_number = server_sequence - 1
        jam.save(update_fields=['name', 'indicative_date', 'link_reorder_strategy', 'latest_server_sequence_number', 'updated_at'])
