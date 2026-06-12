from datetime import timedelta

from django.db import IntegrityError
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from jams.models import ClientAction, Hole, Instrument, Jam, Participant, ParticipantEntry, PlayedPassage


class JamApiTests(APITestCase):
    def test_create_jam(self):
        response = self.client.post(reverse("jams:jam-list"), {"name": "Jam du jeudi"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Jam du jeudi")
        self.assertEqual(Jam.objects.count(), 1)
        self.assertEqual(Instrument.objects.filter(jam_id=response.data["id"]).count(), 6)
        self.assertEqual(
            list(Instrument.objects.filter(jam_id=response.data["id"]).order_by("order").values_list("name", flat=True)),
            ["Chant", "Guitare", "Basse", "Batterie", "Piano", "Autre"],
        )

    def test_create_jam_with_custom_instruments(self):
        response = self.client.post(
            reverse("jams:jam-list"),
            {
                "name": "Jam custom",
                "instrument_payloads": [
                    {"name": "Chant", "order": 0, "is_default": True},
                    {"name": "Saxophone", "order": 1, "is_default": False},
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(list(Instrument.objects.filter(jam_id=response.data["id"]).values_list("name", flat=True)), ["Chant", "Saxophone"])

    def test_get_jam_detail(self):
        jam = Jam.objects.create(name="Jam detail")
        instrument = Instrument.objects.create(jam=jam, name="Guitare", order=0)
        participant = Participant.objects.create(jam=jam, name="Nicolas")
        ParticipantEntry.objects.create(jam=jam, participant=participant, instrument=instrument, base_order=0)

        response = self.client.get(reverse("jams:jam-detail", kwargs={"pk": jam.id}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Jam detail")
        self.assertEqual(len(response.data["instruments"]), 1)
        self.assertEqual(len(response.data["participants"]), 1)
        self.assertEqual(len(response.data["entries"]), 1)


    def test_delete_jam_removes_it(self):
        jam = Jam.objects.create(name="Jam à supprimer")
        instrument = Instrument.objects.create(jam=jam, name="Batterie", order=0)
        participant = Participant.objects.create(jam=jam, name="Jérémy")
        entry = ParticipantEntry.objects.create(jam=jam, participant=participant, instrument=instrument, base_order=0)
        hole = Hole.objects.create(jam=jam, instrument=instrument, position=1)
        PlayedPassage.objects.create(jam=jam, participant_entry=entry, line_index=0)
        ClientAction.objects.create(jam=jam, client_action_id="delete-check", type="ADD_HOLE")

        response = self.client.delete(reverse("jams:jam-detail", kwargs={"pk": jam.id}))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Jam.objects.filter(id=jam.id).exists())
        self.assertFalse(Instrument.objects.filter(id=instrument.id).exists())
        self.assertFalse(Participant.objects.filter(id=participant.id).exists())
        self.assertFalse(ParticipantEntry.objects.filter(id=entry.id).exists())
        self.assertFalse(Hole.objects.filter(id=hole.id).exists())
        self.assertFalse(PlayedPassage.objects.filter(jam_id=jam.id).exists())
        self.assertFalse(ClientAction.objects.filter(client_action_id="delete-check").exists())

    def test_action_idempotent_and_duplicate_not_reapplied(self):
        jam = Jam.objects.create(name="Jam action")
        instrument = Instrument.objects.create(jam=jam, name="Chant", order=0)
        url = reverse("jams:jam-actions", kwargs={"jam_id": jam.id})
        payload = {
            "client_action_id": "action-1",
            "type": "ADD_PARTICIPANT",
            "payload": {
                "participant": {"name": "Sarah"},
                "entries": [{"instrument_id": instrument.id, "base_order": 0}],
            },
        }

        first_response = self.client.post(url, payload, format="json")
        second_response = self.client.post(url, payload, format="json")

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(first_response.data["applied"], True)
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.data["duplicate"], True)
        self.assertEqual(Participant.objects.filter(jam=jam, name="Sarah").count(), 1)
        self.assertEqual(ClientAction.objects.filter(client_action_id="action-1").count(), 1)

    def test_mark_entry_played_action(self):
        jam = Jam.objects.create(name="Jam played")
        instrument = Instrument.objects.create(jam=jam, name="Batterie", order=0)
        participant = Participant.objects.create(jam=jam, name="Jérémy")
        entry = ParticipantEntry.objects.create(jam=jam, participant=participant, instrument=instrument, base_order=0)

        response = self.client.post(
            reverse("jams:jam-actions", kwargs={"jam_id": jam.id}),
            {
                "client_action_id": "played-1",
                "type": "MARK_ENTRY_PLAYED",
                "payload": {"entry_id": entry.id, "line_index": 2},
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PlayedPassage.objects.filter(jam=jam, participant_entry=entry, line_index=2).count(), 1)

    def test_add_hole_action(self):
        jam = Jam.objects.create(name="Jam hole")
        instrument = Instrument.objects.create(jam=jam, name="Batterie", order=0)

        response = self.client.post(
            reverse("jams:jam-actions", kwargs={"jam_id": jam.id}),
            {
                "client_action_id": "hole-1",
                "type": "ADD_HOLE",
                "payload": {"instrument_id": instrument.id, "position": 1, "created_by_action": "ADD_HOLE"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Hole.objects.filter(jam=jam, instrument=instrument, position=1).count(), 1)

    def test_mark_plateau_played_action_marks_entries_and_holes(self):
        jam = Jam.objects.create(name="Jam plateau")
        instrument = Instrument.objects.create(jam=jam, name="Batterie", order=0)
        participant = Participant.objects.create(jam=jam, name="Jérémy")
        entry = ParticipantEntry.objects.create(jam=jam, participant=participant, instrument=instrument, base_order=0)
        hole = Hole.objects.create(jam=jam, instrument=instrument, position=1)

        response = self.client.post(
            reverse("jams:jam-actions", kwargs={"jam_id": jam.id}),
            {
                "client_action_id": "plateau-1",
                "type": "MARK_PLATEAU_PLAYED",
                "payload": {"participantEntryIds": [entry.id], "holeIds": [hole.id], "lineIndex": 3},
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PlayedPassage.objects.filter(jam=jam, participant_entry=entry, line_index=3).count(), 1)
        self.assertEqual(PlayedPassage.objects.filter(jam=jam, hole=hole, line_index=3).count(), 1)

    def test_unsupported_action_is_failed_and_not_treated_as_synced(self):
        jam = Jam.objects.create(name="Jam failed action")

        response = self.client.post(
            reverse("jams:jam-actions", kwargs={"jam_id": jam.id}),
            {
                "client_action_id": "unsupported-1",
                "type": "ACTION_INCONNUE",
                "payload": {},
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        action = ClientAction.objects.get(client_action_id="unsupported-1")
        self.assertEqual(action.status, ClientAction.STATUS_FAILED)

    def test_lock_editing_granted(self):
        jam = Jam.objects.create(name="Jam lock")
        url = reverse("jams:jam-lock-editing", kwargs={"jam_id": jam.id})

        response = self.client.post(url, {"client_id": "phone-1", "editing_lock_token": "token-1"}, format="json")

        jam.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "locked")
        self.assertEqual(jam.editing_locked_by, "phone-1")
        self.assertEqual(jam.editing_lock_token, "token-1")

    def test_lock_editing_refused_if_already_active(self):
        jam = Jam.objects.create(name="Jam lock", editing_locked_by="phone-1", editing_lock_token="token-1", editing_locked_at=timezone.now())
        url = reverse("jams:jam-lock-editing", kwargs={"jam_id": jam.id})

        response = self.client.post(url, {"client_id": "tablet-2", "editing_lock_token": "token-2"}, format="json")

        self.assertEqual(response.status_code, 423)
        self.assertEqual(response.data["detail"], "Cette jam est déjà ouverte en édition sur un autre appareil.")

    def test_unlock_editing_releases_lock(self):
        jam = Jam.objects.create(name="Jam unlock", editing_locked_by="phone-1", editing_lock_token="token-1", editing_locked_at=timezone.now())
        url = reverse("jams:jam-unlock-editing", kwargs={"jam_id": jam.id})

        response = self.client.post(url, {"client_id": "phone-1", "editing_lock_token": "token-1"}, format="json")

        jam.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "unlocked")
        self.assertIsNone(jam.editing_locked_by)
        self.assertIsNone(jam.editing_lock_token)

    def test_expired_lock_can_be_reclaimed(self):
        expired_at = timezone.now() - Jam.EDITING_LOCK_TTL - timedelta(minutes=1)
        jam = Jam.objects.create(name="Jam expired", editing_locked_by="phone-1", editing_lock_token="token-1", editing_locked_at=expired_at)
        url = reverse("jams:jam-lock-editing", kwargs={"jam_id": jam.id})

        response = self.client.post(url, {"client_id": "tablet-2", "editing_lock_token": "token-2"}, format="json")

        jam.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(jam.editing_locked_by, "tablet-2")
        self.assertEqual(jam.editing_lock_token, "token-2")


class ModelConstraintTests(TestCase):
    def test_participant_name_unique_per_jam(self):
        jam = Jam.objects.create(name="Jam unique")
        Participant.objects.create(jam=jam, name="Nicolas")

        with self.assertRaises(IntegrityError):
            Participant.objects.create(jam=jam, name="Nicolas")


class AdminImportTests(TestCase):
    def test_admin_models_importable(self):
        import jams.admin  # noqa: F401
