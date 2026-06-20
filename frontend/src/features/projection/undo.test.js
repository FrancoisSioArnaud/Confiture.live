import { describe, expect, it } from 'vitest';
import { buildActiveTransactions } from './undo';

function tx(transactionId, clientSequenceNumber, events = [{ type: 'jam_updated', payload: { name: transactionId } }]) {
  return { transactionId, clientSequenceNumber, events };
}

function undo(transactionId, clientSequenceNumber, targetTransactionId, targetClientSequenceNumber) {
  return tx(transactionId, clientSequenceNumber, [{ type: 'transaction_reverted', payload: { targetTransactionId, targetClientSequenceNumber, reason: 'organizer_undo' } }]);
}

function redo(transactionId, clientSequenceNumber, targetTransactionId, targetClientSequenceNumber) {
  return tx(transactionId, clientSequenceNumber, [{ type: 'transaction_redone', payload: { targetTransactionId, targetClientSequenceNumber, reason: 'organizer_redo' } }]);
}

describe('buildActiveTransactions linear undo', () => {
  it('keeps undo events in history while removing only their latest active targets from projection', () => {
    const result = buildActiveTransactions([tx('tx_1', 1), tx('tx_2', 2), undo('undo_2', 3, 'tx_2', 2), undo('undo_1', 4, 'tx_1', 1)]);
    expect(result.activeTransactions).toEqual([]);
    expect([...result.revertedTransactionIds]).toEqual(['tx_2', 'tx_1']);
    expect(result.warnings).toEqual([]);
  });

  it('warns and ignores non-linear undo targets', () => {
    const result = buildActiveTransactions([tx('tx_1', 1), tx('tx_2', 2), undo('bad_undo', 3, 'tx_1', 1)]);
    expect(result.activeTransactions.map((transaction) => transaction.transactionId)).toEqual(['tx_1', 'tx_2']);
    expect(result.warnings.map((warning) => warning.code)).toContain('non_linear_undo_ignored');
  });

  it('reactivates the latest undone transaction with a linear redo event', () => {
    const result = buildActiveTransactions([tx('tx_1', 1), tx('tx_2', 2), undo('undo_2', 3, 'tx_2', 2), redo('redo_2', 4, 'tx_2', 2)]);
    expect(result.activeTransactions.map((transaction) => transaction.transactionId)).toEqual(['tx_1', 'tx_2']);
    expect([...result.revertedTransactionIds]).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('invalidates redo when a new action is recorded after an undo', () => {
    const result = buildActiveTransactions([tx('tx_1', 1), tx('tx_2', 2), undo('undo_2', 3, 'tx_2', 2), tx('tx_3', 4), redo('redo_2', 5, 'tx_2', 2)]);
    expect(result.activeTransactions.map((transaction) => transaction.transactionId)).toEqual(['tx_1', 'tx_3']);
    expect([...result.revertedTransactionIds]).toEqual(['tx_2']);
    expect(result.warnings.map((warning) => warning.code)).toContain('non_linear_redo_ignored');
  });

});
