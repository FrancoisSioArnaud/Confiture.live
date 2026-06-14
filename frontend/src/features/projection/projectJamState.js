import { applyEvent } from './applyEvent.js';
import { buildColumns, buildPlateaus } from './rounds.js';

export function createEmptyState() { return { jam: null, instruments: {}, instrumentOrder: [], participants: {}, participations: {}, appearances: {}, holes: {}, links: {}, conflicts: {}, locks: {}, playedPlateaus: [], revertedTransactionIds: [], columns: {}, plateaus: [] }; }

export function projectJamState({ transactions = [], events = [], snapshot = null } = {}) {
  const reverted = new Set(events.filter((event) => event.type === 'transaction_reverted').map((event) => event.payload?.transactionId));
  const revertedFromTransactions = new Set(transactions.filter((tx) => tx.isReverted).map((tx) => tx.transactionId ?? tx.transaction_id));
  const state = structuredClone(snapshot?.state ?? createEmptyState());
  const ordered = [...events].sort((a, b) => (a.serverSequenceNumber ?? a.server_sequence_number ?? 0) - (b.serverSequenceNumber ?? b.server_sequence_number ?? 0));
  for (const event of ordered) {
    const txId = event.transactionId ?? event.transaction_id;
    if (event.type !== 'transaction_reverted' && (reverted.has(txId) || revertedFromTransactions.has(txId))) continue;
    applyEvent(state, event);
  }
  state.columns = buildColumns(state);
  state.plateaus = buildPlateaus(state.columns, state.instrumentOrder);
  return state;
}
