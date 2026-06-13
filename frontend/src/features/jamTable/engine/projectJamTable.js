import {
  getLinkGroupForEntry,
  getLinkGroupForHole,
  getParticipantById,
  getSortedInstruments,
  hasEntryBeenPlayed,
  hasHoleBeenPlayed,
} from "./selectors.js";

const LOOP_PREVIEW_ROWS = 3;

function makeEmptyCell(instrumentId) {
  return {
    type: "empty",
    instrumentId,
    isPlayed: false,
    isNextPlayable: false,
    isLoop: false,
    loopNumber: null,
    linkGroupId: null,
    isParticipantLeft: false,
  };
}

function makeEntryCell(jamState, entry, options = {}) {
  const participant = getParticipantById(jamState, entry.participantId);
  const linkGroup = getLinkGroupForEntry(jamState, entry.id);

  return {
    type: "entry",
    entryId: entry.id,
    participantId: entry.participantId,
    participantName: participant?.name ?? "Musicien inconnu",
    instrumentId: entry.instrumentId,
    customInstrumentLabel: entry.customInstrumentLabel ?? null,
    isPlayed: Boolean(options.isPlayed),
    isNextPlayable: false,
    isLoop: Boolean(options.isLoop),
    loopNumber: options.loopNumber ?? null,
    linkGroupId: linkGroup?.id ?? null,
    isParticipantLeft: participant?.status === "left",
  };
}

function makeHoleCell(jamState, hole, options = {}) {
  const linkGroup = getLinkGroupForHole(jamState, hole.id);

  return {
    type: "hole",
    holeId: hole.id,
    participantEntryId: null,
    participantId: null,
    participantName: null,
    instrumentId: hole.instrumentId,
    customInstrumentLabel: null,
    isPlayed: Boolean(options.isPlayed),
    isNextPlayable: false,
    isLoop: false,
    loopNumber: null,
    linkGroupId: linkGroup?.id ?? null,
    isParticipantLeft: false,
  };
}

function itemKey(item) {
  return `${item.kind}:${item.id}`;
}

function getItemInstrumentId(item, entriesById, holesById) {
  return item.kind === "entry"
    ? entriesById.get(item.id)?.instrumentId
    : holesById.get(item.id)?.instrumentId;
}

function findNextFreeRow(occupiedByInstrument, instrumentId, fromRow) {
  let rowIndex = fromRow;
  while (occupiedByInstrument.get(instrumentId)?.has(rowIndex)) {
    rowIndex += 1;
  }
  return rowIndex;
}

function occupy(occupiedByInstrument, instrumentId, rowIndex) {
  if (!occupiedByInstrument.has(instrumentId)) {
    occupiedByInstrument.set(instrumentId, new Set());
  }
  occupiedByInstrument.get(instrumentId).add(rowIndex);
}

function buildFirstPassItems(jamState, instruments) {
  const items = [];
  const participantById = new Map(jamState.participants.map((participant) => [participant.id, participant]));

  for (const instrument of instruments) {
    const entries = jamState.entries
      .filter((entry) => entry.instrumentId === instrument.instrumentId)
      .filter((entry) => participantById.get(entry.participantId)?.status !== "left")
      .filter((entry) => !hasEntryBeenPlayed(jamState, entry.id))
      .map((entry) => ({
        kind: "entry",
        id: entry.id,
        instrumentId: entry.instrumentId,
        order: entry.baseOrder,
      }));

    const holes = jamState.holes
      .filter((hole) => hole.instrumentId === instrument.instrumentId)
      .filter((hole) => !hasHoleBeenPlayed(jamState, hole.id))
      .map((hole) => ({
        kind: "hole",
        id: hole.id,
        instrumentId: hole.instrumentId,
        order: hole.position,
      }));

    [...entries, ...holes]
      .sort((left, right) => left.order - right.order || (left.kind === right.kind ? 0 : left.kind === "hole" ? -1 : 1) || itemKey(left).localeCompare(itemKey(right)))
      .forEach((item, naturalIndex) => {
        items.push({ ...item, naturalIndex });
      });
  }

  return items;
}

