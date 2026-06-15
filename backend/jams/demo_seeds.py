from copy import deepcopy

CLIENT_ID = "client_demo_seed"
CREATED_AT = "2026-01-01T18:00:00Z"
SEED_NAMES = ("simple", "rounds", "links", "multi", "complex", "sync")
DEFAULT_INSTRUMENTS = (
    ("instrument_vocals", "Chant"),
    ("instrument_guitar", "Guitare"),
    ("instrument_bass", "Basse"),
    ("instrument_drums", "Batterie"),
    ("instrument_piano", "Piano"),
    ("instrument_other", "Autre"),
)


def _slug(value):
    return (
        value.lower()
        .replace("é", "e")
        .replace("è", "e")
        .replace("ê", "e")
        .replace("à", "a")
        .replace(" ", "_")
    )


def _event(seed, number, index, transaction_id, jam_id, event_type, payload):
    return {
        "eventId": f"evt_demo_{seed}_{number:03d}_{index}",
        "transactionId": transaction_id,
        "jamId": jam_id,
        "type": event_type,
        "payload": payload,
        "createdAt": CREATED_AT,
        "clientId": CLIENT_ID,
        "clientSequenceNumber": number,
        "eventIndexInTransaction": index,
        "serverSequenceNumber": number,
        "schemaVersion": 1,
    }


def _tx(seed, number, jam_id, label, event_specs):
    transaction_id = f"tx_demo_{seed}_{number:03d}"
    return {
        "transactionId": transaction_id,
        "jamId": jam_id,
        "clientId": CLIENT_ID,
        "clientSequenceNumber": number,
        "serverSequenceNumberStart": number,
        "serverSequenceNumberEnd": number,
        "createdAt": CREATED_AT,
        "schemaVersion": 1,
        "source": "demo_seed",
        "label": label,
        "events": [_event(seed, number, index, transaction_id, jam_id, event_type, payload) for index, (event_type, payload) in enumerate(event_specs)],
    }


def _instrument_events(instruments):
    return [("instrument_added", {"instrumentId": instrument_id, "label": label, "orderKey": f"order_{index}", "visible": True, "isDefault": True}) for index, (instrument_id, label) in enumerate(instruments, start=1)]


def _base(seed, name, date, instruments=None):
    instruments = instruments or DEFAULT_INSTRUMENTS[:4]
    jam_id = f"jam_demo_{seed}"
    return [
        _tx(seed, 1, jam_id, "Créer jam", [("jam_created", {"jamId": jam_id, "name": name, "indicativeDate": date, "linkReorderStrategy": "move_to_first"})]),
        _tx(seed, 2, jam_id, "Ajouter instruments", _instrument_events(instruments)),
    ]


def _participant_tx(seed, number, jam_id, name, instrument_id, order, custom_label=None):
    slug = _slug(name)
    participant_id = f"participant_{seed}_{slug}"
    participation_id = f"participation_{seed}_{slug}_{instrument_id.replace('instrument_', '')}"
    return _tx(seed, number, jam_id, f"Ajouter {name}", [
        ("participant_created", {"participantId": participant_id, "name": name}),
        ("participation_added", {"participationId": participation_id, "participantId": participant_id, "instrumentId": instrument_id, "customInstrumentLabel": custom_label, "insertionMode": "end_of_visible_rounds", "startAppearanceIndex": 1, "afterTarget": None, "beforeTarget": None, "baseOrderKey": f"order_{order}"}),
    ])


def _replace_seed_value(value, from_seed, to_seed):
    jam_id = f"jam_demo_{to_seed}"
    if isinstance(value, str):
        return value.replace(f"_{from_seed}_", f"_{to_seed}_").replace(f"demo_{from_seed}", f"demo_{to_seed}").replace(f"jam_demo_{from_seed}", jam_id)
    if isinstance(value, list):
        return [_replace_seed_value(item, from_seed, to_seed) for item in value]
    if isinstance(value, dict):
        return {key: _replace_seed_value(item, from_seed, to_seed) for key, item in value.items()}
    return value


def _remap(transactions, from_seed, to_seed):
    return _replace_seed_value(deepcopy(transactions), from_seed, to_seed)


