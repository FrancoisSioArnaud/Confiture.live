from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Jam(TimeStampedModel):
    name = models.CharField(max_length=255)
    indicative_date = models.DateField(null=True, blank=True)
    EDITING_LOCK_TTL = timedelta(hours=4)

    editing_locked_by = models.CharField(max_length=255, null=True, blank=True)
    editing_locked_at = models.DateTimeField(null=True, blank=True)
    editing_lock_token = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        ordering = ["indicative_date", "name"]

    def __str__(self):
        return self.name

    @property
    def is_editing_locked(self):
        return bool(self.editing_locked_by) and not self.is_editing_lock_expired()

    def is_editing_lock_expired(self, now=None):
        if not self.editing_locked_at:
            return False
        reference_time = now or timezone.now()
        return self.editing_locked_at <= reference_time - self.EDITING_LOCK_TTL

    def clear_editing_lock(self):
        self.editing_locked_by = None
        self.editing_locked_at = None
        self.editing_lock_token = None

    def lock_editing(self, client_id, lock_token):
        if self.editing_locked_by and self.is_editing_lock_expired():
            self.clear_editing_lock()

        if self.editing_locked_by and self.editing_lock_token != lock_token:
            return False

        self.editing_locked_by = client_id
        self.editing_lock_token = lock_token
        self.editing_locked_at = timezone.now()
        self.save(update_fields=["editing_locked_by", "editing_locked_at", "editing_lock_token", "updated_at"])
        return True

    def unlock_editing(self, lock_token=None):
        if self.editing_locked_by and self.is_editing_lock_expired():
            self.clear_editing_lock()
            self.save(update_fields=["editing_locked_by", "editing_locked_at", "editing_lock_token", "updated_at"])
            return True

        if lock_token and self.editing_lock_token and self.editing_lock_token != lock_token:
            return False

        self.clear_editing_lock()
        self.save(update_fields=["editing_locked_by", "editing_locked_at", "editing_lock_token", "updated_at"])
        return True


class Instrument(TimeStampedModel):
    jam = models.ForeignKey(Jam, related_name="instruments", on_delete=models.CASCADE)
    name = models.CharField(max_length=120)
    order = models.PositiveIntegerField(default=0)
    is_default = models.BooleanField(default=True)

    class Meta:
        ordering = ["order", "name"]
        unique_together = [("jam", "name")]

    def __str__(self):
        return f"{self.name} — {self.jam}"


class Participant(TimeStampedModel):
    STATUS_ACTIVE = "active"
    STATUS_LEFT = "left"
    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Active"),
        (STATUS_LEFT, "Left"),
    ]

    jam = models.ForeignKey(Jam, related_name="participants", on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_ACTIVE)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["jam", "name"], name="unique_participant_name_per_jam"),
        ]

    def __str__(self):
        return self.name


class ParticipantEntry(TimeStampedModel):
    jam = models.ForeignKey(Jam, related_name="entries", on_delete=models.CASCADE)
    participant = models.ForeignKey(Participant, related_name="entries", on_delete=models.CASCADE)
    instrument = models.ForeignKey(Instrument, related_name="entries", on_delete=models.CASCADE)
    custom_instrument_label = models.CharField(max_length=120, null=True, blank=True)
    base_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["instrument__order", "base_order", "id"]

    def __str__(self):
        return f"{self.participant} — {self.instrument.name}"

    def clean(self):
        if self.participant_id and self.jam_id and self.participant.jam_id != self.jam_id:
            raise ValidationError("Participant must belong to the same jam.")
        if self.instrument_id and self.jam_id and self.instrument.jam_id != self.jam_id:
            raise ValidationError("Instrument must belong to the same jam.")


