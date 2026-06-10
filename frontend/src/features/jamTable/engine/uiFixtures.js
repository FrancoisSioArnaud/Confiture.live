import { actionTypes } from "./actionTypes.js";
import { createEmptyJamState, createEntry, createHole, createParticipant, createPlayedPassage } from "./fixtures.js";

export function createJamTableUiFixture() {
  return createEmptyJamState({
    jam: {
      id: "jam-demo",
      name: "Jam du jeudi",
      indicativeDate: "2026-06-12",
    },
    instruments: [
      { id: "vocal", name: "Chant", order: 0, isDefault: true },
      { id: "guitar", name: "Guitare", order: 1, isDefault: true },
      { id: "bass", name: "Basse", order: 2, isDefault: true },
      { id: "drums", name: "Batterie", order: 3, isDefault: true },
      { id: "piano", name: "Piano", order: 4, isDefault: true },
      { id: "other", name: "Autres", order: 5, isDefault: true },
    ],
    participants: [
      createParticipant("participant-sarah", "Sarah"),
      createParticipant("participant-nicolas", "Nicolas"),
      createParticipant("participant-tom", "Tom"),
      createParticipant("participant-jeremy", "Jérémy"),
      createParticipant("participant-jeanne", "Jeanne"),
      createParticipant("participant-lea", "Léa"),
      createParticipant("participant-maya", "Maya"),
      createParticipant("participant-paul", "Paul", "left"),
    ],
    entries: [
      createEntry("entry-sarah-vocal", "participant-sarah", "vocal", 0),
      createEntry("entry-maya-vocal", "participant-maya", "vocal", 1),
      createEntry("entry-paul-guitar", "participant-paul", "guitar", 0),
      createEntry("entry-nicolas-guitar", "participant-nicolas", "guitar", 1),
      createEntry("entry-tom-bass", "participant-tom", "bass", 0),
      createEntry("entry-jeremy-drums", "participant-jeremy", "drums", 0),
      createEntry("entry-jeanne-piano", "participant-jeanne", "piano", 0),
      createEntry("entry-lea-other", "participant-lea", "other", 0, "Saxophone"),
    ],
    holes: [
      createHole("hole-without-drums", "drums", 0, actionTypes.WANTS_TO_PLAY_WITHOUT),
    ],
    linkGroups: [
      {
        id: "link-a",
        entryIds: ["entry-nicolas-guitar"],
        holeIds: ["hole-without-drums"],
      },
    ],
    playedPassages: [
      createPlayedPassage("played-sarah", {
        participantEntryId: "entry-sarah-vocal",
        lineIndex: 0,
        playedAt: "2026-06-12T20:15:00.000Z",
      }),
      createPlayedPassage("played-paul", {
        participantEntryId: "entry-paul-guitar",
        lineIndex: 0,
        playedAt: "2026-06-12T20:15:00.000Z",
      }),
    ],
  });
}
