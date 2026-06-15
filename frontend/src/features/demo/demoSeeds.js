const CLIENT_ID = 'client_demo_seed';
const CREATED_AT = '2026-01-01T18:00:00.000Z';

const DEFAULT_INSTRUMENTS = [
  ['instrument_vocals', 'Chant'],
  ['instrument_guitar', 'Guitare'],
  ['instrument_bass', 'Basse'],
  ['instrument_drums', 'Batterie'],
  ['instrument_piano', 'Piano'],
  ['instrument_other', 'Autre'],
];

function event(seed, txNumber, eventIndex, transactionId, jamId, type, payload) {
  return {
    eventId: `evt_demo_${seed}_${String(txNumber).padStart(3, '0')}_${eventIndex}`,
    transactionId,
    jamId,
    type,
    payload,
    createdAt: CREATED_AT,
    clientId: CLIENT_ID,
    clientSequenceNumber: txNumber,
    eventIndexInTransaction: eventIndex,
    serverSequenceNumber: txNumber,
    schemaVersion: 1,
  };
}

function tx(seed, txNumber, jamId, label, events) {
  const transactionId = `tx_demo_${seed}_${String(txNumber).padStart(3, '0')}`;
  return {
    transactionId,
    jamId,
    clientId: CLIENT_ID,
    clientSequenceNumber: txNumber,
    serverSequenceNumberStart: txNumber,
    serverSequenceNumberEnd: txNumber,
    createdAt: CREATED_AT,
    schemaVersion: 1,
    source: 'demo_seed',
    label,
    events: events.map(([type, payload], index) => event(seed, txNumber, index, transactionId, jamId, type, payload)),
  };
}

function instrumentEvents(instruments = DEFAULT_INSTRUMENTS.slice(0, 4)) {
  return instruments.map(([instrumentId, label], index) => ['instrument_added', { instrumentId, label, orderKey: `order_${index + 1}`, visible: true, isDefault: true }]);
}

function participantTx(seed, txNumber, jamId, name, instrumentId, order, customInstrumentLabel = null) {
  const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_');
  const participantId = `participant_${seed}_${slug}`;
  const participationId = `participation_${seed}_${slug}_${instrumentId.replace('instrument_', '')}`;
  return tx(seed, txNumber, jamId, `Ajouter ${name}`, [
    ['participant_created', { participantId, name }],
    ['participation_added', { participationId, participantId, instrumentId, customInstrumentLabel, insertionMode: 'end_of_visible_rounds', startAppearanceIndex: 1, afterTarget: null, beforeTarget: null, baseOrderKey: `order_${order}` }],
  ]);
}


function remapSeedTransactions(transactions, fromSeed, toSeed, jamId) {
  return JSON.parse(JSON.stringify(transactions).replaceAll(`_${fromSeed}_`, `_${toSeed}_`).replaceAll(`demo_${fromSeed}`, `demo_${toSeed}`).replaceAll(`jam_demo_${fromSeed}`, jamId));
}

function baseSeed(seed, name, date, instruments = DEFAULT_INSTRUMENTS.slice(0, 4)) {
  const jamId = `jam_demo_${seed}`;
  return [
    tx(seed, 1, jamId, 'Créer jam', [['jam_created', { jamId, name, indicativeDate: date, linkReorderStrategy: 'move_to_first' }]]),
    tx(seed, 2, jamId, 'Ajouter instruments', instrumentEvents(instruments)),
  ];
}

