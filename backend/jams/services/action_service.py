from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from jams.models import ClientAction, Hole, Instrument, LinkGroup, Participant, ParticipantEntry, PlayedPassage, Plateau, RoundSlot, SlotLinkGroup


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



def _get_round_slot(jam, raw_id):
    try:
        return RoundSlot.objects.get(jam=jam, id=raw_id)
    except (RoundSlot.DoesNotExist, ValueError, TypeError) as exc:
        raise ActionApplicationError("Round slot introuvable pour cette jam.") from exc


def _normalize_instrument_round_slot_orders(jam, instrument):
    slots = list(RoundSlot.objects.filter(jam=jam, instrument=instrument).order_by("display_order", "id"))
    for index, slot in enumerate(slots):
        if slot.display_order != index:
            slot.display_order = index
            slot.save(update_fields=["display_order", "updated_at"])


def _insert_slot_after_last_round_slot(jam, instrument, round_number, slot):
    slots = list(RoundSlot.objects.filter(jam=jam, instrument=instrument).exclude(id=slot.id).order_by("display_order", "id"))
    insert_after = -1
    for index, candidate in enumerate(slots):
        if candidate.round_number <= round_number:
            insert_after = index
    slots.insert(insert_after + 1, slot)
    for index, candidate in enumerate(slots):
        if candidate.display_order != index:
            candidate.display_order = index
            candidate.save(update_fields=["display_order", "updated_at"])


def _create_round_slots_for_entry(entry, visible_round_depth=1):
    created = []
    depth = max(1, int(visible_round_depth or 1))
    for round_number in range(1, depth + 1):
        slot, was_created = RoundSlot.objects.get_or_create(
            jam=entry.jam,
            instrument=entry.instrument,
            participant_entry=entry,
            round_number=round_number,
            defaults={"slot_type": RoundSlot.SLOT_ENTRY, "display_order": 0},
        )
        if was_created:
            _insert_slot_after_last_round_slot(entry.jam, entry.instrument, round_number, slot)
            created.append(slot)
    return created


def _ensure_round_slots_for_instrument(jam, instrument, round_number):
    created = []
    for entry in ParticipantEntry.objects.filter(jam=jam, instrument=instrument, participant__status=Participant.STATUS_ACTIVE).order_by("base_order", "id"):
        slot, was_created = RoundSlot.objects.get_or_create(
            jam=jam,
            instrument=instrument,
            participant_entry=entry,
            round_number=round_number,
            defaults={"slot_type": RoundSlot.SLOT_ENTRY, "display_order": 0},
        )
        if was_created:
            _insert_slot_after_last_round_slot(jam, instrument, round_number, slot)
            created.append(slot)
    _normalize_instrument_round_slot_orders(jam, instrument)
    return created


def _remove_slots_from_slot_link_groups(jam, slots):
    slots = list(slots or [])
    for group in SlotLinkGroup.objects.filter(jam=jam, status=SlotLinkGroup.STATUS_ACTIVE):
        if slots:
            group.slots.remove(*slots)
        if group.slots.count() < 2:
            group.delete()

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
        entry = ParticipantEntry.objects.create(
            jam=jam,
            participant=participant,
            instrument=instrument,
            custom_instrument_label=entry_payload.get("custom_instrument_label") or entry_payload.get("customInstrumentLabel"),
            base_order=entry_payload.get("base_order", entry_payload.get("baseOrder", ParticipantEntry.objects.filter(jam=jam, instrument=instrument).count())),
        )
        _create_round_slots_for_entry(entry, entry_payload.get("visible_round_depth", entry_payload.get("visibleRoundDepth", 1)))

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
    entry = ParticipantEntry.objects.create(
        jam=jam,
        participant=participant,
        instrument=instrument,
        custom_instrument_label=entry_payload.get("custom_instrument_label") or entry_payload.get("customInstrumentLabel"),
        base_order=entry_payload.get("base_order", entry_payload.get("baseOrder", ParticipantEntry.objects.filter(jam=jam, instrument=instrument).count())),
    )
    _create_round_slots_for_entry(entry, entry_payload.get("visible_round_depth", entry_payload.get("visibleRoundDepth", 1)))
    return entry


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


