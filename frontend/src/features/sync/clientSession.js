import { useEffect, useRef, useState } from 'react';
import { jamsApi } from '../../shared/api/jamsApi.js';
import { db, mergeSyncState, SYNC_STATUS } from './localDb.js';
import { createClientId } from './transactionFactory.js';

function intervalMsFor(record) {
  return Math.max(5, record?.heartbeatIntervalSeconds ?? 10) * 1000;
}

export function useJamClientSession(jamId) {
  const [sessionState, setSessionState] = useState({ status: 'acquiring', readOnly: true, clientId: createClientId() });
  const heartbeatTimerRef = useRef(null);
  const disposedRef = useRef(false);

  useEffect(() => {
    if (!jamId) return undefined;
    disposedRef.current = false;
    const clientId = createClientId();

    function clearHeartbeat() {
      if (heartbeatTimerRef.current) window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }

    async function persistSession(payload, status) {
      const record = { jamId, clientId, leaseToken: payload.leaseToken, leaseExpiresAt: payload.leaseExpiresAt, heartbeatIntervalSeconds: payload.heartbeatIntervalSeconds ?? 10, status, updatedAt: new Date().toISOString() };
      await db.clientSessions.put(record);
      await mergeSyncState(jamId, { status: status === 'readonly' ? SYNC_STATUS.WARNING : SYNC_STATUS.SYNCED, updatedAt: record.updatedAt });
      return record;
    }

    async function heartbeat() {
      const record = await db.clientSessions.get(jamId);
      if (!record?.leaseToken || record.clientId !== clientId || record.status !== 'active') return;
      try {
        const payload = await jamsApi.heartbeatLease(jamId, { clientId, leaseToken: record.leaseToken });
        if (disposedRef.current) return;
        const nextRecord = await persistSession(payload, 'active');
        setSessionState({ ...nextRecord, readOnly: false });
      } catch (error) {
        if (!disposedRef.current) setSessionState((current) => ({ ...current, status: 'warning', readOnly: true, error }));
      }
    }

    function scheduleHeartbeat(record) {
      clearHeartbeat();
      heartbeatTimerRef.current = window.setInterval(() => { void heartbeat(); }, intervalMsFor(record));
    }

    async function acquire() {
      try {
        const payload = await jamsApi.acquireLease(jamId, { clientId });
        if (disposedRef.current) return;
        const record = await persistSession(payload, 'active');
        setSessionState({ ...record, readOnly: false });
        scheduleHeartbeat(record);
      } catch (error) {
        if (disposedRef.current) return;
        clearHeartbeat();
        await db.clientSessions.put({ jamId, clientId, status: 'readonly', updatedAt: new Date().toISOString() });
        await mergeSyncState(jamId, { status: SYNC_STATUS.WARNING, updatedAt: new Date().toISOString() });
        setSessionState({ status: 'readonly', readOnly: true, clientId, error });
      }
    }

    void acquire();
    return () => {
      disposedRef.current = true;
      clearHeartbeat();
      void (async () => {
        const record = await db.clientSessions.get(jamId);
        if (record?.leaseToken && record.clientId === clientId && record.status === 'active') {
          try { await jamsApi.releaseLease(jamId, { clientId, leaseToken: record.leaseToken }); } catch { /* best-effort release */ }
        }
      })();
    };
  }, [jamId]);

  async function takeover() {
    const clientId = createClientId();
    const payload = await jamsApi.takeoverLease(jamId, { clientId, confirm: true });
    const record = { jamId, clientId, leaseToken: payload.leaseToken, leaseExpiresAt: payload.leaseExpiresAt, heartbeatIntervalSeconds: payload.heartbeatIntervalSeconds ?? 10, status: 'active', updatedAt: new Date().toISOString() };
    await db.clientSessions.put(record);
    await mergeSyncState(jamId, { status: SYNC_STATUS.SYNCED, updatedAt: record.updatedAt });
    setSessionState({ ...record, readOnly: false });
    if (heartbeatTimerRef.current) window.clearInterval(heartbeatTimerRef.current);
    heartbeatTimerRef.current = window.setInterval(async () => {
      const current = await db.clientSessions.get(jamId);
      if (!current?.leaseToken || current.status !== 'active') return;
      try {
        const renewed = await jamsApi.heartbeatLease(jamId, { clientId, leaseToken: current.leaseToken });
        const nextRecord = { ...current, leaseExpiresAt: renewed.leaseExpiresAt, heartbeatIntervalSeconds: renewed.heartbeatIntervalSeconds ?? current.heartbeatIntervalSeconds, updatedAt: new Date().toISOString() };
        await db.clientSessions.put(nextRecord);
        setSessionState({ ...nextRecord, readOnly: false });
      } catch (error) {
        setSessionState((currentState) => ({ ...currentState, status: 'warning', readOnly: true, error }));
      }
    }, intervalMsFor(record));
    return record;
  }

  return { ...sessionState, takeover };
}
