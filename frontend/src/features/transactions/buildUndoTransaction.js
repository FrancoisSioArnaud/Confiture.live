import { transactionReverted } from './eventFactories';
import { createTransaction } from './createTransaction';

function isUndoTransaction(transaction) {
  return transaction.events?.some((event) => event.type === 'transaction_reverted');
}

export function getLatestUndoableTransaction(transactions = []) {
  const active = [];
  const reverted = new Set();
  [...transactions]
    .sort((a, b) => (a.clientSequenceNumber ?? 0) - (b.clientSequenceNumber ?? 0))
    .forEach((transaction) => {
      const revertEvent = transaction.events?.find((event) => event.type === 'transaction_reverted');
      if (!revertEvent) {
        if (!reverted.has(transaction.transactionId)) active.push(transaction);
        return;
      }
      const targetTransactionId = revertEvent.payload.targetTransactionId;
      const index = active.findIndex((candidate) => candidate.transactionId === targetTransactionId);
      if (index === active.length - 1) {
        active.pop();
        reverted.add(targetTransactionId);
      }
    });
  return [...active].reverse().find((transaction) => !isUndoTransaction(transaction)) ?? null;
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