export function buildDemoSeedTransactions(seed) {
  const jamId = `jam_demo_${seed}`;
  if (seed === 'simple') {
    return [
      ...baseSeed(seed, 'Jam simple — 4 instruments', '2026-01-15'),
      participantTx(seed, 3, jamId, 'Sarah', 'instrument_vocals', 1),
      participantTx(seed, 4, jamId, 'Nicolas', 'instrument_guitar', 1),
      participantTx(seed, 5, jamId, 'Tom', 'instrument_bass', 1),
      participantTx(seed, 6, jamId, 'Jérémy', 'instrument_drums', 1),
      participantTx(seed, 7, jamId, 'Léa', 'instrument_vocals', 2),
      participantTx(seed, 8, jamId, 'Paul', 'instrument_guitar', 2),
      participantTx(seed, 9, jamId, 'Max', 'instrument_bass', 2),
      participantTx(seed, 10, jamId, 'Rayan', 'instrument_drums', 2),
    ];
  }
  if (seed === 'rounds') {
    return [
      ...baseSeed(seed, 'Jam rounds — reveal', '2026-01-16'),
      participantTx(seed, 3, jamId, 'Sarah', 'instrument_vocals', 1),
      participantTx(seed, 4, jamId, 'Nicolas', 'instrument_guitar', 1),
      participantTx(seed, 5, jamId, 'Tom', 'instrument_bass', 1),
      participantTx(seed, 6, jamId, 'Jérémy', 'instrument_drums', 1),
      tx(seed, 7, jamId, 'Afficher round 2', [
        ['instrument_round_visibility_changed', { instrumentId: 'instrument_vocals', visibleRoundCount: 2 }],
        ['instrument_round_visibility_changed', { instrumentId: 'instrument_guitar', visibleRoundCount: 2 }],
      ]),
      participantTx(seed, 8, jamId, 'Emma', 'instrument_vocals', 2),
    ];
  }
  if (seed === 'links') {
    const source = 'appearance_participation_links_sarah_vocals_1';
    const target = 'appearance_participation_links_nicolas_guitar_1';
    return [
      ...remapSeedTransactions(buildDemoSeedTransactions('simple'), 'simple', seed, jamId),
      tx(seed, 11, jamId, 'Link Sarah Nicolas', [['link_created', { linkId: 'link_demo_links_sarah_nicolas', targets: [{ type: 'appearance', id: source }, { type: 'appearance', id: target }], anchorTarget: { type: 'appearance', id: source }, reorderStrategy: 'move_to_first' }]]),
      tx(seed, 12, jamId, 'Conflict Léa Paul', [['conflict_created', { conflictId: 'conflict_demo_links_lea_paul', scope: 'appearance', targetIds: ['appearance_participation_links_lea_vocals_1', 'appearance_participation_links_paul_guitar_1'], reason: 'manual', anchorTargetId: 'appearance_participation_links_lea_vocals_1' }]]),
    ];
  }
  if (seed === 'multi') {
    return [
      ...baseSeed(seed, 'Jam multi-instruments', '2026-01-17', DEFAULT_INSTRUMENTS),
      participantTx(seed, 3, jamId, 'Nicolas', 'instrument_vocals', 1),
      tx(seed, 4, jamId, 'Nicolas guitare', [['participation_added', { participationId: 'participation_multi_nicolas_guitar', participantId: 'participant_multi_nicolas', instrumentId: 'instrument_guitar', customInstrumentLabel: null, insertionMode: 'end_of_visible_rounds', startAppearanceIndex: 1, afterTarget: null, beforeTarget: null, baseOrderKey: 'order_1' }]]),
      tx(seed, 5, jamId, 'Conflit instruments Nicolas', [['conflict_created', { conflictId: 'conflict_demo_multi_nicolas', scope: 'participation', targetIds: ['participation_multi_nicolas_vocals', 'participation_multi_nicolas_guitar'], reason: 'instrument_constraint', anchorTargetId: 'participation_multi_nicolas_vocals' }]]),
      participantTx(seed, 6, jamId, 'Hugo', 'instrument_other', 2, 'saxophone'),
    ];
  }
  if (seed === 'complex') {
    return [
      ...remapSeedTransactions(buildDemoSeedTransactions('links'), 'links', seed, jamId),
      tx(seed, 13, jamId, 'Trou Batterie', [['hole_added', { holeId: 'hole_demo_complex_drums_1', instrumentId: 'instrument_drums', appearanceIndex: 1, reason: 'manual', afterTarget: null, beforeTarget: { type: 'appearance', id: 'appearance_participation_complex_jeremy_drums_1' }, positionKey: 'position_hole_demo_complex_drums_1' }]]),
      tx(seed, 14, jamId, 'Verrouiller Sarah', [['appearance_locked', { appearanceId: 'appearance_participation_complex_sarah_vocals_1' }]]),
      tx(seed, 15, jamId, 'Plateau joué', [['plateau_played', { plateauIndex: 0, targets: [{ type: 'appearance', id: 'appearance_participation_complex_sarah_vocals_1' }, { type: 'appearance', id: 'appearance_participation_complex_nicolas_guitar_1' }, { type: 'appearance', id: 'appearance_participation_complex_tom_bass_1' }, { type: 'hole', id: 'hole_demo_complex_drums_1' }], playedAt: '2026-01-17T21:00:00.000Z' }]]),
      tx(seed, 16, jamId, 'Paul parti', [['participant_marked_left', { participantId: 'participant_complex_paul', confirmedDespiteFutureLockedAppearances: true }]]),
    ];
  }
  if (seed === 'sync') {
    return [
      ...baseSeed(seed, 'Jam sync/offline — démo', '2026-01-18'),
      participantTx(seed, 3, jamId, 'Alice', 'instrument_vocals', 1),
      participantTx(seed, 4, jamId, 'Jules', 'instrument_guitar', 1),
      tx(seed, 5, jamId, 'Update pending style', [['jam_updated', { name: 'Jam sync/offline — sauvegarde locale' }]]),
    ];
  }
  throw new Error(`Unknown demo seed: ${seed}`);
}

export const DEMO_SEED_NAMES = ['simple', 'rounds', 'links', 'multi', 'complex', 'sync'];

export function buildAllDemoSeeds() {
  return Object.fromEntries(DEMO_SEED_NAMES.map((seed) => [seed, buildDemoSeedTransactions(seed)]));
}

export function isDemoToolsEnabled() {
  return import.meta.env.VITE_ENABLE_DEMO_TOOLS === 'true';
}
