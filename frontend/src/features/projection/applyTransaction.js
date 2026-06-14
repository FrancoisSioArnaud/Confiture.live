import { applyEvent } from './applyEvent.js';
import { applyTransactionRevert } from './undo.js';

export function transactionIdOf(record) {
  return record?.transactionId ?? record?.transaction_id ?? record?.id;
}

export function applyTransaction(state, transaction) {
  const transactionId = transactionIdOf(transaction);
  const events = [...(transaction.events ?? [])].sort((a, b) => (a.serverSequenceNumber ?? a.server_sequence_number ?? 0) - (b.serverSequenceNumber ?? b.server_sequence_number ?? 0));

  for (const event of events) {
    if (event.type === 'transaction_reverted') {
      applyEvent(state, event);
      continue;
    }
    applyEvent(state, event);
  }

  if (transactionId && !transaction.isReverted && !transaction.is_reverted && events.every((event) => event.type !== 'transaction_reverted')) {
    state.activeTransactionIds.push(transactionId);
  }

  return state;
}

export function shouldApplyTransaction(state, transaction) {
  const transactionId = transactionIdOf(transaction);
  return !transactionId || !state.revertedTransactionIds.includes(transactionId);
}

export function applyRevertEvent(state, event) {
  return applyTransactionRevert(state, event);
}
