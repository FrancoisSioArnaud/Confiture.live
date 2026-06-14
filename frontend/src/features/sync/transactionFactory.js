export const SCHEMA_VERSION = 1;

function randomId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function createClientId() {
  const existing = globalThis.localStorage?.getItem('confiture.clientId');
  if (existing) return existing;
  const clientId = randomId('client');
  globalThis.localStorage?.setItem('confiture.clientId', clientId);
  return clientId;
}

export function createTransaction({ jamId, clientId = createClientId(), clientSequenceNumber, events, label = null }) {
  const transactionId = randomId('transaction');
  const createdAt = new Date().toISOString();
  return {
    transactionId,
    jamId,
    clientId,
    clientSequenceNumber,
    schemaVersion: SCHEMA_VERSION,
    createdAt,
    label,
    events: events.map((event, index) => ({
      eventId: event.eventId ?? randomId('event'),
      transactionId,
      jamId,
      clientId,
      schemaVersion: SCHEMA_VERSION,
      createdAt,
      ...event,
      payload: { ...(event.payload ?? {}) },
      localSequenceNumber: index + 1,
    })),
  };
}
