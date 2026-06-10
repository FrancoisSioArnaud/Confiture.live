export function getSortedInstruments(jamState) {
  return [...jamState.instruments].sort((left, right) => left.order - right.order);
}

export function getParticipantById(jamState, participantId) {
  return jamState.participants.find((participant) => participant.id === participantId);
}

export function getEntryById(jamState, entryId) {
  return jamState.entries.find((entry) => entry.id === entryId);
}

export function getHoleById(jamState, holeId) {
  return jamState.holes.find((hole) => hole.id === holeId);
}

export function getLinkGroupForEntry(jamState, entryId) {
  return jamState.linkGroups.find((group) => group.entryIds.includes(entryId));
}

export function getLinkGroupForHole(jamState, holeId) {
  return jamState.linkGroups.find((group) => group.holeIds.includes(holeId));
}

export function hasEntryBeenPlayed(jamState, entryId) {
  return jamState.playedPassages.some((passage) => passage.participantEntryId === entryId);
}

export function hasHoleBeenPlayed(jamState, holeId) {
  return jamState.playedPassages.some((passage) => passage.holeId === holeId);
}

export function getPlayedPlateauLineIndexes(jamState) {
  return [...new Set(jamState.playedPassages.map((passage) => passage.lineIndex))]
    .filter((lineIndex) => Number.isInteger(lineIndex))
    .sort((left, right) => left - right);
}
