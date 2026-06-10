from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from jams.models import ClientAction, Hole, Instrument, LinkGroup, Participant, ParticipantEntry, PlayedPassage


class ActionApplicationError(ValueError):
    """Raised when a client action payload cannot be applied."""


def _get_payload_id(payload, *names):
    for name in names:
        if name in payload:
            return payload[name]
    return None


def _parse_played_at(value):
    if not value:
        return timezone.now()
    parsed = parse_datetime(value)
    return parsed or timezone.now()


def _get_instrument(jam, raw_id):
    try:
        return Instrument.objects.get(jam=jam, id=raw_id)
    except (Instrument.DoesNotExist, ValueError, TypeError) as exc:
        raise ActionApplicationError("Instrument introuvable pour cette jam.") from exc


def _get_participant(jam, raw_id):
    try:
        return Participant.objects.get(jam=jam, id=raw_id)
    except (Participant.DoesNotExist, ValueError, TypeError) as exc:
        raise ActionApplicationError("Participant introuvable pour cette jam.") from exc


def _get_entry(jam, raw_id):
    try:
        return ParticipantEntry.objects.get(jam=jam, id=raw_id)
    except (ParticipantEntry.DoesNotExist, ValueError, TypeError) as exc:
        raise ActionApplicationError("Participation introuvable pour cette jam.") from exc


def _get_hole(jam, raw_id):
    try:
        return Hole.objects.get(jam=jam, id=raw_id)
    except (Hole.DoesNotExist, ValueError, TypeError) as exc:
        raise ActionApplicationError("Trou introuvable pour cette jam.") from exc


def _payload_entry_id(payload):
    return _get_payload_id(payload, "participant_entry", "participant_entry_id", "participantEntryId", "entry_id", "entryId")


def _played_defaults(payload):
    return {
        "line_index": payload.get("line_index", payload.get("lineIndex", 0)),
        "played_at": _parse_played_at(payload.get("played_at") or payload.get("playedAt")),
    }


def _remove_items_from_link_groups(jam, *, entries=None, holes=None):
    entries = list(entries or [])
    holes = list(holes or [])
    for group in LinkGroup.objects.filter(jam=jam):
        if entries:
            group.entries.remove(*entries)
        if holes:
            group.holes.remove(*holes)
        if group.entries.count() + group.holes.count() < 2:
            group.delete()


def apply_update_jam(jam, payload):
    updates = payload.get("updates", payload)
    if "name" in updates:
        jam.name = updates["name"]
    indicative_date = updates.get("indicative_date", updates.get("indicativeDate", None))
    if "indicative_date" in updates or "indicativeDate" in updates:
        jam.indicative_date = indicative_date or None
    jam.save(update_fields=["name", "indicative_date", "updated_at"])
    return jam


def apply_add_instrument(jam, payload):
    instrument_payload = payload.get("instrument", payload)
    name = instrument_payload.get("name")
    if not name:
        raise ActionApplicationError("Le nom de l’instrument est obligatoire.")
    return Instrument.objects.create(
        jam=jam,
        name=name,
        order=instrument_payload.get("order", jam.instruments.count()),
        is_default=instrument_payload.get("is_default", instrument_payload.get("isDefault", False)),
    )


def apply_reorder_instruments(jam, payload):
    orders = payload.get("instrument_orders", payload.get("instrumentOrders", {}))
    for instrument in jam.instruments.all():
        key = str(instrument.id)
        if key in orders or instrument.id in orders:
            instrument.order = orders.get(key, orders.get(instrument.id))
            instrument.save(update_fields=["order", "updated_at"])


