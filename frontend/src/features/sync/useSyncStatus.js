import { useEffect, useState } from "react";

import { getSyncState } from "./localDb";
import { syncStatuses } from "./syncQueue";

export function syncStatusLabel(status) {
  if (status === syncStatuses.synced) return "Synchronisé";
  if (status === syncStatuses.offline) return "Hors ligne — sauvegarde locale";
  if (status === syncStatuses.error) return "Erreur de synchronisation";
  return "Synchronisation en attente";
}

export function useSyncStatus(jamId, { pollIntervalMs = 2000, enabled = true } = {}) {
  const [syncStatus, setSyncStatus] = useState(syncStatuses.synced);
  const [syncError, setSyncError] = useState(null);

  useEffect(() => {
    if (!jamId || !enabled) return undefined;

    let cancelled = false;

    async function refresh() {
      try {
        const state = await getSyncState(jamId);
        if (cancelled) return;
        setSyncStatus(state?.status ?? syncStatuses.synced);
        setSyncError(state?.error ?? null);
      } catch (error) {
        if (cancelled) return;
        setSyncStatus(syncStatuses.error);
        setSyncError(error.message);
      }
    }

    refresh();
    const intervalId = window.setInterval(refresh, pollIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [enabled, jamId, pollIntervalMs]);

  return {
    syncStatus,
    syncError,
    label: syncStatusLabel(syncStatus),
  };
}
