import * as jamsApi from '../../shared/api/jamsApi';
import {
  getClientSession,
  saveClientSession,
  getPendingTransactions,
  getLocalTransactions,
  getSyncState,
  markTransactionFailed,
  markTransactionPending,
  markTransactionSynced,
  saveLocalTransaction,
  saveSnapshot,
  saveSyncState,
} from './localDb';
import { setSyncStatus, SYNC_STATUS } from './syncStatus';

const timers = new Map();

function isSequenceConflict(error) {
  const body = error?.payload?.body;
  return error?.status === 409 && (body?.error === 'sequence_conflict' || body?.reason === 'sequence_mismatch');
}

function latestServerSequenceFromError(error) {
  return error?.payload?.body?.latestServerSequenceNumber;
}

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function isLeaseError(error) {
  const body = error?.payload?.body ?? {};
  return (
    error?.status === 403 ||
    error?.status === 423 ||
    body?.error === 'jam_locked_by_other_client' ||
    String(error?.message ?? '').includes('lease') ||
    String(error?.message ?? '').includes('client session')
  );
}

export function isSessionExpired(session, skewMs = 5000) {
  if (!session?.leaseExpiresAt) return false;
  return new Date(session.leaseExpiresAt).getTime() <= Date.now() + skewMs;
}

async function getPushableSession({ jamId, transaction, api }) {
  let session = await getClientSession(jamId);
  if (session?.clientId && session?.clientId !== transaction.clientId) {
    return {
      ok: false,
      status: SYNC_STATUS.SESSION_REQUIRED,
      message: 'Session d’édition incohérente : rechargez la jam ou reprenez le contrôle avant de synchroniser.',
    };
  }

  if (!session?.clientId || !session?.leaseToken || isSessionExpired(session)) {
    try {
      session = await api.acquireClientSession(jamId, {
        clientId: transaction.clientId,
        deviceLabel: 'Navigateur',
        force: false,
      });
      await saveClientSession(jamId, session);
    } catch (error) {
      return {
        ok: false,
        error,
        status: isLeaseError(error) ? SYNC_STATUS.LEASE_LOST : SYNC_STATUS.SESSION_REQUIRED,
        message: isLeaseError(error)
          ? 'Session d’édition perdue. Reprenez le contrôle ou rechargez la jam avant de synchroniser.'
          : `Session d’édition indisponible : ${error?.message ?? 'erreur inconnue'}`,
      };
    }
  }

  if (!session?.clientId || !session?.leaseToken) {
    return { ok: false, status: SYNC_STATUS.SESSION_REQUIRED, message: 'Session d’édition requise avant de synchroniser.' };
  }
  if (session.clientId !== transaction.clientId) {
    return {
      ok: false,
      status: SYNC_STATUS.SESSION_REQUIRED,
      message: 'Session d’édition incohérente : rechargez la jam ou reprenez le contrôle avant de synchroniser.',
    };
  }
  return { ok: true, session };
}

export async function enqueueTransaction({ jamId, transaction }) {
  await saveLocalTransaction(jamId, transaction);
  await markTransactionPending(jamId, transaction.transactionId);
  const pendingCount = (await getPendingTransactions(jamId)).length;
  setSyncStatus(jamId, { status: SYNC_STATUS.PENDING, pendingCount, lastError: null });
  return transaction;
}

export function scheduleSync({ jamId, api = jamsApi, delayMs = 400 } = {}) {
  clearTimeout(timers.get(jamId));
  const timer = setTimeout(() => pushPendingTransactions({ jamId, api }), delayMs);
  timers.set(jamId, timer);
  return timer;
}

