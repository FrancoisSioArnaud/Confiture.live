import { applyTransaction } from './applyTransaction';
import { createInitialProjectionState } from './initialState';
import { buildActiveTransactions } from './undo';
import { materializeCalculatedAppearances } from './rounds';
import { buildCallDrawerSelectors, buildColumns, buildCountersByInstrument } from './selectors';
import { buildTransactionContext } from './resolver/buildTransactionContext';
import { resolveOrderAfterTransactionV2 } from './resolver/resolveOrderAfterTransactionV2';

export function projectJamState({ snapshot = null, transactions = [], events = [] } = {}) {
  const state = createInitialProjectionState(snapshot);
  const orderedTransactions = transactions.length > 0 ? normalizeTransactions(transactions) : groupEventsAsTransactions(events);
  const { activeTransactions, warnings } = buildActiveTransactions(orderedTransactions);
  warnings.forEach((warning) => {
    state.projectionWarnings.push(warning);
    state.debugWarnings.push(warning);
  });

  let previousLayout = { byCardId: { ...(state.layoutByCardId ?? {}) } };
  let lastResolverOutput = {
    layoutByCardId: previousLayout.byCardId,
    orderedCardIdsByColumnId: state.orderedCardIdsByColumnId ?? {},
    visibleResolvedRows: state.visibleResolvedRows ?? [],
    projectionWarnings: [],
    debug: {},
  };

  activeTransactions.forEach((transaction) => {
    applyTransaction(state, transaction);
    materializeCalculatedAppearances(state);
    state.layoutByCardId = previousLayout.byCardId;
    const transactionContext = buildTransactionContext(state, transaction);
    const resolverInput = buildResolverInput(state, previousLayout, transactionContext);
    lastResolverOutput = resolveOrderAfterTransactionV2(resolverInput);
    applyResolverLayoutToState(state, lastResolverOutput);
    previousLayout = { byCardId: lastResolverOutput.layoutByCardId };
  });

  materializeCalculatedAppearances(state);
  state.columns = buildColumns(state, lastResolverOutput.layoutByCardId, lastResolverOutput.visibleResolvedRows);
  state.countersByInstrument = buildCountersByInstrument(state);
  state.callDrawer = buildCallDrawerSelectors(state);
  return state;
}

function normalizeTransactions(transactions) {
  return [...transactions].sort((a, b) => {
    const server = (a.serverSequenceNumberStart ?? Number.MAX_SAFE_INTEGER) - (b.serverSequenceNumberStart ?? Number.MAX_SAFE_INTEGER);
    if (server !== 0) return server;
    return (a.clientSequenceNumber ?? 0) - (b.clientSequenceNumber ?? 0);
  });
}

function groupEventsAsTransactions(events) {
  const byTransaction = new Map();
  [...events].sort(compareEvents).forEach((event) => {
    const transactionId = event.transactionId ?? `transaction_${event.eventId}`;
    if (!byTransaction.has(transactionId)) {
      byTransaction.set(transactionId, {
        transactionId,
        clientSequenceNumber: event.clientSequenceNumber,
        serverSequenceNumberStart: event.serverSequenceNumber,
        events: [],
      });
    }
    byTransaction.get(transactionId).events.push(event);
  });
  return [...byTransaction.values()];
}

function compareEvents(a, b) {
  const server = (a.serverSequenceNumber ?? Number.MAX_SAFE_INTEGER) - (b.serverSequenceNumber ?? Number.MAX_SAFE_INTEGER);
  if (server !== 0) return server;
  const client = (a.clientSequenceNumber ?? 0) - (b.clientSequenceNumber ?? 0);
  if (client !== 0) return client;
  return String(a.eventId ?? '').localeCompare(String(b.eventId ?? ''));
}

function cardIdForEntity(entity) {
  return entity?.cardId ?? entity?.appearanceId ?? entity?.holeId ?? entity?.id ?? null;
}

function targetToCardId(target) {
  if (!target) return null;
  if (typeof target === 'string') return target;
  return target.cardId ?? target.id ?? target.appearanceId ?? target.holeId ?? null;
}

function entityBaseOrder(entity) {
  return entity.orderScore ?? entity.roundOrder ?? entity.positionInRound ?? entity.appearanceIndex ?? 1;
}

