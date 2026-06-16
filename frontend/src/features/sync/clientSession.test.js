import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getClientSession, resetLocalDbForTests, saveClientSession } from './localDb';
import { startHeartbeat, stopHeartbeat } from './clientSession';

describe('client session heartbeat', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await resetLocalDbForTests();
  });

  it('clears the local session and notifies when heartbeat fails', async () => {
    const error = new Error('No active client session for this jam.');
    const api = { heartbeatClientSession: vi.fn().mockRejectedValue(error) };
    const onLeaseLost = vi.fn();
    await saveClientSession('jam_sync', { clientId: 'client_1', leaseToken: 'lease_1' });

    startHeartbeat({ jamId: 'jam_sync', intervalMs: 1000, api, onLeaseLost });
    await vi.advanceTimersByTimeAsync(1000);

    expect(api.heartbeatClientSession).toHaveBeenCalledWith('jam_sync', { clientId: 'client_1', leaseToken: 'lease_1' });
    expect(await getClientSession('jam_sync')).toBeUndefined();
    expect(onLeaseLost).toHaveBeenCalledWith(error);
    stopHeartbeat('jam_sync');
    vi.useRealTimers();
  });
});
