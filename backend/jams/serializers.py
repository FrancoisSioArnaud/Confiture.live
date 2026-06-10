from rest_framework import serializers

from .models import (
    ClientAction,
    Hole,
    Instrument,
    Jam,
    LinkGroup,
    Participant,
    ParticipantEntry,
    PlayedPassage,
)

DEFAULT_INSTRUMENTS = ["Chant", "Guitare", "Basse", "Batterie", "Piano", "Autres"]


class InstrumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Instrument
        fields = ["id", "jam", "name", "order", "is_default", "created_at", "updated_at"]
        read_only_fields = ["id", "jam", "created_at", "updated_at"]


class ParticipantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Participant
        fields = ["id", "jam", "name", "status", "created_at", "updated_at"]
        read_only_fields = ["id", "jam", "created_at", "updated_at"]


class ParticipantEntrySerializer(serializers.ModelSerializer):
    participant_name = serializers.CharField(source="participant.name", read_only=True)
    instrument_name = serializers.CharField(source="instrument.name", read_only=True)

    class Meta:
        model = ParticipantEntry
        fields = [
            "id",
            "jam",
            "participant",
            "participant_name",
            "instrument",
            "instrument_name",
            "custom_instrument_label",
            "base_order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "jam", "created_at", "updated_at"]


class HoleSerializer(serializers.ModelSerializer):
    instrument_name = serializers.CharField(source="instrument.name", read_only=True)

    class Meta:
        model = Hole
        fields = [
            "id",
            "jam",
            "instrument",
            "instrument_name",
            "position",
            "created_by_action",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "jam", "created_at", "updated_at"]


class LinkGroupSerializer(serializers.ModelSerializer):
    entry_ids = serializers.PrimaryKeyRelatedField(source="entries", many=True, read_only=True)
    hole_ids = serializers.PrimaryKeyRelatedField(source="holes", many=True, read_only=True)

    class Meta:
        model = LinkGroup
        fields = ["id", "jam", "entry_ids", "hole_ids", "created_at", "updated_at"]
        read_only_fields = ["id", "jam", "created_at", "updated_at"]


class PlayedPassageSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlayedPassage
        fields = [
            "id",
            "jam",
            "participant_entry",
            "hole",
            "line_index",
            "played_at",
            "created_at",
        ]
        read_only_fields = ["id", "jam", "created_at"]


class ClientActionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientAction
        fields = [
            "id",
            "jam",
            "client_action_id",
            "type",
            "payload",
            "status",
            "created_at",
            "synced_at",
        ]
        read_only_fields = ["id", "jam", "status", "created_at", "synced_at"]


class ClientActionCreateSerializer(serializers.Serializer):
    client_action_id = serializers.CharField(max_length=255)
    type = serializers.CharField(max_length=64)
    payload = serializers.JSONField(required=False, default=dict)
    created_at = serializers.DateTimeField(required=False)


class JamListSerializer(serializers.ModelSerializer):
    instrument_payloads = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)
    unique_musicians_count = serializers.IntegerField(read_only=True)
    participant_entries_count = serializers.IntegerField(read_only=True)
    played_plateaus_count = serializers.IntegerField(read_only=True)
    unplayed_active_entries_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Jam
        fields = [
            "id",
            "name",
            "indicative_date",
            "created_at",
            "updated_at",
            "instrument_payloads",
            "editing_locked_by",
            "editing_locked_at",
            "unique_musicians_count",
            "participant_entries_count",
            "played_plateaus_count",
            "unplayed_active_entries_count",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "editing_locked_by", "editing_locked_at"]

    def _sync_instruments(self, jam, instrument_payloads):
        active_ids = []
        for order, instrument_payload in enumerate(instrument_payloads):
            name = (instrument_payload.get("name") or "").strip()
            if not name:
                continue

            instrument = None
            raw_id = instrument_payload.get("id")
            if raw_id:
                try:
                    instrument = Instrument.objects.filter(jam=jam, id=raw_id).first()
                except (TypeError, ValueError):
                    instrument = None

            if instrument is None:
                instrument, _created = Instrument.objects.get_or_create(
                    jam=jam,
                    name=name,
                    defaults={
                        "order": order,
                        "is_default": instrument_payload.get("is_default", instrument_payload.get("isDefault", False)),
                    },
                )

            instrument.name = name
            instrument.order = instrument_payload.get("order", order)
            instrument.is_default = instrument_payload.get("is_default", instrument_payload.get("isDefault", instrument.is_default))
            instrument.save(update_fields=["name", "order", "is_default", "updated_at"])
            active_ids.append(instrument.id)

        if active_ids:
            Instrument.objects.filter(jam=jam).exclude(id__in=active_ids).filter(entries__isnull=True, holes__isnull=True).delete()

    def create(self, validated_data):
        instrument_payloads = validated_data.pop("instrument_payloads", None)
        jam = Jam.objects.create(**validated_data)
        instruments = instrument_payloads or [
            {"name": instrument_name, "order": order, "is_default": True}
            for order, instrument_name in enumerate(DEFAULT_INSTRUMENTS)
        ]
        self._sync_instruments(jam, instruments)
        return jam

    def update(self, instance, validated_data):
        instrument_payloads = validated_data.pop("instrument_payloads", None)
        instance = super().update(instance, validated_data)
        if instrument_payloads is not None:
            self._sync_instruments(instance, instrument_payloads)
        return instance


class JamDetailSerializer(JamListSerializer):
    instruments = InstrumentSerializer(many=True, read_only=True)
    participants = ParticipantSerializer(many=True, read_only=True)
    entries = ParticipantEntrySerializer(many=True, read_only=True)
    holes = HoleSerializer(many=True, read_only=True)
    link_groups = LinkGroupSerializer(many=True, read_only=True)
    played_passages = PlayedPassageSerializer(many=True, read_only=True)
    client_actions = ClientActionSerializer(many=True, read_only=True)

    class Meta(JamListSerializer.Meta):
        fields = JamListSerializer.Meta.fields + [
            "instruments",
            "participants",
            "entries",
            "holes",
            "link_groups",
            "played_passages",
            "client_actions",
        ]
