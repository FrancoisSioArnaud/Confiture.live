import { Alert, Button, Stack } from '@mui/material';

export function RecoveryWarning({ syncState, onRetrySync }) {
  const warning = syncState?.recoveryWarning || (syncState?.status === 'diverged' ? syncState?.syncMessage : null);
  if (!warning) return null;
  return <Alert severity={syncState?.status === 'diverged' ? 'error' : 'warning'} sx={{ mb: 2 }} action={<Stack direction="row" spacing={1}><Button color="inherit" size="small" onClick={onRetrySync}>Récupérer serveur / réessayer</Button></Stack>}>{warning}</Alert>;
}
