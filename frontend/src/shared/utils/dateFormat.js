import { format } from 'date-fns';
export function formatDate(value) { return value ? format(new Date(value), 'yyyy-MM-dd') : ''; }