def apply_add_participant(jam, payload):
    participant_payload = payload.get("participant", payload)
    name = participant_payload.get("name")
    if not name:
        raise ActionApplicationError("Le nom du participant est obligatoire.")

    participant = Participant.objects.create(
        jam=jam,
        name=name,
        status=participant_payload.get("status", Participant.STATUS_ACTIVE),
    )

    for entry_payload in payload.get("entries", []):
        instrument_id = _get_payload_id(entry_payload, "instrument", "instrument_id", "instrumentId")
        instrument = _get_instrument(jam, instrument_id)
        ParticipantEntry.objects.create(
            jam=jam,
            participant=participant,
            instrument=instrument,
            custom_instrument_label=entry_payload.get("custom_instrument_label") or entry_payload.get("customInstrumentLabel"),
            base_order=entry_payload.get("base_order", entry_payload.get("baseOrder", ParticipantEntry.objects.filter(jam=jam, instrument=instrument).count())),
        )

    return participant


def apply_update_participant(jam, payload):
    participant = _get_participant(jam, _get_payload_id(payload, "participant", "participant_id", "participantId"))
    updates = payload.get("updates", {})
    if "name" in updates:
        participant.name = updates["name"]
    if "status" in updates:
        participant.status = updates["status"]
    participant.save(update_fields=["name", "status", "updated_at"])
    return participant


def apply_mark_participant_left(jam, payload):
    participant_id = _get_payload_id(payload, "participant", "participant_id", "participantId")
    participant = _get_participant(jam, participant_id)
    participant.status = Participant.STATUS_LEFT
    participant.save(update_fields=["status", "updated_at"])
    return participant


def apply_add_participant_entry(jam, payload):
    entry_payload = payload.get("entry", payload)
    participant = _get_participant(jam, _get_payload_id(entry_payload, "participant", "participant_id", "participantId"))
    instrument = _get_instrument(jam, _get_payload_id(entry_payload, "instrument", "instrument_id", "instrumentId"))
    return ParticipantEntry.objects.create(
        jam=jam,
        participant=participant,
        instrument=instrument,
        custom_instrument_label=entry_payload.get("custom_instrument_label") or entry_payload.get("customInstrumentLabel"),
        base_order=entry_payload.get("base_order", entry_payload.get("baseOrder", ParticipantEntry.objects.filter(jam=jam, instrument=instrument).count())),
    )


def apply_update_participant_entry(jam, payload):
    entry = _get_entry(jam, _get_payload_id(payload, "entry", "entry_id", "entryId"))
    updates = payload.get("updates", {})
    if "customInstrumentLabel" in updates or "custom_instrument_label" in updates:
        entry.custom_instrument_label = updates.get("customInstrumentLabel", updates.get("custom_instrument_label"))
    if "baseOrder" in updates or "base_order" in updates:
        entry.base_order = updates.get("baseOrder", updates.get("base_order"))
    entry.save(update_fields=["custom_instrument_label", "base_order", "updated_at"])
    return entry


def apply_move_entry_vertical(jam, payload):
    moved_entry = _get_entry(jam, _get_payload_id(payload, "entry", "entry_id", "entryId"))
    if moved_entry.played_passages.exists():
        return moved_entry
    entries = list(ParticipantEntry.objects.filter(jam=jam, instrument=moved_entry.instrument).order_by("base_order", "id"))
    entries_without_moved = [entry for entry in entries if entry.id != moved_entry.id]
    target_index = max(0, min(payload.get("to_index", payload.get("toIndex", 0)), len(entries_without_moved)))
    entries_without_moved.insert(target_index, moved_entry)
    for index, entry in enumerate(entries_without_moved):
        if entry.base_order != index:
            entry.base_order = index
            entry.save(update_fields=["base_order", "updated_at"])
    return moved_entry


def apply_link_items(jam, payload):
    entry_ids = payload.get("entry_ids", payload.get("entryIds", []))
    hole_ids = payload.get("hole_ids", payload.get("holeIds", []))
    entries = [_get_entry(jam, entry_id) for entry_id in entry_ids]
    holes = [_get_hole(jam, hole_id) for hole_id in hole_ids]
    _remove_items_from_link_groups(jam, entries=entries, holes=holes)
    if len(entries) + len(holes) < 2:
        return None
    group = LinkGroup.objects.create(jam=jam)
    group.entries.set(entries)
    group.holes.set(holes)
    return group