def apply_ensure_round_slots(jam, payload):
    instrument = _get_instrument(jam, _get_payload_id(payload, "instrument", "instrument_id", "instrumentId"))
    return _ensure_round_slots_for_instrument(jam, instrument, int(payload.get("round_number", payload.get("roundNumber", 1))))


def apply_move_round_slot_vertical(jam, payload):
    slot = _get_round_slot(jam, _get_payload_id(payload, "slot", "slot_id", "slotId"))
    if slot.status == RoundSlot.STATUS_PLAYED:
        return slot
    slots = list(RoundSlot.objects.filter(jam=jam, instrument=slot.instrument).order_by("display_order", "id"))
    reordered = [candidate for candidate in slots if candidate.id != slot.id]
    target_index = max(0, min(payload.get("to_index", payload.get("toIndex", 0)), len(reordered)))
    reordered.insert(target_index, slot)
    for index, candidate in enumerate(reordered):
        if candidate.display_order != index:
            candidate.display_order = index
            candidate.save(update_fields=["display_order", "updated_at"])
    return slot


def apply_link_round_slots(jam, payload):
    slots = [_get_round_slot(jam, slot_id) for slot_id in payload.get("slot_ids", payload.get("slotIds", []))]
    deduped = list({slot.id: slot for slot in slots}.values())
    _remove_slots_from_slot_link_groups(jam, deduped)
    if len(deduped) < 2:
        return None
    group = SlotLinkGroup.objects.create(jam=jam, reason=payload.get("reason", SlotLinkGroup.REASON_MANUAL))
    group.slots.set(deduped)
    return group


def apply_unlink_round_slots(jam, payload):
    group_id = _get_payload_id(payload, "slot_link_group", "slot_link_group_id", "slotLinkGroupId")
    if group_id:
        SlotLinkGroup.objects.filter(jam=jam, id=group_id).delete()
        return None
    slots = [_get_round_slot(jam, slot_id) for slot_id in payload.get("slot_ids", payload.get("slotIds", []))]
    _remove_slots_from_slot_link_groups(jam, slots)
    return None


def apply_add_round_hole(jam, payload):
    instrument = _get_instrument(jam, _get_payload_id(payload, "instrument", "instrument_id", "instrumentId"))
    slot = RoundSlot.objects.create(
        jam=jam,
        instrument=instrument,
        slot_type=RoundSlot.SLOT_HOLE,
        participant_entry=None,
        round_number=int(payload.get("round_number", payload.get("roundNumber", 1))),
        display_order=payload.get("display_order", payload.get("displayOrder", RoundSlot.objects.filter(jam=jam, instrument=instrument).count())),
        created_by_action=payload.get("created_by_action", payload.get("createdByAction", "ADD_ROUND_HOLE")),
    )
    _normalize_instrument_round_slot_orders(jam, instrument)
    return slot


def apply_remove_round_hole(jam, payload):
    slot = _get_round_slot(jam, _get_payload_id(payload, "slot", "slot_id", "slotId"))
    if slot.slot_type != RoundSlot.SLOT_HOLE:
        raise ActionApplicationError("Seuls les trous de round peuvent être supprimés.")
    if slot.status == RoundSlot.STATUS_PLAYED:
        return slot
    instrument = slot.instrument
    _remove_slots_from_slot_link_groups(jam, [slot])
    slot.delete()
    _normalize_instrument_round_slot_orders(jam, instrument)
    return None


def apply_wants_to_play_without_round(jam, payload):
    source_slot = _get_round_slot(jam, _get_payload_id(payload, "source_slot", "source_slot_id", "sourceSlotId"))
    source_group = source_slot.link_groups.filter(jam=jam, status=SlotLinkGroup.STATUS_ACTIVE).first()
    source_slots = list(source_group.slots.all()) if source_group else [source_slot]
    holes = []
    for instrument_id in payload.get("instrument_ids", payload.get("instrumentIds", [])):
        instrument = _get_instrument(jam, instrument_id)
        hole = RoundSlot.objects.create(
            jam=jam, instrument=instrument, slot_type=RoundSlot.SLOT_HOLE, participant_entry=None,
            round_number=source_slot.round_number, display_order=source_slot.display_order,
            created_by_action="WANTS_TO_PLAY_WITHOUT_ROUND",
        )
        _normalize_instrument_round_slot_orders(jam, instrument)
        holes.append(hole)
    if holes:
        if source_group:
            source_group.delete()
        group = SlotLinkGroup.objects.create(jam=jam, reason=SlotLinkGroup.REASON_WITHOUT)
        group.slots.set(source_slots + holes)
    return holes