def build_demo_seed(seed):
    jam_id = f"jam_demo_{seed}"
    if seed == "simple":
        return [
            *_base(seed, "Jam simple — 4 instruments", "2026-01-15"),
            _participant_tx(seed, 3, jam_id, "Sarah", "instrument_vocals", 1),
            _participant_tx(seed, 4, jam_id, "Nicolas", "instrument_guitar", 1),
            _participant_tx(seed, 5, jam_id, "Tom", "instrument_bass", 1),
            _participant_tx(seed, 6, jam_id, "Jérémy", "instrument_drums", 1),
            _participant_tx(seed, 7, jam_id, "Léa", "instrument_vocals", 2),
            _participant_tx(seed, 8, jam_id, "Paul", "instrument_guitar", 2),
            _participant_tx(seed, 9, jam_id, "Max", "instrument_bass", 2),
            _participant_tx(seed, 10, jam_id, "Rayan", "instrument_drums", 2),
        ]
    if seed == "rounds":
        return [
            *_base(seed, "Jam rounds — reveal", "2026-01-16"),
            _participant_tx(seed, 3, jam_id, "Sarah", "instrument_vocals", 1),
            _participant_tx(seed, 4, jam_id, "Nicolas", "instrument_guitar", 1),
            _participant_tx(seed, 5, jam_id, "Tom", "instrument_bass", 1),
            _participant_tx(seed, 6, jam_id, "Jérémy", "instrument_drums", 1),
            _tx(seed, 7, jam_id, "Afficher round 2", [("instrument_round_visibility_changed", {"instrumentId": "instrument_vocals", "visibleRoundCount": 2}), ("instrument_round_visibility_changed", {"instrumentId": "instrument_guitar", "visibleRoundCount": 2})]),
            _participant_tx(seed, 8, jam_id, "Emma", "instrument_vocals", 2),
        ]
    if seed == "links":
        return [
            *_remap(build_demo_seed("simple"), "simple", seed),
            _tx(seed, 11, jam_id, "Link Sarah Nicolas", [("link_created", {"linkId": "link_demo_links_sarah_nicolas", "targets": [{"type": "appearance", "id": "appearance_participation_links_sarah_vocals_1"}, {"type": "appearance", "id": "appearance_participation_links_nicolas_guitar_1"}], "anchorTarget": {"type": "appearance", "id": "appearance_participation_links_sarah_vocals_1"}, "reorderStrategy": "move_to_first"})]),
            _tx(seed, 12, jam_id, "Conflict Léa Paul", [("conflict_created", {"conflictId": "conflict_demo_links_lea_paul", "scope": "appearance", "targetIds": ["appearance_participation_links_lea_vocals_1", "appearance_participation_links_paul_guitar_1"], "reason": "manual", "anchorTargetId": "appearance_participation_links_lea_vocals_1"})]),
        ]
    if seed == "multi":
        return [
            *_base(seed, "Jam multi-instruments", "2026-01-17", DEFAULT_INSTRUMENTS),
            _participant_tx(seed, 3, jam_id, "Nicolas", "instrument_vocals", 1),
            _tx(seed, 4, jam_id, "Nicolas guitare", [("participation_added", {"participationId": "participation_multi_nicolas_guitar", "participantId": "participant_multi_nicolas", "instrumentId": "instrument_guitar", "customInstrumentLabel": None, "insertionMode": "end_of_visible_rounds", "startAppearanceIndex": 1, "afterTarget": None, "beforeTarget": None, "baseOrderKey": "order_1"})]),
            _tx(seed, 5, jam_id, "Conflit instruments Nicolas", [("conflict_created", {"conflictId": "conflict_demo_multi_nicolas", "scope": "participation", "targetIds": ["participation_multi_nicolas_vocals", "participation_multi_nicolas_guitar"], "reason": "instrument_constraint", "anchorTargetId": "participation_multi_nicolas_vocals"})]),
            _participant_tx(seed, 6, jam_id, "Hugo", "instrument_other", 2, "saxophone"),
        ]
    if seed == "complex":
        return [
            *_remap(build_demo_seed("links"), "links", seed),
            _tx(seed, 13, jam_id, "Trou Batterie", [("hole_added", {"holeId": "hole_demo_complex_drums_1", "instrumentId": "instrument_drums", "appearanceIndex": 1, "reason": "manual", "afterTarget": None, "beforeTarget": {"type": "appearance", "id": "appearance_participation_complex_jeremy_drums_1"}, "positionKey": "position_hole_demo_complex_drums_1"})]),
            _tx(seed, 14, jam_id, "Verrouiller Sarah", [("appearance_locked", {"appearanceId": "appearance_participation_complex_sarah_vocals_1"})]),
            _tx(seed, 15, jam_id, "Plateau joué", [("plateau_played", {"plateauIndex": 0, "targets": [{"type": "appearance", "id": "appearance_participation_complex_sarah_vocals_1"}, {"type": "appearance", "id": "appearance_participation_complex_nicolas_guitar_1"}, {"type": "appearance", "id": "appearance_participation_complex_tom_bass_1"}, {"type": "hole", "id": "hole_demo_complex_drums_1"}], "playedAt": "2026-01-17T21:00:00.000Z"})]),
            _tx(seed, 16, jam_id, "Paul parti", [("participant_marked_left", {"participantId": "participant_complex_paul", "confirmedDespiteFutureLockedAppearances": True})]),
        ]
    if seed == "sync":
        return [
            *_base(seed, "Jam sync/offline — démo", "2026-01-18"),
            _participant_tx(seed, 3, jam_id, "Alice", "instrument_vocals", 1),
            _participant_tx(seed, 4, jam_id, "Jules", "instrument_guitar", 1),
            _tx(seed, 5, jam_id, "Update pending style", [("jam_updated", {"name": "Jam sync/offline — sauvegarde locale"})]),
        ]
    raise ValueError(f"Unknown demo seed: {seed}")
