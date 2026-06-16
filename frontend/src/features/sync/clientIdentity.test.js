import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getOrCreateClientId } from './clientIdentity';

vi.mock('../../shared/utils/createId', () => ({ createId: (prefix) => `${prefix}_stable` }));

describe('client identity', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists the organizer client id in localStorage', () => {
    const first = getOrCreateClientId();
    const second = getOrCreateClientId();

    expect(first).toBe('client_stable');
    expect(second).toBe(first);
    expect(window.localStorage.getItem('confiture_live_client_id')).toBe(first);
  });
});
