from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.dateparse import parse_date

from jams.demo_seeds import CLIENT_ID, SEED_NAMES, build_demo_seed
from jams.models import Jam, JamEvent, JamSnapshot, JamTransaction


class Command(BaseCommand):
    help = "Seed deterministic demo jams as event-sourced transactions."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete existing demo jams before seeding.")
        parser.add_argument("--only", choices=SEED_NAMES, help="Seed only one demo jam.")

    def handle(self, *args, **options):
        selected = [options["only"]] if options.get("only") else list(SEED_NAMES)
        if options.get("reset"):
            deleted, _ = Jam.objects.filter(jam_id__startswith="jam_demo_").delete()
            self.stdout.write(f"Deleted {deleted} demo rows.")

        created = 0
        skipped = 0
        for seed in selected:
            if Jam.objects.filter(jam_id=f"jam_demo_{seed}").exists():
                skipped += 1
                self.stdout.write(f"Skipped existing jam_demo_{seed}. Use --reset to recreate it.")
                continue
            self._create_seed(seed)
            created += 1
            self.stdout.write(self.style.SUCCESS(f"Seeded jam_demo_{seed}."))
        self.stdout.write(self.style.SUCCESS(f"Demo seeds complete: {created} created, {skipped} skipped."))

    @transaction.atomic
    def _create_seed(self, seed):
        transactions = build_demo_seed(seed)
        if not transactions:
            raise CommandError(f"Seed {seed} produced no transactions.")
        first_event = transactions[0]["events"][0]
        jam_payload = first_event["payload"]
        jam = Jam.objects.create(
            jam_id=jam_payload["jamId"],
            name=jam_payload["name"],
            indicative_date=parse_date(jam_payload["indicativeDate"]),
            link_reorder_strategy=jam_payload["linkReorderStrategy"],
            metadata={"demoSeed": seed},
        )
        server_sequence = 0
        for transaction_payload in transactions:
            events = transaction_payload["events"]
            start = server_sequence + 1
            end = server_sequence + len(events)
            tx = JamTransaction.objects.create(
                jam=jam,
                transaction_id=transaction_payload["transactionId"],
                client_id=transaction_payload["clientId"],
                client_sequence_number=transaction_payload["clientSequenceNumber"],
                server_sequence_number_start=start,
                server_sequence_number_end=end,
                schema_version=transaction_payload["schemaVersion"],
                payload={key: value for key, value in transaction_payload.items() if key != "events"},
            )
            for offset, event in enumerate(events):
                JamEvent.objects.create(
                    jam=jam,
                    transaction=tx,
                    event_id=event["eventId"],
                    type=event["type"],
                    payload=event["payload"],
                    schema_version=event["schemaVersion"],
                    client_id=event["clientId"],
                    client_sequence_number=event["clientSequenceNumber"],
                    server_sequence_number=start + offset,
                )
            server_sequence = end
        jam.latest_server_sequence_number = server_sequence
        jam.save(update_fields=["latest_server_sequence_number", "updated_at"])
        if seed in {"complex", "sync"}:
            JamSnapshot.objects.create(
                snapshot_id=f"snapshot_demo_{seed}_latest",
                jam=jam,
                client_id=CLIENT_ID,
                last_server_sequence_number=server_sequence,
                payload={"demoSeed": seed, "transactionCount": len(transactions), "note": "Demo snapshot metadata only; projection is rebuilt from events."},
                schema_version=1,
            )
