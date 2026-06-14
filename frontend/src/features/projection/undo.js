function transactionIdOf(record) {
  return record?.transactionId ?? record?.transaction_id ?? record?.id;
}

function sequenceOf(record) {
  return record?.serverSequenceNumber ?? record?.server_sequence_number ?? record?.serverSequenceNumberStart ?? record?.server_sequence_number_start ?? 0;
}

export function buildTransactionRecords({ transactions = [], events = [] } = {}) {
  const records = new Map();

  for (const tx of transactions) {
    const transactionId = transactionIdOf(tx);
    if (!transactionId) continue;
    records.set(transactionId, {
      transactionId,
      clientSequenceNumber: tx.clientSequenceNumber ?? tx.client_sequence_number,
      serverSequenceNumber: tx.serverSequenceNumber ?? tx.server_sequence_number ?? tx.serverSequenceNumberStart ?? tx.server_sequence_number_start ?? 0,
      events: [...(tx.events ?? [])],
      isReverted: Boolean(tx.isReverted ?? tx.is_reverted),
    });
  }

  for (const event of events) {
    const transactionId = transactionIdOf(event);
    if (!transactionId) continue;
    const record = records.get(transactionId) ?? { transactionId, serverSequenceNumber: sequenceOf(event), events: [], isReverted: false };
    record.serverSequenceNumber = Math.min(record.serverSequenceNumber || sequenceOf(event), sequenceOf(event));
    record.events.push(event);
    records.set(transactionId, record);
  }

  return [...records.values()].sort((a, b) => a.serverSequenceNumber - b.serverSequenceNumber);
}

export function targetTransactionIdFromRevert(event) {
  return event.payload?.targetTransactionId ?? event.payload?.transactionId;
}

export function canRevertTransaction(activeTransactionIds, targetTransactionId) {
  return activeTransactionIds.at(-1) === targetTransactionId;
}

export function applyTransactionRevert(state, event) {
  const targetTransactionId = targetTransactionIdFromRevert(event);
  if (!targetTransactionId) {
    state.projectionWarnings.push({ type: 'invalid_transaction_reverted', eventId: event.eventId, reason: 'missing_target_transaction_id' });
    return false;
  }
  if (!canRevertTransaction(state.activeTransactionIds, targetTransactionId)) {
    state.projectionWarnings.push({ type: 'non_linear_undo_ignored', eventId: event.eventId, targetTransactionId });
    return false;
  }
  state.revertedTransactionIds.push(targetTransactionId);
  state.activeTransactionIds = state.activeTransactionIds.filter((transactionId) => transactionId !== targetTransactionId);
  return true;
}