class RoundSlot(TimeStampedModel):
    SLOT_ENTRY = "entry"
    SLOT_HOLE = "hole"
    SLOT_TYPE_CHOICES = [(SLOT_ENTRY, "Entry"), (SLOT_HOLE, "Hole")]

    STATUS_PLANNED = "planned"
    STATUS_PLAYED = "played"
    STATUS_SKIPPED = "skipped"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_PLANNED, "Planned"),
        (STATUS_PLAYED, "Played"),
        (STATUS_SKIPPED, "Skipped"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    jam = models.ForeignKey(Jam, related_name="round_slots", on_delete=models.CASCADE)
    instrument = models.ForeignKey(Instrument, related_name="round_slots", on_delete=models.CASCADE)
    participant_entry = models.ForeignKey(
        ParticipantEntry,
        related_name="round_slots",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    slot_type = models.CharField(max_length=16, choices=SLOT_TYPE_CHOICES, default=SLOT_ENTRY)
    round_number = models.PositiveIntegerField(default=1)
    display_order = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PLANNED)
    played_at = models.DateTimeField(null=True, blank=True)
    created_by_action = models.CharField(max_length=64, blank=True)

    class Meta:
        ordering = ["instrument__order", "display_order", "round_number", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["participant_entry", "round_number"],
                condition=models.Q(participant_entry__isnull=False),
                name="unique_round_slot_per_entry_round",
            ),
            models.CheckConstraint(
                check=(
                    models.Q(slot_type="entry", participant_entry__isnull=False)
                    | models.Q(slot_type="hole", participant_entry__isnull=True)
                ),
                name="round_slot_type_matches_entry_presence",
            ),
        ]

    def __str__(self):
        label = self.participant_entry or f"Sans {self.instrument.name}"
        return f"{label} — round {self.round_number}"

    def clean(self):
        if self.instrument_id and self.jam_id and self.instrument.jam_id != self.jam_id:
            raise ValidationError("Instrument must belong to the same jam.")
        if self.participant_entry_id:
            if self.participant_entry.jam_id != self.jam_id:
                raise ValidationError("Participant entry must belong to the same jam.")
            if self.participant_entry.instrument_id != self.instrument_id:
                raise ValidationError("Participant entry must use the same instrument.")
        if self.slot_type == self.SLOT_ENTRY and not self.participant_entry_id:
            raise ValidationError("Entry round slots must reference a participant entry.")
        if self.slot_type == self.SLOT_HOLE and self.participant_entry_id:
            raise ValidationError("Hole round slots cannot reference a participant entry.")


class SlotLinkGroup(TimeStampedModel):
    REASON_MANUAL = "manual"
    REASON_TOGETHER = "wants_to_play_together"
    REASON_WITHOUT = "wants_to_play_without"
    REASON_CHOICES = [
        (REASON_MANUAL, "Manual"),
        (REASON_TOGETHER, "Wants to play together"),
        (REASON_WITHOUT, "Wants to play without"),
    ]

    STATUS_ACTIVE = "active"
    STATUS_CANCELLED = "cancelled"

    jam = models.ForeignKey(Jam, related_name="slot_link_groups", on_delete=models.CASCADE)
    slots = models.ManyToManyField(RoundSlot, related_name="link_groups", blank=True)
    reason = models.CharField(max_length=40, choices=REASON_CHOICES, default=REASON_MANUAL)
    status = models.CharField(max_length=16, default=STATUS_ACTIVE)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"Slot link group {self.id} — {self.jam}"


class Plateau(TimeStampedModel):
    STATUS_PLAYED = "played"
    STATUS_CANCELLED = "cancelled"

    jam = models.ForeignKey(Jam, related_name="plateaux", on_delete=models.CASCADE)
    slots = models.ManyToManyField(RoundSlot, related_name="plateaux", blank=True)
    status = models.CharField(max_length=16, default=STATUS_PLAYED)
    played_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-played_at", "id"]

    def __str__(self):
        return f"Plateau {self.id} — {self.jam}"


class Hole(TimeStampedModel):
    jam = models.ForeignKey(Jam, related_name="holes", on_delete=models.CASCADE)
    instrument = models.ForeignKey(Instrument, related_name="holes", on_delete=models.CASCADE)
    position = models.PositiveIntegerField(default=0)
    created_by_action = models.CharField(max_length=64)

    class Meta:
        ordering = ["instrument__order", "position", "id"]

    def __str__(self):
        return f"Sans {self.instrument.name} — {self.jam}"

    def clean(self):
        if self.instrument_id and self.jam_id and self.instrument.jam_id != self.jam_id:
            raise ValidationError("Instrument must belong to the same jam.")


class LinkGroup(TimeStampedModel):
    jam = models.ForeignKey(Jam, related_name="link_groups", on_delete=models.CASCADE)
    entries = models.ManyToManyField(ParticipantEntry, related_name="link_groups", blank=True)
    holes = models.ManyToManyField(Hole, related_name="link_groups", blank=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"Link group {self.id} — {self.jam}"


class PlayedPassage(models.Model):
    jam = models.ForeignKey(Jam, related_name="played_passages", on_delete=models.CASCADE)
    participant_entry = models.ForeignKey(
        ParticipantEntry,
        related_name="played_passages",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    hole = models.ForeignKey(Hole, related_name="played_passages", null=True, blank=True, on_delete=models.CASCADE)
    line_index = models.PositiveIntegerField(default=0)
    played_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["line_index", "played_at", "id"]

    def __str__(self):
        return f"Played passage {self.id} — {self.jam}"

    def clean(self):
        if bool(self.participant_entry_id) == bool(self.hole_id):
            raise ValidationError("A played passage must reference exactly one entry or one hole.")


class ClientAction(models.Model):
    STATUS_PENDING = "pending"
    STATUS_SYNCED = "synced"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_SYNCED, "Synced"),
        (STATUS_FAILED, "Failed"),
    ]

    jam = models.ForeignKey(Jam, related_name="client_actions", on_delete=models.CASCADE)
    client_action_id = models.CharField(max_length=255, unique=True)
    type = models.CharField(max_length=64)
    payload = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    synced_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.type} — {self.client_action_id}"
