import { applyEvent } from './applyEvent.js';
import { buildColumns, buildPlateaus } from './rounds.js';
import { applyLinkReordering } from './links.js';
import { buildTransactionRecords, targetTransactionIdFromRevert } from './undo.js';

export function createEmptyState() {
  return {
    jam: null,
    instruments: {},
    instrumentOrder: [],
    participants: {},
    participations: {},
    appearances: {},
    holes: {},
    links: {},
    conflicts: {},
    locks: {},
    playedPlateaus: [],
    playedTargets: {},
    revertedTransactionIds: [],
    activeTransactionIds: [],
    projectionWarnings: [],
    debugWarnings: [],
    columns: {},
    plateaus: [],
  };
}

function cloneState(snapshot) {
  return structuredClone(snapshot?.state ?? createEmptyState());
}

function normalizeStateShape(state) {
  const empty = createEmptyState();
  return { ...empty, ...state };
}

function precomputeLinearUndo(records, state) {
  const activeTransactionIds = [];
  const revertedTransactionIds = new Set();
  const warnings = [];

  for (const record of records) {
    const onlyReverts = record.events.every((event) => event.type === 'transaction_reverted');
    if (onlyReverts) {
      for (const event of record.events) {
        const targetTransactionId = targetTransactionIdFromRevert(event);
        if (!targetTransactionId) {
          warnings.push({ type: 'invalid_transaction_reverted', eventId: event.eventId, reason: 'missing_target_transaction_id' });
        } else if (activeTransactionIds.at(-1) !== targetTransactionId) {
          warnings.push({ type: 'non_linear_undo_ignored', eventId: event.eventId, targetTransactionId });
        } else {
          activeTransactionIds.pop();
          revertedTransactionIds.add(targetTransactionId);
        }
      }
    } else if (record.transactionId && !revertedTransactionIds.has(record.transactionId)) {
      activeTransactionIds.push(record.transactionId);
    }
  }

  state.projectionWarnings.push(...warnings);
  return revertedTransactionIds;
}

export function projectJamState({ transactions = [], events = [], snapshot = null } = {}) {
  const records = buildTransactionRecords({ transactions, events });
  const state = normalizeStateShape(cloneState(snapshot));
  const revertedFromUndo = precomputeLinearUndo(records, state);
  const revertedFromTransactions = new Set(transactions.filter((tx) => tx.isReverted ?? tx.is_reverted).map((tx) => tx.transactionId ?? tx.transaction_id));

  for (const record of records) {
    const isReverted = revertedFromUndo.has(record.transactionId) || revertedFromTransactions.has(record.transactionId);
    const onlyReverts = record.events.every((event) => event.type === 'transaction_reverted');

    if (isReverted && !onlyReverts) continue;

    for (const event of record.events) {
      applyEvent(state, event);
    }

    if (!isReverted && !onlyReverts && record.transactionId && !state.activeTransactionIds.includes(record.transactionId)) {
      state.activeTransactionIds.push(record.transactionId);
    }
  }

  applyLinkReordering(state);
  state.columns = buildColumns(state);
  state.plateaus = buildPlateaus(state.columns, state.instrumentOrder);
  return state;
}