def apply_mark_round_slot_played(jam, payload):
    slot = _get_round_slot(jam, _get_payload_id(payload, "slot", "slot_id", "slotId"))
    slot.status = RoundSlot.STATUS_PLAYED
    slot.played_at = _parse_played_at(payload.get("played_at") or payload.get("playedAt"))
    slot.save(update_fields=["status", "played_at", "updated_at"])
    return slot


def apply_mark_plateau_played_rounds(jam, payload):
    if "slotIds" not in payload and "slot_ids" not in payload:
        return apply_mark_plateau_played(jam, payload)
    slots = [_get_round_slot(jam, slot_id) for slot_id in payload.get("slot_ids", payload.get("slotIds", []))]
    played_at = _parse_played_at(payload.get("played_at") or payload.get("playedAt"))
    plateau = Plateau.objects.create(jam=jam, status=Plateau.STATUS_PLAYED, played_at=played_at)
    plateau.slots.set(slots)
    for slot in slots:
        slot.status = RoundSlot.STATUS_PLAYED
        slot.played_at = played_at
        slot.save(update_fields=["status", "played_at", "updated_at"])
    return plateau


def apply_undo_round_slot_played(jam, payload):
    slot = _get_round_slot(jam, _get_payload_id(payload, "slot", "slot_id", "slotId"))
    slot.status = RoundSlot.STATUS_PLANNED
    slot.played_at = None
    slot.save(update_fields=["status", "played_at", "updated_at"])
    for plateau in list(slot.plateaux.filter(jam=jam, status=Plateau.STATUS_PLAYED)):
        plateau.slots.remove(slot)
        if plateau.slots.count() == 0:
            plateau.status = Plateau.STATUS_CANCELLED
            plateau.save(update_fields=["status", "updated_at"])
    return slot


def apply_undo_plateau_played_rounds(jam, payload):
    plateau_id = _get_payload_id(payload, "plateau", "plateau_id", "plateauId")
    if not plateau_id:
        return apply_undo_plateau_played(jam, payload)
    try:
        plateau = Plateau.objects.get(jam=jam, id=plateau_id)
    except (Plateau.DoesNotExist, ValueError, TypeError) as exc:
        raise ActionApplicationError("Plateau introuvable pour cette jam.") from exc
    slots = list(plateau.slots.all())
    plateau.status = Plateau.STATUS_CANCELLED
    plateau.save(update_fields=["status", "updated_at"])
    for slot in slots:
        if not slot.plateaux.filter(jam=jam, status=Plateau.STATUS_PLAYED).exclude(id=plateau.id).exists():
            slot.status = RoundSlot.STATUS_PLANNED
            slot.played_at = None
            slot.save(update_fields=["status", "played_at", "updated_at"])
    return plateau


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
    "ENSURE_ROUND_SLOTS": apply_ensure_round_slots,
    "MOVE_ROUND_SLOT_VERTICAL": apply_move_round_slot_vertical,
    "LINK_ITEMS": apply_link_items,
    "UNLINK_ITEMS": apply_unlink_items,
    "LINK_ROUND_SLOTS": apply_link_round_slots,
    "UNLINK_ROUND_SLOTS": apply_unlink_round_slots,
    "ADD_HOLE": apply_add_hole,
    "REMOVE_HOLE": apply_remove_hole,
    "WANTS_TO_PLAY_WITHOUT": apply_wants_to_play_without,
    "ADD_ROUND_HOLE": apply_add_round_hole,
    "REMOVE_ROUND_HOLE": apply_remove_round_hole,
    "WANTS_TO_PLAY_WITHOUT_ROUND": apply_wants_to_play_without_round,
    "MARK_ENTRY_PLAYED": apply_mark_entry_played,
    "MARK_ROUND_SLOT_PLAYED": apply_mark_round_slot_played,
    "UNDO_ROUND_SLOT_PLAYED": apply_undo_round_slot_played,
    "MARK_PLATEAU_PLAYED": apply_mark_plateau_played_rounds,
    "UNDO_ENTRY_PLAYED": apply_undo_entry_played,
    "UNDO_PLATEAU_PLAYED": apply_undo_plateau_played_rounds,
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
