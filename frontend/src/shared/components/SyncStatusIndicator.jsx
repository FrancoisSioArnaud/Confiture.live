import { Chip } from '@mui/material';

const LABELS = {
  synced: 'Synchronisé',
  local_only: 'Sauvegardé sur cet appareil',
  pending: 'Synchronisation en attente',
  syncing: 'Synchronisation en cours',
  retrying: 'Connexion instable, sauvegarde locale active',
  offline: 'Connexion instable, sauvegarde locale active',
  error: 'Sauvegarde locale active',
};

const COLORS = {
  synced: 'success',
  local_only: 'default',
  pending: 'warning',
  syncing: 'info',
  retrying: 'warning',
  offline: 'warning',
  error: 'warning',
};

export function SyncStatusIndicator({ status = 'local_only' }) {
  const label = LABELS[status] ?? LABELS.local_only;
  return <Chip size="small" color={COLORS[status] ?? 'default'} label={label} aria-label={`État de synchronisation : ${label}`} variant="outlined" sx={{ maxWidth: { xs: 132, sm: 260 }, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }} />;
}
