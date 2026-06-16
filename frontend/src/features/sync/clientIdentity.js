import { createId } from '../../shared/utils/createId';

const CLIENT_ID_STORAGE_KEY = 'confiture_live_client_id';

let memoryClientId = null;

export function getOrCreateClientId() {
  if (typeof window === 'undefined' || !window.localStorage) {
    if (!memoryClientId) memoryClientId = createId('client');
    return memoryClientId;
  }

  const stored = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (stored) return stored;

  const clientId = createId('client');
  window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId);
  return clientId;
}
