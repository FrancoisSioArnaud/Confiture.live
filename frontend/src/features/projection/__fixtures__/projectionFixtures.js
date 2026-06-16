export function tx(sequence, events, transactionId = `transaction_${sequence}`) {
  return {
    transactionId,
    clientSequenceNumber: sequence,
    serverSequenceNumberStart: sequence * 10,
    events: events.map((event, eventIndexInTransaction) => ({
      eventId: `event_${sequence}_${eventIndexInTransaction}`,
      transactionId,
      clientSequenceNumber: sequence,
      serverSequenceNumber: sequence * 10 + eventIndexInTransaction,
      eventIndexInTransaction,
      schemaVersion: 1,
      ...event,
    })),
  };
}

export const createJam = tx(1, [{ type: 'jam_created', payload: { jamId: 'jam_demo', name: 'Jam demo', indicativeDate: '2026-01-15', linkReorderStrategy: 'move_to_first' } }], 'tx_create_jam');

export const defaultInstruments = [
  tx(2, [{ type: 'instrument_added', payload: { instrumentId: 'instrument_vocals', label: 'Chant', orderKey: 'a', visible: true, isDefault: true } }], 'tx_instrument_vocals'),
  tx(3, [{ type: 'instrument_added', payload: { instrumentId: 'instrument_guitar', label: 'Guitare', orderKey: 'b', visible: true, isDefault: true } }], 'tx_instrument_guitar'),
  tx(4, [{ type: 'instrument_added', payload: { instrumentId: 'instrument_drums', label: 'Batterie', orderKey: 'c', visible: true, isDefault: true } }], 'tx_instrument_drums'),
];

export function participantWithParticipation(sequence, { participantId, name, participationId, instrumentId, baseOrderKey, startAppearanceIndex = 1 }) {
  return tx(sequence, [
    { type: 'participant_created', payload: { participantId, name } },
    { type: 'participation_added', payload: {
      participationId,
      participantId,
      instrumentId,
      customInstrumentLabel: null,
      insertionMode: 'end_of_visible_rounds',
      startAppearanceIndex,
      afterTarget: null,
      beforeTarget: null,
      baseOrderKey,
    } },
  ], `tx_${participantId}_${instrumentId}`);
}

export function baseJamTransactions() {
  return [createJam, ...defaultInstruments];
}
