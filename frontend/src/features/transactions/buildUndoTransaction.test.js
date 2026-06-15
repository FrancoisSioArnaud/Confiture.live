import { describe, expect, it } from 'vitest';
import { buildLinearUndoTransaction, getLatestUndoableTransaction } from './buildUndoTransaction';

function transaction(transactionId, clientSequenceNumber, events = [{ type: 'jam_updated', payload: { name: `Jam ${clientSequenceNumber}` } }]) {
  return { transactionId, jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber, events };
}

describe('buildUndoTransaction', () => {
  it('targets the latest active non-undo transaction', () => {
    const transactions = [transaction('tx_1', 1), transaction('tx_2', 2)];
    expect(getLatestUndoableTransaction(transactions).transactionId).toBe('tx_2');
  });

  it('skips a transaction already reverted by a linear undo', () => {
    const transactions = [
      transaction('tx_1', 1),
      transaction('tx_2', 2),
      transaction('undo_1', 3, [{ type: 'transaction_reverted', payload: { targetTransactionId: 'tx_2', targetClientSequenceNumber: 2, reason: 'organizer_undo' } }]),
    ];
    expect(getLatestUndoableTransaction(transactions).transactionId).toBe('tx_1');
  });

  it('builds transaction_reverted without deleting events', () => {
    const undo = buildLinearUndoTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 3, transactions: [transaction('tx_1', 1), transaction('tx_2', 2)] });
    expect(undo.events).toHaveLength(1);
    expect(undo.events[0].type).toBe('transaction_reverted');
    expect(undo.events[0].payload.targetTransactionId).toBe('tx_2');
  });
});
