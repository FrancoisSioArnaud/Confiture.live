import { applyEvent } from './applyEvent';

export function applyTransaction(state, transaction) {
  const events = [...(transaction.events ?? [])].sort((a, b) => (a.eventIndexInTransaction ?? 0) - (b.eventIndexInTransaction ?? 0));
  events.forEach((event) => applyEvent(state, event));
  return state;
}