function buildPlacementGroups(jamState, firstPassItems) {
  const itemByKey = new Map(firstPassItems.map((item) => [itemKey(item), item]));
  const visited = new Set();
  const groups = [];

  for (const linkGroup of jamState.linkGroups) {
    const linkedItems = [
      ...linkGroup.entryIds.map((id) => `entry:${id}`),
      ...linkGroup.holeIds.map((id) => `hole:${id}`),
    ]
      .map((key) => itemByKey.get(key))
      .filter(Boolean);

    if (linkedItems.length > 0) {
      linkedItems.forEach((item) => visited.add(itemKey(item)));
      groups.push({
        linkGroupId: linkGroup.id,
        desiredRow: Math.max(...linkedItems.map((item) => item.naturalIndex)),
        items: linkedItems,
      });
    }
  }

  for (const item of firstPassItems) {
    if (!visited.has(itemKey(item))) {
      groups.push({
        linkGroupId: null,
        desiredRow: item.naturalIndex,
        items: [item],
      });
    }
  }

  return groups.sort((left, right) => left.desiredRow - right.desiredRow || String(left.linkGroupId ?? "").localeCompare(String(right.linkGroupId ?? "")));
}

function placeFirstPassItems(jamState, tableCells, occupiedByInstrument, instruments) {
  const entriesById = new Map(jamState.entries.map((entry) => [entry.id, entry]));
  const holesById = new Map(jamState.holes.map((hole) => [hole.id, hole]));
  const firstPassItems = buildFirstPassItems(jamState, instruments);

  for (const group of buildPlacementGroups(jamState, firstPassItems)) {
    const rowIndex = Math.max(
      group.desiredRow,
      ...group.items.map((item) => findNextFreeRow(occupiedByInstrument, item.instrumentId, group.desiredRow)),
    );

    for (const item of group.items) {
      const instrumentId = getItemInstrumentId(item, entriesById, holesById);
      if (!tableCells.has(rowIndex)) {
        tableCells.set(rowIndex, new Map());
      }

      const cell = item.kind === "entry"
        ? makeEntryCell(jamState, entriesById.get(item.id))
        : makeHoleCell(jamState, holesById.get(item.id));

      tableCells.get(rowIndex).set(instrumentId, cell);
      occupy(occupiedByInstrument, instrumentId, rowIndex);
    }
  }
}

function placePlayedHistory(jamState, tableCells, occupiedByInstrument) {
  const entriesById = new Map(jamState.entries.map((entry) => [entry.id, entry]));
  const holesById = new Map(jamState.holes.map((hole) => [hole.id, hole]));

  for (const passage of jamState.playedPassages) {
    const rowIndex = passage.lineIndex ?? 0;
    const entry = passage.participantEntryId ? entriesById.get(passage.participantEntryId) : null;
    const hole = passage.holeId ? holesById.get(passage.holeId) : null;
    const instrumentId = entry?.instrumentId ?? hole?.instrumentId;

    if (!instrumentId) {
      continue;
    }

    if (!tableCells.has(rowIndex)) {
      tableCells.set(rowIndex, new Map());
    }

    tableCells.get(rowIndex).set(
      instrumentId,
      entry ? makeEntryCell(jamState, entry, { isPlayed: true }) : makeHoleCell(jamState, hole, { isPlayed: true }),
    );
    occupy(occupiedByInstrument, instrumentId, rowIndex);
  }
}

function placeLoopPreview(jamState, tableCells, occupiedByInstrument, instruments) {
  const participantById = new Map(jamState.participants.map((participant) => [participant.id, participant]));

  for (const instrument of instruments) {
    const activeEntries = jamState.entries
      .filter((entry) => entry.instrumentId === instrument.instrumentId)
      .filter((entry) => participantById.get(entry.participantId)?.status !== "left")
      .sort((left, right) => left.baseOrder - right.baseOrder || String(left.id).localeCompare(String(right.id)));

    if (activeEntries.length === 0) {
      continue;
    }

    const firstLoopRow = findNextFreeRow(occupiedByInstrument, instrument.instrumentId, 0);

    for (let loopIndex = 0; loopIndex < LOOP_PREVIEW_ROWS; loopIndex += 1) {
      const entry = activeEntries[loopIndex % activeEntries.length];
      const rowIndex = findNextFreeRow(occupiedByInstrument, instrument.instrumentId, firstLoopRow + loopIndex);
      const loopNumber = Math.floor(loopIndex / activeEntries.length) + 2;

      if (!tableCells.has(rowIndex)) {
        tableCells.set(rowIndex, new Map());
      }

      tableCells.get(rowIndex).set(
        instrument.instrumentId,
        makeEntryCell(jamState, entry, { isLoop: true, loopNumber }),
      );
      occupy(occupiedByInstrument, instrument.instrumentId, rowIndex);
    }
  }
}