export async function pushPendingTransactions({ jamId, api = jamsApi, retryDelayMs = 1000 } = {}) {
  const pending = await getPendingTransactions(jamId);
  if (pending.length === 0) {
    setSyncStatus(jamId, { status: SYNC_STATUS.SYNCED, pendingCount: 0, lastSyncedAt: new Date().toISOString() });
    return { pushed: 0 };
  }
  if (isOffline()) {
    setSyncStatus(jamId, { status: SYNC_STATUS.OFFLINE, pendingCount: pending.length, lastError: null });
    return { pushed: 0, offline: true };
  }

  setSyncStatus(jamId, { status: SYNC_STATUS.SYNCING, pendingCount: pending.length, lastError: null });
  let syncState = await getSyncState(jamId);
  let pushed = 0;

  for (const item of pending) {
    const transaction = await getTransactionRecord(jamId, item.transactionId);
    if (!transaction) continue;
    try {
      const sessionResult = await getPushableSession({ jamId, transaction, api });
      if (!sessionResult.ok) {
        setSyncStatus(jamId, { status: sessionResult.status, pendingCount: pending.length, lastError: sessionResult.message });
        return { pushed, error: sessionResult.error, sessionRequired: true };
      }
      const { session } = sessionResult;
      const ack = await api.pushTransaction(jamId, {
        clientId: session.clientId,
        leaseToken: session.leaseToken,
        baseServerSequenceNumber: syncState.lastServerSequenceNumber ?? 0,
        transaction,
      });
      await markTransactionSynced(jamId, transaction.transactionId, ack);
      syncState = { ...syncState, lastServerSequenceNumber: ack.latestServerSequenceNumber, status: SYNC_STATUS.SYNCED };
      await saveSyncState(jamId, syncState);
      pushed += 1;
    } catch (error) {
      if (isSequenceConflict(error)) {
        const latestServerSequenceNumber = latestServerSequenceFromError(error);
        await saveSyncState(jamId, {
          ...syncState,
          ...(Number.isInteger(latestServerSequenceNumber) ? { lastServerSequenceNumber: latestServerSequenceNumber } : {}),
          status: SYNC_STATUS.ERROR,
          error: 'sequence_conflict',
        });
        setSyncStatus(jamId, {
          status: SYNC_STATUS.ERROR,
          pendingCount: pending.length,
          lastError: 'Le serveur possède déjà des events inconnus du client. Rechargez la jam avant de synchroniser.',
        });
        return { pushed, error, sequenceConflict: true, latestServerSequenceNumber };
      }

      if (isLeaseError(error)) {
        setSyncStatus(jamId, {
          status: SYNC_STATUS.LEASE_LOST,
          pendingCount: pending.length,
          lastError: 'Session d’édition perdue. Reprenez le contrôle ou rechargez la jam avant de synchroniser.',
        });
        return { pushed, error, leaseLost: true };
      }

      await markTransactionFailed(jamId, transaction.transactionId, error, retryDelayMs);
      setSyncStatus(jamId, { status: SYNC_STATUS.RETRYING, pendingCount: pending.length, lastError: error.message });
      scheduleSync({ jamId, api, delayMs: retryDelayMs });
      return { pushed, error };
    }
  }

  const remaining = await getPendingTransactions(jamId);
  setSyncStatus(jamId, { status: remaining.length ? SYNC_STATUS.PENDING : SYNC_STATUS.SYNCED, pendingCount: remaining.length, lastSyncedAt: new Date().toISOString(), lastError: null });
  return { pushed };
}

export async function hydrateFromServer({ jamId, api = jamsApi, fromServerSequenceNumber = 0 } = {}) {
  const payload = await api.getTransactions(jamId, fromServerSequenceNumber);
  await Promise.all((payload.transactions ?? []).map((transaction) => saveLocalTransaction(jamId, transaction)));
  await saveSyncState(jamId, { lastServerSequenceNumber: payload.latestServerSequenceNumber ?? fromServerSequenceNumber, status: SYNC_STATUS.SYNCED });
  return payload;
}

export async function saveLocalAndRemoteSnapshot({ jamId, clientId, leaseToken, snapshot, api = jamsApi }) {
  await saveSnapshot(jamId, snapshot);
  return api.postSnapshot(jamId, { clientId, leaseToken, snapshot });
}

async function getTransactionRecord(jamId, transactionId) {
  return (await getLocalTransactions(jamId)).find((transaction) => transaction.transactionId === transactionId);
}
