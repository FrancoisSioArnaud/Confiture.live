export function createEmptyJamState(overrides = {}) {
  return {
    jam: {
      id: "jam-1",
      name: "Jam de test",
      indicativeDate: "2026-06-12",
    },
    instruments: [
      { id: "vocal", name: "Chant", order: 0, isDefault: true },
      { id: "guitar", name: "Guitare", order: 1, isDefault: true },
      { id: "drums", name: "Batterie", order: 2, isDefault: true },
    ],
    participants: [],
    entries: [],
    linkGroups: [],
    holes: [],
    playedPassages: [],
    ...overrides,
  };
}

export function createParticipant(id, name, status = "active") {
  return { id, jamId: "jam-1", name, status };
}

export function createEntry(id, participantId, instrumentId, baseOrder, customInstrumentLabel = null) {
  return {
    id,
    jamId: "jam-1",
    participantId,
    instrumentId,
    customInstrumentLabel,
    baseOrder,
  };
}

export function createHole(id, instrumentId, position, createdByAction = "ADD_HOLE") {
  return {
    id,
    jamId: "jam-1",
    instrumentId,
    position,
    createdByAction,
  };
}

export function createPlayedPassage(id, { participantEntryId = null, holeId = null, lineIndex = 0, playedAt = "2026-06-12T20:00:00.000Z" }) {
  return {
    id,
    jamId: "jam-1",
    participantEntryId,
    holeId,
    lineIndex,
    playedAt,
  };
}

export function createBasicJamState() {
  return createEmptyJamState({
    participants: [
      createParticipant("participant-sarah", "Sarah"),
      createParticipant("participant-nicolas", "Nicolas"),
      createParticipant("participant-tom", "Tom"),
      createParticipant("participant-jeremy", "Jérémy"),
    ],
    entries: [
      createEntry("entry-sarah-vocal", "participant-sarah", "vocal", 0),
      createEntry("entry-nicolas-guitar", "participant-nicolas", "guitar", 0),
      createEntry("entry-tom-guitar", "participant-tom", "guitar", 1),
      createEntry("entry-jeremy-drums", "participant-jeremy", "drums", 0),
    ],
    linkGroups: [],
    holes: [],
    playedPassages: [],
  });
}
