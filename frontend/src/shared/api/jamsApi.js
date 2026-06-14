import { httpJson } from './httpClient.js';

export const jamsApi = {
  list: () => httpJson('/jams/'),
  create: (body) => httpJson('/jams/', { method: 'POST', body: JSON.stringify(body) }),
  get: (jamId) => httpJson(`/jams/${jamId}/`),
  update: (jamId, body) => httpJson(`/jams/${jamId}/`, { method: 'PATCH', body: JSON.stringify(body) }),
  transactions: (jamId, fromServerSequenceNumber = 0) => httpJson(`/jams/${jamId}/transactions/?fromServerSequenceNumber=${fromServerSequenceNumber}`),
  pushTransaction: (jamId, body) => httpJson(`/jams/${jamId}/transactions/`, { method: 'POST', body: JSON.stringify(body) }),
  latestSnapshot: (jamId) => httpJson(`/jams/${jamId}/snapshot/latest/`),
  createSnapshot: (jamId, body) => httpJson(`/jams/${jamId}/snapshots/`, { method: 'POST', body: JSON.stringify(body) }),
  acquireLease: (jamId, body) => httpJson(`/jams/${jamId}/client-session/acquire/`, { method: 'POST', body: JSON.stringify(body) }),
  heartbeatLease: (jamId, body) => httpJson(`/jams/${jamId}/client-session/heartbeat/`, { method: 'POST', body: JSON.stringify(body) }),
  releaseLease: (jamId, body) => httpJson(`/jams/${jamId}/client-session/release/`, { method: 'POST', body: JSON.stringify(body) }),
  takeoverLease: (jamId, body) => httpJson(`/jams/${jamId}/client-session/takeover/`, { method: 'POST', body: JSON.stringify(body) }),
};
