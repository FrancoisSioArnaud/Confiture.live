import { describe, expect, it } from 'vitest';
import { getNextClientSequenceNumber } from './clientSequence';

describe('client sequence helpers', () => {
  it('computes the next clientSequenceNumber per client', () => {
    const transactions = [
      { clientId: 'client_1', clientSequenceNumber: 1 },
      { clientId: 'client_2', clientSequenceNumber: 1 },
      { clientId: 'client_1', clientSequenceNumber: 2 },
    ];

    expect(getNextClientSequenceNumber(transactions, 'client_2')).toBe(2);
  });
});
