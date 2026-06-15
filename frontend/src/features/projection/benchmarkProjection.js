import { performance } from 'node:perf_hooks';
import { buildDemoSeedTransactions } from '../demo/demoSeeds.js';
import { projectJamState } from './projectJamState.js';

export function benchmarkProjection({ seed = 'complex', iterations = 100 } = {}) {
  const transactions = buildDemoSeedTransactions(seed);
  const startedAt = performance.now();
  let projection = null;
  for (let index = 0; index < iterations; index += 1) {
    projection = projectJamState({ transactions });
  }
  const durationMs = performance.now() - startedAt;
  return { seed, iterations, durationMs, averageMs: durationMs / iterations, columns: projection?.columns?.length ?? 0 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = benchmarkProjection({ iterations: Number(process.env.PROJECTION_BENCHMARK_ITERATIONS ?? 100) });
  console.log(JSON.stringify(result, null, 2));
}
