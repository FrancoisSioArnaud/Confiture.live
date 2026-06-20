import { transactionRedone, transactionReverted } from './eventFactories';
import { createTransaction } from './createTransaction';
import { buildActiveTransactions } from '../projection/undo';

function isUndoRedoTransaction(transaction) {
  return transaction.events?.some((event) => event.type === 'transaction_reverted' || event.type === 'transaction_redone');
}

export function getLatestUndoableTransaction(transactions = []) {
  const { activeTransactions } = buildActiveTransactions([...transactions].sort((a, b) => (a.clientSequenceNumber ?? 0) - (b.clientSequenceNumber ?? 0)));
  return [...activeTransactions].reverse().find((transaction) => !isUndoRedoTransaction(transaction)) ?? null;
}

export function getLatestRedoableTransaction(transactions = []) {
  const { redoableTransactions } = buildActiveTransactions([...transactions].sort((a, b) => (a.clientSequenceNumber ?? 0) - (b.clientSequenceNumber ?? 0)));
  return redoableTransactions.at(-1) ?? null;
}

export function buildLinearUndoTransaction({ jamId, clientId, clientSequenceNumber, transactions }) {
  const target = getLatestUndoableTransaction(transactions);
  if (!target) return null;
  return createTransaction({
    jamId,
    clientId,
    clientSequenceNumber,
    label: 'Annuler action',
    events: [transactionReverted({
      targetTransactionId: target.transactionId,
      targetClientSequenceNumber: target.clientSequenceNumber,
      reason: 'organizer_undo',
    })],
  });
}

export function buildLinearRedoTransaction({ jamId, clientId, clientSequenceNumber, transactions }) {
  const target = getLatestRedoableTransaction(transactions);
  if (!target) return null;
  return createTransaction({
    jamId,
    clientId,
    clientSequenceNumber,
    label: 'Rétablir action',
    events: [transactionRedone({
      targetTransactionId: target.transactionId,
      targetClientSequenceNumber: target.clientSequenceNumber,
      reason: 'organizer_redo',
    })],
  });
}
