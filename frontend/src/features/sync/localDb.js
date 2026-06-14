import Dexie from 'dexie';
export const db = new Dexie('confiture-live');
db.version(1).stores({ jams: 'jamId, updatedAt', transactions: 'transactionId, jamId, clientSequenceNumber, syncStatus', events: 'eventId, jamId, transactionId, serverSequenceNumber', snapshots: 'snapshotId, jamId, lastServerSequenceNumber' });
