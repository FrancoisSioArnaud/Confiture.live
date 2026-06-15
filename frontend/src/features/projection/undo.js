export function buildActiveTransactions(transactions) {
  const active = [];
  const reverted = new Set();
  const warnings = [];

  transactions.forEach((transaction) => {
    const revertEvent = transaction.events?.find((event) => event.type === 'transaction_reverted');
    if (revertEvent) {
      const targetTransactionId = revertEvent.payload.targetTransactionId;
      const lastActive = active.at(-1);
      if (lastActive?.transactionId === targetTransactionId) {
        active.pop();
        reverted.add(targetTransactionId);
      } else {
        warnings.push({ code: 'non_linear_undo_ignored', message: 'transaction_reverted ignored because it does not target the latest active transaction.', details: { targetTransactionId } });
      }
    } else if (!reverted.has(transaction.transactionId)) {
      active.push(transaction);
    }
  });

  return { activeTransactions: active.filter((transaction) => !reverted.has(transaction.transactionId)), revertedTransactionIds: reverted, warnings };
}
