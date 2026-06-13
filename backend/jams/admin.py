from django.contrib import admin

from .models import (
    ClientAction,
    Hole,
    Instrument,
    Jam,
    LinkGroup,
    Participant,
    ParticipantEntry,
    PlayedPassage,
    Plateau,
    RoundSlot,
    SlotLinkGroup,
)


class InstrumentInline(admin.TabularInline):
    model = Instrument
    extra = 0


@admin.register(Jam)
class JamAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "indicative_date", "editing_locked_by", "editing_locked_at", "created_at", "updated_at")
    search_fields = ("name",)
    list_filter = ("indicative_date", "created_at")
    ordering = ("indicative_date", "name")
    inlines = [InstrumentInline]


@admin.register(Instrument)
class InstrumentAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "jam", "order", "is_default", "created_at")
    search_fields = ("name", "jam__name")
    list_filter = ("is_default", "created_at")
    ordering = ("jam", "order", "name")


@admin.register(Participant)
class ParticipantAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "jam", "status", "created_at", "updated_at")
    search_fields = ("name", "jam__name")
    list_filter = ("status", "created_at")
    ordering = ("jam", "name")


@admin.register(ParticipantEntry)
class ParticipantEntryAdmin(admin.ModelAdmin):
    list_display = ("id", "participant", "instrument", "jam", "base_order", "custom_instrument_label")
    search_fields = ("participant__name", "instrument__name", "jam__name")
    list_filter = ("instrument", "created_at")
    ordering = ("jam", "instrument__order", "base_order")


@admin.register(RoundSlot)
class RoundSlotAdmin(admin.ModelAdmin):
    list_display = ("id", "jam", "instrument", "participant_entry", "slot_type", "round_number", "display_order", "status", "played_at")
    search_fields = ("jam__name", "instrument__name", "participant_entry__participant__name")
    list_filter = ("slot_type", "status", "round_number", "created_at")
    ordering = ("jam", "instrument__order", "display_order", "round_number", "id")


@admin.register(SlotLinkGroup)
class SlotLinkGroupAdmin(admin.ModelAdmin):
    list_display = ("id", "jam", "reason", "status", "created_at", "updated_at")
    search_fields = ("jam__name",)
    list_filter = ("reason", "status", "created_at")
    filter_horizontal = ("slots",)
    ordering = ("jam", "id")


@admin.register(Plateau)
class PlateauAdmin(admin.ModelAdmin):
    list_display = ("id", "jam", "status", "played_at", "created_at")
    search_fields = ("jam__name",)
    list_filter = ("status", "played_at", "created_at")
    filter_horizontal = ("slots",)
    ordering = ("jam", "-played_at")


@admin.register(LinkGroup)
class LinkGroupAdmin(admin.ModelAdmin):
    list_display = ("id", "jam", "created_at", "updated_at")
    search_fields = ("jam__name",)
    list_filter = ("created_at",)
    filter_horizontal = ("entries", "holes")
    ordering = ("jam", "id")


@admin.register(Hole)
class HoleAdmin(admin.ModelAdmin):
    list_display = ("id", "instrument", "jam", "position", "created_by_action", "created_at")
    search_fields = ("instrument__name", "jam__name", "created_by_action")
    list_filter = ("created_by_action", "created_at")
    ordering = ("jam", "instrument__order", "position")


@admin.register(PlayedPassage)
class PlayedPassageAdmin(admin.ModelAdmin):
    list_display = ("id", "jam", "participant_entry", "hole", "line_index", "played_at")
    search_fields = ("jam__name", "participant_entry__participant__name", "hole__instrument__name")
    list_filter = ("played_at", "created_at")
    ordering = ("jam", "line_index", "played_at")


@admin.register(ClientAction)
class ClientActionAdmin(admin.ModelAdmin):
    list_display = ("id", "jam", "client_action_id", "type", "status", "created_at", "synced_at")
    search_fields = ("client_action_id", "type", "jam__name")
    list_filter = ("status", "type", "created_at", "synced_at")
    ordering = ("-created_at",)
