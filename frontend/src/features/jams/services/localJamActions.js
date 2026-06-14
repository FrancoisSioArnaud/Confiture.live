import { db, mergeSyncState, SYNC_STATUS } from '../../sync/localDb.js';
import { flushPendingTransactions } from '../../sync/syncQueue.js';
import { createClientId, createTransaction } from '../../sync/transactionFactory.js';
import { projectJamState } from '../../projection/projectJamState.js';
import { jamsApi } from '../../../shared/api/jamsApi.js';

const SNAPSHOT_INTERVAL = 20;


function transactionIdOf(record) {
  return record?.transactionId ?? record?.transaction_id;
}

function eventTransactionIdOf(record) {
  return record?.transactionId ?? record?.transaction_id ?? record?.payload?.transactionId;
}

function serverSequenceOf(record) {
  return record?.serverSequenceNumberStart ?? record?.server_sequence_number_start ?? record?.serverSequenceNumber ?? record?.server_sequence_number ?? 0;
}

function normalizeServerTransactions(serverLog) {
  const eventsByTransaction = new Map();
  for (const event of serverLog?.events ?? []) {
    const transactionId = eventTransactionIdOf(event);
    if (!transactionId) continue;
    const normalizedEvent = {
      ...event,
      transactionId,
      serverSequenceNumber: event.serverSequenceNumber ?? event.server_sequence_number ?? 0,
      schemaVersion: event.schemaVersion ?? event.schema_version ?? 1,
      createdAt: event.createdAt ?? event.created_at,
    };
    eventsByTransaction.set(transactionId, [...(eventsByTransaction.get(transactionId) ?? []), normalizedEvent]);
  }

  return (serverLog?.transactions ?? []).map((transaction) => {
    const transactionId = transactionIdOf(transaction);
    return {
      ...transaction,
      transactionId,
      jamId: transaction.jamId ?? transaction.jam_id,
      clientId: transaction.clientId ?? transaction.client_id,
      clientSequenceNumber: transaction.clientSequenceNumber ?? transaction.client_sequence_number ?? 0,
      schemaVersion: transaction.schemaVersion ?? transaction.schema_version ?? 1,
      serverSequenceNumberStart: transaction.serverSequenceNumberStart ?? transaction.server_sequence_number_start ?? 0,
      serverSequenceNumberEnd: transaction.serverSequenceNumberEnd ?? transaction.server_sequence_number_end ?? 0,
      createdAt: transaction.createdAt ?? transaction.created_at,
      events: (transaction.events?.length ? transaction.events : eventsByTransaction.get(transactionId) ?? []).sort((a, b) => serverSequenceOf(a) - serverSequenceOf(b)),
    };
  }).filter((transaction) => transaction.transactionId);
}

function snapshotStateFromRecord(record) {
  return record?.state ?? record?.projectedState ?? null;
}

export async function projectionForJam(jamId) {
  const transactions = (await db.localTransactions.where('jamId').equals(jamId).toArray()).sort((a, b) => serverSequenceOf(a) - serverSequenceOf(b) || (a.clientSequenceNumber ?? 0) - (b.clientSequenceNumber ?? 0));
  const snapshot = await db.snapshots.where('jamId').equals(jamId).last();
  return projectJamState({ snapshot: snapshotStateFromRecord(snapshot), transactions });
}

async function savePeriodicLocalSnapshot(jamId, projectedState, transactionCount) {
  if (!projectedState || transactionCount === 0 || transactionCount % SNAPSHOT_INTERVAL !== 0) return;
  await db.snapshots.put({
    snapshotId: `local_snapshot_${jamId}_${transactionCount}`,
    jamId,
    lastServerSequenceNumber: projectedState.latestServerSequenceNumber ?? 0,
    state: projectedState,
    createdAt: new Date().toISOString(),
    source: 'local',
  });
}

export async function persistLocalAction({ jamId, events, label, jamPatch = null }) {
  const clientId = createClientId();
  const existingTransactions = await db.localTransactions.where('jamId').equals(jamId).toArray();
  const clientSequenceNumber = existingTransactions.length + 1;
  const transaction = createTransaction({ jamId, clientId, clientSequenceNumber, events, label });
  await db.localTransactions.put({ ...transaction, syncStatus: SYNC_STATUS.PENDING });
  await db.pendingTransactions.put({ transactionId: transaction.transactionId, jamId, clientId, clientSequenceNumber, nextAttemptAt: new Date().toISOString(), attempts: 0 });
  const projection = await projectionForJam(jamId);
  const currentJam = await db.localJams.get(jamId);
  await db.localJams.put({ ...(currentJam ?? { jamId }), ...(jamPatch ?? {}), updatedAt: new Date().toISOString(), syncStatus: SYNC_STATUS.PENDING });
  await db.syncState.put({ jamId, status: SYNC_STATUS.PENDING, updatedAt: new Date().toISOString(), projectedState: projection });
  await savePeriodicLocalSnapshot(jamId, projection, clientSequenceNumber);
  void flushPendingTransactions();
  return projection;
}

export async function recoverJamProjection(jamId) {
  const localSnapshot = await db.snapshots.where('jamId').equals(jamId).last();
  let serverSnapshot = null;
  let serverTransactions = [];
  try {
    const latest = await jamsApi.latestSnapshot(jamId);
    serverSnapshot = latest?.snapshot ?? null;
    const fromSeq = Math.max(localSnapshot?.lastServerSequenceNumber ?? 0, serverSnapshot?.lastServerSequenceNumber ?? 0, serverSnapshot?.last_server_sequence_number ?? 0);
    const serverLog = await jamsApi.transactions(jamId, fromSeq);
    serverTransactions = normalizeServerTransactions(serverLog);
  } catch {
    await mergeSyncState(jamId, { status: SYNC_STATUS.OFFLINE, updatedAt: new Date().toISOString() });
  }

  for (const transaction of serverTransactions) {
    const existing = await db.localTransactions.get(transaction.transactionId);
    await db.localTransactions.put({ ...existing, ...transaction, jamId, syncStatus: SYNC_STATUS.SYNCED });
    await db.pendingTransactions.delete(transaction.transactionId);
  }

  const snapshot = snapshotStateFromRecord(serverSnapshot) ?? snapshotStateFromRecord(localSnapshot);
  const transactions = (await db.localTransactions.where('jamId').equals(jamId).toArray()).sort((a, b) => serverSequenceOf(a) - serverSequenceOf(b) || (a.clientSequenceNumber ?? 0) - (b.clientSequenceNumber ?? 0));
  const projectedState = projectJamState({ snapshot, transactions });
  const pendingCount = await db.pendingTransactions.where('jamId').equals(jamId).count();
  const recoveryWarning = serverTransactions.length > 0 && pendingCount > 0 ? 'Des changements serveur ont été récupérés pendant que des actions locales restent à synchroniser.' : null;
  await mergeSyncState(jamId, { status: pendingCount ? SYNC_STATUS.PENDING : SYNC_STATUS.SYNCED, updatedAt: new Date().toISOString(), projectedState, recoveryWarning, recoveredServerTransactionCount: serverTransactions.length, pendingLocalTransactionCount: pendingCount });
  void flushPendingTransactions();
  return { projectedState, serverTransactionCount: serverTransactions.length, pendingCount, recoveryWarning };
}
