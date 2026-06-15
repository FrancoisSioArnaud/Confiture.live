import { useQuery } from '@tanstack/react-query';
import { db } from '../../sync/localDb.js';
import { hydrateBackendJamsToLocal } from '../services/localJamActions.js';

async function loadLocalJams() {
  try {
    await hydrateBackendJamsToLocal();
  } catch {
    // Local-first: the jam list remains usable from IndexedDB when the backend is unavailable.
  }
  return db.localJams.orderBy('updatedAt').reverse().toArray();
}

export function useLocalJams() {
  return useQuery({ queryKey: ['localJams'], queryFn: loadLocalJams });
}
