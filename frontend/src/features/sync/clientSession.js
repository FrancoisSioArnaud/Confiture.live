import { useCallback, useEffect, useRef, useState } from 'react';
import { jamsApi } from '../../shared/api/jamsApi.js';
import { db, mergeSyncState, SYNC_STATUS } from './localDb.js';
import { createClientId } from './transactionFactory.js';
import { describeSyncError } from './syncErrors.js';

function intervalMsFor(record) {
  return Math.max(5, record?.heartbeatIntervalSeconds ?? 10) * 1000;
}

function sessionRecord({ jamId, clientId, payload, status }) {
  return {
    jamId,
    clientId,
    leaseToken: payload?.leaseToken,
    leaseExpiresAt: payload?.leaseExpiresAt,
    heartbeatIntervalSeconds: payload?.heartbeatIntervalSeconds ?? 10,
    status,
    updatedAt: new Date().toISOString(),
  };
}

export function useJamClientSession(jamId) {
  const [sessionState, setSessionState] = useState({ status: 'acquiring', readOnly: true, clientId: createClientId() });
  const heartbeatTimerRef = useRef(null);
  const disposedRef = useRef(false);
  const activeClientIdRef = useRef(createClientId());

  const clearHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) window.clearInterval(heartbeatTimerRef.current);
    heartbeatTimerRef.current = null;
  }, []);

  const persistSession = useCallback(async (payload, status, clientId = activeClientIdRef.current) => {
    const record = sessionRecord({ jamId, clientId, payload, status });
    await db.clientSessions.put(record);
    await mergeSyncState(jamId, { status: status === 'readonly' ? SYNC_STATUS.WARNING : SYNC_STATUS.SYNCED, syncMessage: status === 'readonly' ? 'Reprise nécessaire : cette jam est ouverte ailleurs.' : 'Synchronisé', updatedAt: record.updatedAt });
    return record;
  }, [jamId]);

  const heartbeat = useCallback(async () => {
    const clientId = activeClientIdRef.current;
    const record = await db.clientSessions.get(jamId);
    if (!record?.leaseToken || record.clientId !== clientId || record.status !== 'active') return;
    try {
      const payload = await jamsApi.heartbeatLease(jamId, { clientId, leaseToken: record.leaseToken });
      if (disposedRef.current) return;
      const nextRecord = await persistSession(payload, 'active', clientId);
      setSessionState({ ...nextRecord, readOnly: false });
    } catch (error) {
      const message = describeSyncError(error);
      await mergeSyncState(jamId, { status: SYNC_STATUS.WARNING, syncMessage: message, updatedAt: new Date().toISOString() });
      if (!disposedRef.current) setSessionState((current) => ({ ...current, status: 'warning', readOnly: true, error, message }));
      clearHeartbeat();
    }
  }, [clearHeartbeat, jamId, persistSession]);

  const scheduleHeartbeat = useCallback((record) => {
    clearHeartbeat();
    heartbeatTimerRef.current = window.setInterval(() => { void heartbeat(); }, intervalMsFor(record));
  }, [clearHeartbeat, heartbeat]);

  useEffect(() => {
    if (!jamId) return undefined;
    disposedRef.current = false;
    const clientId = createClientId();
    activeClientIdRef.current = clientId;

    async function acquire() {
      setSessionState({ status: 'acquiring', readOnly: true, clientId });
      try {
        const payload = await jamsApi.acquireLease(jamId, { clientId });
        if (disposedRef.current) return;
        const record = await persistSession(payload, 'active', clientId);
        setSessionState({ ...record, readOnly: false, message: 'Contrôle actif.' });
        scheduleHeartbeat(record);
      } catch (error) {
        if (disposedRef.current) return;
        clearHeartbeat();
        const message = describeSyncError(error);
        await db.clientSessions.put({ jamId, clientId, status: 'readonly', updatedAt: new Date().toISOString(), lastError: message });
        await mergeSyncState(jamId, { status: SYNC_STATUS.WARNING, syncMessage: message, updatedAt: new Date().toISOString() });
        setSessionState({ status: 'readonly', readOnly: true, clientId, error, message });
      }
    }

    void acquire();
    return () => {
      disposedRef.current = true;
      clearHeartbeat();
      void (async () => {
        const record = await db.clientSessions.get(jamId);
        if (record?.leaseToken && record.clientId === clientId && record.status === 'active') {
          try {
            await jamsApi.releaseLease(jamId, { clientId, leaseToken: record.leaseToken });
            await db.clientSessions.update(jamId, { status: 'released', updatedAt: new Date().toISOString() });
          } catch {
            await db.clientSessions.update(jamId, { status: 'release_pending', updatedAt: new Date().toISOString() });
          }
        }
      })();
    };
  }, [clearHeartbeat, jamId, persistSession, scheduleHeartbeat]);

  async function takeover() {
    const clientId = createClientId();
    activeClientIdRef.current = clientId;
    setSessionState((current) => ({ ...current, status: 'taking_over', readOnly: true, message: 'Reprise du contrôle en cours…' }));
    try {
      const payload = await jamsApi.takeoverLease(jamId, { clientId, confirm: true });
      const record = await persistSession(payload, 'active', clientId);
      setSessionState({ ...record, readOnly: false, message: 'Contrôle repris.' });
      scheduleHeartbeat(record);
      return record;
    } catch (error) {
      const message = describeSyncError(error);
      await mergeSyncState(jamId, { status: SYNC_STATUS.WARNING, syncMessage: message, updatedAt: new Date().toISOString() });
      setSessionState((current) => ({ ...current, status: 'readonly', readOnly: true, error, message }));
      throw error;
    }
  }

  return { ...sessionState, takeover };
}
