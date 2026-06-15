import { del, get, patch, post } from './httpClient';

export const getHealth = () => get('/health/');
export const listJams = () => get('/jams/');
export const createJam = ({ clientId, transaction }) => post('/jams/', { clientId, transaction });
export const getJam = (jamId, params = {}) => {
  const search = new URLSearchParams(params);
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return get(`/jams/${jamId}/${suffix}`);
};
export const patchJam = (jamId, body) => patch(`/jams/${jamId}/`, body);
export const archiveJam = (jamId) => del(`/jams/${jamId}/`);
export const getTransactions = (jamId, fromServerSequenceNumber = 0) => get(`/jams/${jamId}/transactions/?fromServerSequenceNumber=${fromServerSequenceNumber}`);
export const pushTransaction = (jamId, { clientId, leaseToken, baseServerSequenceNumber, transaction }) => post(`/jams/${jamId}/transactions/`, { clientId, leaseToken, baseServerSequenceNumber, transaction });
export const getLatestSnapshot = (jamId) => get(`/jams/${jamId}/snapshot/latest/`);
export const postSnapshot = (jamId, { clientId, leaseToken, snapshot }) => post(`/jams/${jamId}/snapshots/`, { clientId, leaseToken, snapshot });
export const acquireClientSession = (jamId, body) => post(`/jams/${jamId}/client-session/acquire/`, body);
export const heartbeatClientSession = (jamId, body) => post(`/jams/${jamId}/client-session/heartbeat/`, body);
export const releaseClientSession = (jamId, body) => post(`/jams/${jamId}/client-session/release/`, body);
export const takeoverClientSession = (jamId, body) => post(`/jams/${jamId}/client-session/takeover/`, body);