function buildResolverCards(state, previousLayout) {
  const entities = [...Object.values(state.appearances), ...Object.values(state.holes)]
    .map((entity) => {
      const cardId = cardIdForEntity(entity);
      const columnId = entity.instrumentId ?? entity.columnId;
      if (!cardId || !columnId) return null;
      return { entity, cardId, columnId, rawOrder: entityBaseOrder(entity) };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const column = String(a.columnId).localeCompare(String(b.columnId));
      if (column !== 0) return column;
      const order = a.rawOrder - b.rawOrder;
      if (order !== 0) return order;
      return String(a.cardId).localeCompare(String(b.cardId));
    });
  const baseRowByCardId = new Map();
  const indexByColumn = new Map();
  entities.forEach(({ cardId, columnId }) => {
    const nextIndex = (indexByColumn.get(columnId) ?? 0) + 1;
    indexByColumn.set(columnId, nextIndex);
    baseRowByCardId.set(cardId, nextIndex);
  });

  return entities.map(({ entity, cardId, columnId, rawOrder }) => {
    const previous = previousLayout?.byCardId?.[cardId];
    return {
      cardId,
      type: entity.type === 'hole' ? 'hole' : 'appearance',
      columnId,
      participantId: entity.participantId ?? null,
      participationId: entity.participationId ?? null,
      appearanceId: entity.type === 'hole' ? null : (entity.appearanceId ?? entity.id ?? null),
      holeId: entity.type === 'hole' ? (entity.holeId ?? entity.id ?? null) : null,
      appearanceIndex: entity.appearanceIndex ?? null,
      createdAtOrder: rawOrder,
      baseOrder: baseRowByCardId.get(cardId) ?? 1,
      previousResolvedRow: previous?.resolvedRow ?? entity.resolvedRow ?? null,
      resolvedRow: entity.resolvedRow ?? null,
      visualIndex: entity.visualIndex ?? null,
      cardIndexInColumn: entity.cardIndexInColumn ?? null,
      played: entity.played === true,
      locked: entity.locked === true,
      deleted: entity.status === 'removed',
      hidden: state.instruments[columnId]?.visible === false,
      sourceEventId: entity.createdAtEventId ?? null,
      sourceTransactionId: entity.createdAtTransactionId ?? null,
    };
  });
}

function buildResolverLinks(state) {
  return Object.values(state.links)
    .map((link) => ({
      linkId: link.linkId ?? link.id,
      targetCardIds: (link.targetCardIds ?? link.targets ?? []).map(targetToCardId).filter(Boolean),
      active: link.status === 'active',
      reorderStrategy: link.reorderStrategy ?? state.jam?.linkReorderStrategy ?? 'move_to_first',
      createdAtOrder: link.createdAtOrder ?? 0,
      transactionId: link.transactionId ?? '',
      eventId: link.eventId ?? '',
    }))
    .sort((a, b) => String(a.linkId).localeCompare(String(b.linkId)));
}

function buildResolverConflicts(state) {
  return Object.values(state.conflicts)
    .map((conflict) => ({
      conflictId: conflict.conflictId ?? conflict.id,
      scope: conflict.scope ?? 'appearance',
      targetCardIds: conflict.scope === 'participation' ? undefined : [...(conflict.targetCardIds ?? conflict.targetIds ?? [])],
      targetParticipationIds: conflict.scope === 'participation' ? [...(conflict.targetParticipationIds ?? conflict.targetIds ?? [])] : undefined,
      reason: conflict.reason ?? 'manual',
      active: conflict.status === 'active',
      createdAtOrder: conflict.createdAtOrder ?? 0,
      transactionId: conflict.transactionId ?? '',
      eventId: conflict.eventId ?? '',
    }))
    .sort((a, b) => String(a.conflictId).localeCompare(String(b.conflictId)));
}

function buildResolverInput(state, previousLayout, transactionContext) {
  const hiddenColumnIds = Object.values(state.instruments)
    .filter((instrument) => instrument.visible === false)
    .map((instrument) => instrument.instrumentId ?? instrument.id)
    .filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b)));
  return {
    cards: buildResolverCards(state, previousLayout),
    links: buildResolverLinks(state),
    conflicts: buildResolverConflicts(state),
    hiddenColumnIds,
    previousLayout,
    transactionContext,
    config: { defaultLinkReorderStrategy: state.jam?.linkReorderStrategy ?? 'move_to_first' },
  };
}

function applyResolverLayoutToState(state, resolverOutput) {
  state.layoutByCardId = resolverOutput.layoutByCardId;
  state.orderedCardIdsByColumnId = resolverOutput.orderedCardIdsByColumnId;
  state.visibleResolvedRows = resolverOutput.visibleResolvedRows;
  state.resolverDebug = resolverOutput.debug;
  state.projectionWarnings.push(...resolverOutput.projectionWarnings);
  state.debugWarnings.push(...resolverOutput.projectionWarnings);
  Object.entries(resolverOutput.layoutByCardId).forEach(([cardId, layout]) => {
    const entity = state.appearances[cardId] ?? state.holes[cardId];
    if (!entity) return;
    entity.resolvedRow = layout.resolvedRow;
    entity.visualIndex = layout.visualIndex;
    entity.cardIndexInColumn = layout.cardIndexInColumn;
  });
}