def apply_unlink_items(jam, payload):
    link_group_id = _get_payload_id(payload, "link_group", "link_group_id", "linkGroupId")
    if link_group_id:
        try:
            LinkGroup.objects.get(jam=jam, id=link_group_id).delete()
        except (LinkGroup.DoesNotExist, ValueError, TypeError) as exc:
            raise ActionApplicationError("Groupe lié introuvable pour cette jam.") from exc
        return None
    entries = [_get_entry(jam, entry_id) for entry_id in payload.get("entry_ids", payload.get("entryIds", []))]
    holes = [_get_hole(jam, hole_id) for hole_id in payload.get("hole_ids", payload.get("holeIds", []))]
    _remove_items_from_link_groups(jam, entries=entries, holes=holes)
    return None


def apply_add_hole(jam, payload):
    hole_payload = payload.get("hole", payload)
    instrument_id = _get_payload_id(hole_payload, "instrument", "instrument_id", "instrumentId")
    instrument = _get_instrument(jam, instrument_id)
    return Hole.objects.create(
        jam=jam,
        instrument=instrument,
        position=hole_payload.get("position", 0),
        created_by_action=hole_payload.get("created_by_action", hole_payload.get("createdByAction", "ADD_HOLE")),
    )


def apply_remove_hole(jam, payload):
    hole = _get_hole(jam, _get_payload_id(payload, "hole", "hole_id", "holeId"))
    if hole.played_passages.exists():
        return hole
    _remove_items_from_link_groups(jam, holes=[hole])
    hole.delete()
    return None


def apply_wants_to_play_without(jam, payload):
    source_entry = _get_entry(jam, _payload_entry_id(payload))
    source_group = source_entry.link_groups.filter(jam=jam).first()
    entries = list(source_group.entries.all()) if source_group else [source_entry]
    existing_holes = list(source_group.holes.all()) if source_group else []
    created_holes = []
    for instrument_id in payload.get("instrument_ids", payload.get("instrumentIds", [])):
        instrument = _get_instrument(jam, instrument_id)
        created_holes.append(Hole.objects.create(
            jam=jam,
            instrument=instrument,
            position=payload.get("position", Hole.objects.filter(jam=jam, instrument=instrument).count()),
            created_by_action="WANTS_TO_PLAY_WITHOUT",
        ))
    if created_holes:
        if source_group:
            source_group.delete()
        group = LinkGroup.objects.create(jam=jam)
        group.entries.set(entries)
        group.holes.set(existing_holes + created_holes)
    return created_holes


def apply_mark_entry_played(jam, payload):
    entry = _get_entry(jam, _payload_entry_id(payload))
    passage, _created = PlayedPassage.objects.get_or_create(
        jam=jam,
        participant_entry=entry,
        defaults=_played_defaults(payload),
    )
    return passage


def apply_mark_plateau_played(jam, payload):
    line_index = payload.get("line_index", payload.get("lineIndex", 0))
    played_at = _parse_played_at(payload.get("played_at") or payload.get("playedAt"))
    for entry_id in payload.get("participant_entry_ids", payload.get("participantEntryIds", payload.get("entryIds", []))):
        entry = _get_entry(jam, entry_id)
        PlayedPassage.objects.get_or_create(jam=jam, participant_entry=entry, defaults={"line_index": line_index, "played_at": played_at})
    for hole_id in payload.get("hole_ids", payload.get("holeIds", [])):
        hole = _get_hole(jam, hole_id)
        PlayedPassage.objects.get_or_create(jam=jam, hole=hole, defaults={"line_index": line_index, "played_at": played_at})


def apply_undo_entry_played(jam, payload):
    entry_id = _payload_entry_id(payload)
    hole_id = _get_payload_id(payload, "hole", "hole_id", "holeId")
    queryset = PlayedPassage.objects.filter(jam=jam)
    if entry_id:
        queryset = queryset.filter(participant_entry_id=entry_id)
    elif hole_id:
        queryset = queryset.filter(hole_id=hole_id)
    else:
        raise ActionApplicationError("Passage à annuler introuvable.")
    queryset.delete()


