import { describe, expect, it } from 'vitest';
import { projectJamState } from '../projection/projectJamState';
import { DEMO_SEED_NAMES, buildDemoSeedTransactions } from './demoSeeds';

describe('demo seeds', () => {
  it.each(DEMO_SEED_NAMES)('projects %s without warnings', (seed) => {
    const transactions = buildDemoSeedTransactions(seed);
    const projection = projectJamState({ transactions });
    expect(projection.jam.jamId).toBe(`jam_demo_${seed}`);
    expect(projection.columns.length).toBeGreaterThan(0);
    expect(projection.projectionWarnings).toEqual([]);
  });

  it('contains representative complex demo states', () => {
    const projection = projectJamState({ transactions: buildDemoSeedTransactions('complex') });
    expect(Object.values(projection.holes).some((hole) => hole.reason === 'manual')).toBe(true);
    expect(Object.values(projection.links).some((link) => link.status === 'active')).toBe(true);
    expect(Object.values(projection.conflicts).some((conflict) => conflict.status === 'active')).toBe(true);
    expect(Object.values(projection.appearances).some((appearance) => appearance.played)).toBe(true);
  });
});