function markNextPlayable(rows, instruments) {
  for (const instrument of instruments) {
    const nextRow = rows.find((row) => {
      const cell = row.cells[instrument.instrumentId];
      return cell.type === "entry" && !cell.isPlayed;
    });

    if (nextRow) {
      nextRow.cells[instrument.instrumentId].isNextPlayable = true;
    }
  }
}

function buildStats(jamState) {
  const playedEntryIds = new Set(
    jamState.playedPassages
      .map((passage) => passage.participantEntryId)
      .filter(Boolean),
  );
  const participantsById = new Map(jamState.participants.map((participant) => [participant.id, participant]));
  const activeEntries = jamState.entries.filter((entry) => participantsById.get(entry.participantId)?.status !== "left");

  return {
    uniqueMusiciansCount: jamState.participants.length,
    participantEntriesCount: jamState.entries.length,
    playedPlateausCount: new Set(jamState.playedPassages.map((passage) => passage.lineIndex)).size,
    unplayedActiveEntriesCount: activeEntries.filter((entry) => !playedEntryIds.has(entry.id)).length,
  };
}

export function projectLegacyJamTable(jamState) {
  const columns = getSortedInstruments(jamState).map((instrument) => ({
    instrumentId: instrument.id,
    name: instrument.name,
    order: instrument.order,
  }));
  const tableCells = new Map();
  const occupiedByInstrument = new Map(columns.map((column) => [column.instrumentId, new Set()]));

  placePlayedHistory(jamState, tableCells, occupiedByInstrument);
  placeFirstPassItems(jamState, tableCells, occupiedByInstrument, columns);
  placeLoopPreview(jamState, tableCells, occupiedByInstrument, columns);

  const maxRowIndex = Math.max(-1, ...tableCells.keys());
  const rows = Array.from({ length: maxRowIndex + 1 }, (_, rowIndex) => {
    const rowCells = tableCells.get(rowIndex) ?? new Map();
    const cells = Object.fromEntries(
      columns.map((column) => [
        column.instrumentId,
        rowCells.get(column.instrumentId) ?? makeEmptyCell(column.instrumentId),
      ]),
    );

    return { rowIndex, cells };
  });

  markNextPlayable(rows, columns);

  return {
    columns,
    rows,
    stats: buildStats(jamState),
  };
}


