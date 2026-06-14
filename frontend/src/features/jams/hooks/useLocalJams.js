import { useQuery } from '@tanstack/react-query';
import { db } from '../../sync/localDb.js';

export function useLocalJams() {
  return useQuery({ queryKey: ['localJams'], queryFn: async () => db.localJams.orderBy('updatedAt').reverse().toArray() });
}
