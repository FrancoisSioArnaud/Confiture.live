export function buildActiveTransactions(transactions) {
  const active = [];
  const reverted = new Set();
  const redoStack = [];
  const warnings = [];

  transactions.forEach((transaction) => {
    const revertEvent = transaction.events?.find((event) => event.type === 'transaction_reverted');
    const redoEvent = transaction.events?.find((event) => event.type === 'transaction_redone');

    if (revertEvent) {
      const targetTransactionId = revertEvent.payload.targetTransactionId;
      const lastActive = active.at(-1);
      if (lastActive?.transactionId === targetTransactionId) {
        const [target] = active.splice(active.length - 1, 1);
        reverted.add(targetTransactionId);
        redoStack.push(target);
      } else {
        warnings.push({ code: 'non_linear_undo_ignored', message: 'transaction_reverted ignored because it does not target the latest active transaction.', details: { targetTransactionId } });
      }
      return;
    }

    if (redoEvent) {
      const targetTransactionId = redoEvent.payload.targetTransactionId;
      const lastRedoable = redoStack.at(-1);
      if (lastRedoable?.transactionId === targetTransactionId && reverted.has(targetTransactionId)) {
        redoStack.pop();
        reverted.delete(targetTransactionId);
        active.push(lastRedoable);
      } else {
        warnings.push({ code: 'non_linear_redo_ignored', message: 'transaction_redone ignored because it does not target the latest redoable transaction.', details: { targetTransactionId } });
      }
      return;
    }

    active.push(transaction);
    if (redoStack.length > 0) redoStack.length = 0;
  });

  return { activeTransactions: active.filter((transaction) => !reverted.has(transaction.transactionId)), revertedTransactionIds: reverted, redoableTransactions: redoStack, warnings };
}
