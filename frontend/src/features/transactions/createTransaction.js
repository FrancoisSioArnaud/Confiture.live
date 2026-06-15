import { z } from 'zod';
import { assertAllowedEventType } from '../../shared/constants/eventTypes';
import { createId } from '../../shared/utils/createId';
import { SCHEMA_VERSION } from './eventFactories';

const transactionInputSchema = z.object({
  jamId: z.string().min(1),
  clientId: z.string().min(1),
  clientSequenceNumber: z.number().int().positive(),
  events: z.array(z.object({ type: z.string().min(1), payload: z.record(z.unknown()) }).strict()).min(1),
  label: z.string().min(1).optional(),
  source: z.string().min(1).default('organizer_ui'),
  transactionId: z.string().min(1).optional(),
  createdAt: z.string().min(1).optional(),
}).strict();

export function createTransaction(input) {
  const parsed = transactionInputSchema.parse(input);
  const transactionId = parsed.transactionId ?? createId('transaction');
  const createdAt = parsed.createdAt ?? new Date().toISOString();

  parsed.events.forEach((event) => assertAllowedEventType(event.type));

  return {
    transactionId,
    jamId: parsed.jamId,
    clientId: parsed.clientId,
    clientSequenceNumber: parsed.clientSequenceNumber,
    serverSequenceNumberStart: null,
    createdAt,
    schemaVersion: SCHEMA_VERSION,
    source: parsed.source,
    label: parsed.label ?? null,
    events: parsed.events.map((event, eventIndexInTransaction) => ({
      eventId: createId('event'),
      transactionId,
      jamId: parsed.jamId,
      type: event.type,
      payload: event.payload,
      createdAt,
      clientId: parsed.clientId,
      clientSequenceNumber: parsed.clientSequenceNumber,
      eventIndexInTransaction,
      serverSequenceNumber: null,
      schemaVersion: SCHEMA_VERSION,
    })),
  };
}
