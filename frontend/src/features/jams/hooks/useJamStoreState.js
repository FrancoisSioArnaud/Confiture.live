import { useStore } from 'zustand';
import { jamStore } from '../../jam/jamStore';

export function useJamStoreState(selector) {
  return useStore(jamStore, selector);
}
