import * as jamsApi from '../../shared/api/jamsApi';
import { clearClientSession, getClientSession, saveClientSession } from './localDb';

const heartbeats = new Map();

export async function acquireLease({ jamId, clientId, deviceLabel, force = false, api = jamsApi }) {
  const session = await api.acquireClientSession(jamId, { clientId, deviceLabel, force });
  await saveClientSession(jamId, session);
  return session;
}

export async function heartbeatLease({ jamId, api = jamsApi }) {
  const session = await getClientSession(jamId);
  if (!session) return null;
  const renewed = await api.heartbeatClientSession(jamId, { clientId: session.clientId, leaseToken: session.leaseToken });
  const nextSession = { ...session, ...renewed };
  await saveClientSession(jamId, nextSession);
  return nextSession;
}

export function startHeartbeat({ jamId, intervalMs = 10_000, api = jamsApi }) {
  stopHeartbeat(jamId);
  const id = setInterval(() => heartbeatLease({ jamId, api }), intervalMs);
  heartbeats.set(jamId, id);
  return id;
}

export function stopHeartbeat(jamId) {
  const id = heartbeats.get(jamId);
  if (id) clearInterval(id);
  heartbeats.delete(jamId);
}

export async function releaseLease({ jamId, api = jamsApi }) {
  stopHeartbeat(jamId);
  const session = await getClientSession(jamId);
  if (!session) return null;
  const result = await api.releaseClientSession(jamId, { clientId: session.clientId, leaseToken: session.leaseToken });
  await clearClientSession(jamId);
  return result;
}

export async function takeoverLease({ jamId, clientId, previousClientId, deviceLabel, api = jamsApi }) {
  const session = await api.takeoverClientSession(jamId, { clientId, previousClientId, deviceLabel, confirm: true });
  await saveClientSession(jamId, session);
  return session;
}
