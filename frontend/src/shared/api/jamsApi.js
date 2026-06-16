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
export const pushTransaction = (jamId, { clientId, baseServerSequenceNumber, transaction }) => post(`/jams/${jamId}/transactions/`, { clientId, baseServerSequenceNumber, transaction });
export const getLatestSnapshot = (jamId) => get(`/jams/${jamId}/snapshot/latest/`);
export const postSnapshot = (jamId, { clientId, snapshot }) => post(`/jams/${jamId}/snapshots/`, { clientId, snapshot });
