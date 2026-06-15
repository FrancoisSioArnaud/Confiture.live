import { applyTransaction } from './applyTransaction';
import { createInitialProjectionState } from './initialState';
import { buildActiveTransactions } from './undo';
import { materializeCalculatedAppearances } from './rounds';
import { buildCallDrawerSelectors, buildColumns, buildCountersByInstrument } from './selectors';
import { reapplyActiveLinks } from './links';

export function projectJamState({ snapshot = null, transactions = [], events = [] } = {}) {
  const state = createInitialProjectionState(snapshot);
  const orderedTransactions = transactions.length > 0 ? normalizeTransactions(transactions) : groupEventsAsTransactions(events);
  const { activeTransactions, warnings } = buildActiveTransactions(orderedTransactions);
  warnings.forEach((warning) => {
    state.projectionWarnings.push(warning);
    state.debugWarnings.push(warning);
  });
  activeTransactions.forEach((transaction) => {
    applyTransaction(state, transaction);
    materializeCalculatedAppearances(state);
    reapplyActiveLinks(state);
  });
  materializeCalculatedAppearances(state);
  state.columns = buildColumns(state);
  state.countersByInstrument = buildCountersByInstrument(state);
  state.callDrawer = buildCallDrawerSelectors(state);
  return state;
}

function normalizeTransactions(transactions) {
  return [...transactions].sort((a, b) => {
    const server = (a.serverSequenceNumberStart ?? Number.MAX_SAFE_INTEGER) - (b.serverSequenceNumberStart ?? Number.MAX_SAFE_INTEGER);
    if (server !== 0) return server;
    return (a.clientSequenceNumber ?? 0) - (b.clientSequenceNumber ?? 0);
  });
}

function groupEventsAsTransactions(events) {
  const byTransaction = new Map();
  [...events].sort(compareEvents).forEach((event) => {
    const transactionId = event.transactionId ?? `transaction_${event.eventId}`;
    if (!byTransaction.has(transactionId)) {
      byTransaction.set(transactionId, {
        transactionId,
        clientSequenceNumber: event.clientSequenceNumber,
        serverSequenceNumberStart: event.serverSequenceNumber,
        events: [],
      });
    }
    byTransaction.get(transactionId).events.push(event);
  });
  return [...byTransaction.values()];
}

function compareEvents(a, b) {
  const server = (a.serverSequenceNumber ?? Number.MAX_SAFE_INTEGER) - (b.serverSequenceNumber ?? Number.MAX_SAFE_INTEGER);
  if (server !== 0) return server;
  const client = (a.clientSequenceNumber ?? 0) - (b.clientSequenceNumber ?? 0);
  if (client !== 0) return client;
  return String(a.eventId ?? '').localeCompare(String(b.eventId ?? ''));
}