function makeRoundEmptyCell(instrumentId) {
  return { type: "empty", instrumentId, isPlayed: false, isNextPlayable: false, isLoop: false, loopNumber: null, roundNumber: null, linkGroupId: null, isParticipantLeft: false };
}
function activeRoundSlotLinkGroups(jamState) { return (jamState.slotLinkGroups ?? []).filter((g) => (g.status ?? "active") === "active"); }
function getRoundSlotLinkGroup(jamState, slotId) { return activeRoundSlotLinkGroups(jamState).find((g) => (g.slotIds ?? []).includes(slotId)); }
function makeRoundSlotCell(jamState, slot) {
  const entry = (jamState.entries ?? []).find((e) => e.id === slot.participantEntryId);
  const participant = entry ? getParticipantById(jamState, entry.participantId) : null;
  const linkGroup = getRoundSlotLinkGroup(jamState, slot.id);
  const base = { slotId: slot.id, instrumentId: slot.instrumentId, roundNumber: slot.roundNumber, status: slot.status, isPlayed: slot.status === "played", isNextPlayable: false, isLoop: false, loopNumber: null, linkGroupId: linkGroup?.id ?? null, isParticipantLeft: participant?.status === "left" };
  if (slot.slotType === "hole") return { ...base, type: "hole", holeId: slot.id, participantEntryId: null, participantId: null, participantName: null, customInstrumentLabel: null };
  return { ...base, type: "entry", entryId: entry?.id ?? slot.participantEntryId, participantEntryId: entry?.id ?? slot.participantEntryId, participantId: entry?.participantId ?? null, participantName: participant?.name ?? "Musicien inconnu", customInstrumentLabel: entry?.customInstrumentLabel ?? null };
}
function findRoundNextFreeRow(occupiedByInstrument, instrumentId, fromRow) { let rowIndex = fromRow; while (occupiedByInstrument.get(instrumentId)?.has(rowIndex)) rowIndex += 1; return rowIndex; }
function occupyRoundSlot(occupiedByInstrument, instrumentId, rowIndex) { if (!occupiedByInstrument.has(instrumentId)) occupiedByInstrument.set(instrumentId, new Set()); occupiedByInstrument.get(instrumentId).add(rowIndex); }
function buildRoundStats(jamState) {
  const playedEntryIds = new Set((jamState.roundSlots ?? []).filter((s) => s.slotType === "entry" && s.status === "played").map((s) => s.participantEntryId));
  const participantsById = new Map((jamState.participants ?? []).map((p) => [p.id, p]));
  const activeEntries = (jamState.entries ?? []).filter((e) => participantsById.get(e.participantId)?.status !== "left");
  return { uniqueMusiciansCount: (jamState.participants ?? []).length, participantEntriesCount: (jamState.entries ?? []).length, playedPlateausCount: (jamState.plateaux ?? []).filter((p) => (p.status ?? "played") === "played").length, unplayedActiveEntriesCount: activeEntries.filter((e) => !playedEntryIds.has(e.id)).length };
}
function projectFromRoundSlots(jamState, options = {}) {
  const columns = getSortedInstruments(jamState).map((i) => ({ instrumentId: i.id, name: i.name, order: i.order, visibleRoundDepth: options.visibleRoundDepthByInstrument?.[i.id] ?? 1 }));
  const visibleById = new Map(columns.map((c) => [c.instrumentId, c.visibleRoundDepth]));
  const slots = (jamState.roundSlots ?? []).filter((s) => (s.status ?? "planned") !== "cancelled" && (s.roundNumber ?? 1) <= (visibleById.get(s.instrumentId) ?? 1));
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const groups = [];
  const visited = new Set();
  for (const group of activeRoundSlotLinkGroups(jamState)) {
    const groupSlots = (group.slotIds ?? []).map((id) => slotById.get(id)).filter(Boolean);
    if (groupSlots.length) { groupSlots.forEach((s) => visited.add(s.id)); groups.push({ linkGroupId: group.id, desiredRow: Math.max(...groupSlots.map((s) => s.displayOrder ?? 0)), slots: groupSlots }); }
  }
  for (const slot of slots) if (!visited.has(slot.id)) groups.push({ linkGroupId: null, desiredRow: slot.displayOrder ?? 0, slots: [slot] });
  groups.sort((a,b)=>a.desiredRow-b.desiredRow||String(a.linkGroupId??"").localeCompare(String(b.linkGroupId??"")));
  const tableCells = new Map(); const occupied = new Map(columns.map((c)=>[c.instrumentId,new Set()]));
  for (const group of groups) {
    const rowIndex = Math.max(group.desiredRow, ...group.slots.map((s)=>findRoundNextFreeRow(occupied, s.instrumentId, group.desiredRow)));
    for (const slot of group.slots) { if (!tableCells.has(rowIndex)) tableCells.set(rowIndex, new Map()); tableCells.get(rowIndex).set(slot.instrumentId, makeRoundSlotCell(jamState, slot)); occupyRoundSlot(occupied, slot.instrumentId, rowIndex); }
  }
  const maxRowIndex = Math.max(-1, ...tableCells.keys());
  const rows = Array.from({ length: maxRowIndex + 1 }, (_, rowIndex) => ({ rowIndex, cells: Object.fromEntries(columns.map((c)=>[c.instrumentId, tableCells.get(rowIndex)?.get(c.instrumentId) ?? makeRoundEmptyCell(c.instrumentId)])) }));
  for (const column of columns) { const nextRow = rows.find((row)=>["entry","hole"].includes(row.cells[column.instrumentId].type) && row.cells[column.instrumentId].status === "planned" && !row.cells[column.instrumentId].isParticipantLeft); if (nextRow) nextRow.cells[column.instrumentId].isNextPlayable = true; }
  return { columns, rows, stats: buildRoundStats(jamState) };
}

export function projectJamTable(jamState, options = {}) {
  if (Array.isArray(jamState.roundSlots) && jamState.roundSlots.length > 0) {
    return projectFromRoundSlots(jamState, options);
  }
  return projectLegacyJamTable(jamState);
}