def apply_undo_plateau_played(jam, payload):
    line_index = payload.get("line_index", payload.get("lineIndex"))
    if line_index is None:
        raise ActionApplicationError("Ligne de plateau à annuler introuvable.")
    PlayedPassage.objects.filter(jam=jam, line_index=line_index).delete()


def apply_replace_unavailable(jam, payload):
    unavailable = _get_entry(jam, _get_payload_id(payload, "unavailable_entry", "unavailable_entry_id", "unavailableEntryId"))
    replacement = _get_entry(jam, _get_payload_id(payload, "replacement_entry", "replacement_entry_id", "replacementEntryId"))
    if unavailable.instrument_id != replacement.instrument_id:
        raise ActionApplicationError("Le remplaçant doit jouer le même instrument.")
    _remove_items_from_link_groups(jam, entries=[unavailable, replacement])
    entries = list(ParticipantEntry.objects.filter(jam=jam, instrument=unavailable.instrument).order_by("base_order", "id"))
    unavailable_index = next((index for index, entry in enumerate(entries) if entry.id == unavailable.id), 0)
    without_replacement = [entry for entry in entries if entry.id != replacement.id]
    reordered = [entry for entry in without_replacement if entry.id != unavailable.id]
    reordered.insert(unavailable_index, replacement)
    reordered.insert(unavailable_index + 1, unavailable)
    for index, entry in enumerate(reordered):
        if entry.base_order != index:
            entry.base_order = index
            entry.save(update_fields=["base_order", "updated_at"])
    return replacement


ACTION_HANDLERS = {
    "UPDATE_JAM": apply_update_jam,
    "ADD_INSTRUMENT": apply_add_instrument,
    "REORDER_INSTRUMENTS": apply_reorder_instruments,
    "ADD_PARTICIPANT": apply_add_participant,
    "UPDATE_PARTICIPANT": apply_update_participant,
    "MARK_PARTICIPANT_LEFT": apply_mark_participant_left,
    "ADD_PARTICIPANT_ENTRY": apply_add_participant_entry,
    "UPDATE_PARTICIPANT_ENTRY": apply_update_participant_entry,
    "MOVE_ENTRY_VERTICAL": apply_move_entry_vertical,
    "LINK_ITEMS": apply_link_items,
    "UNLINK_ITEMS": apply_unlink_items,
    "ADD_HOLE": apply_add_hole,
    "REMOVE_HOLE": apply_remove_hole,
    "WANTS_TO_PLAY_WITHOUT": apply_wants_to_play_without,
    "MARK_ENTRY_PLAYED": apply_mark_entry_played,
    "MARK_PLATEAU_PLAYED": apply_mark_plateau_played,
    "UNDO_ENTRY_PLAYED": apply_undo_entry_played,
    "UNDO_PLATEAU_PLAYED": apply_undo_plateau_played,
    "REPLACE_UNAVAILABLE": apply_replace_unavailable,
}


def record_and_apply_action(jam, *, client_action_id, action_type, payload):
    existing_action = ClientAction.objects.filter(client_action_id=client_action_id).first()
    if existing_action:
        return existing_action, False

    client_action = ClientAction.objects.create(
        jam=jam,
        client_action_id=client_action_id,
        type=action_type,
        payload=payload or {},
        status=ClientAction.STATUS_PENDING,
    )

    try:
        handler = ACTION_HANDLERS.get(action_type)
        if not handler:
            raise ActionApplicationError(f"Action non supportée en V0 : {action_type}.")
        with transaction.atomic():
            handler(jam, payload or {})
            client_action.status = ClientAction.STATUS_SYNCED
            client_action.synced_at = timezone.now()
            client_action.save(update_fields=["status", "synced_at"])
    except Exception:
        client_action.status = ClientAction.STATUS_FAILED
        client_action.synced_at = timezone.now()
        client_action.save(update_fields=["status", "synced_at"])
        raise

    return client_action, True
