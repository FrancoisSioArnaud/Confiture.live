import { saveLocalJam, saveLocalTransaction, saveSyncState } from '../sync/localDb';
import { buildDemoSeedTransactions } from './demoSeeds';

export async function importDemoSeedLocally(seed = 'complex') {
  const transactions = buildDemoSeedTransactions(seed);
  const jamEvent = transactions[0]?.events?.find((event) => event.type === 'jam_created');
  if (!jamEvent) throw new Error(`Demo seed ${seed} does not contain jam_created.`);
  const jam = {
    jamId: jamEvent.payload.jamId,
    name: jamEvent.payload.name,
    indicativeDate: jamEvent.payload.indicativeDate,
    status: 'active',
    linkReorderStrategy: jamEvent.payload.linkReorderStrategy,
    latestServerSequenceNumber: transactions.flatMap((transaction) => transaction.events).length,
    metadata: { demoSeed: seed, localOnly: true },
  };
  await saveLocalJam(jam);
  await Promise.all(transactions.map((transaction) => saveLocalTransaction(jam.jamId, transaction)));
  await saveSyncState(jam.jamId, { status: 'local_only', lastServerSequenceNumber: 0 });
  return { jam, transactions };
}
