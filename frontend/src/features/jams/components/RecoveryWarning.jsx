import { Alert, Button, Stack } from '@mui/material';

export function RecoveryWarning({ syncState, onRetrySync }) {
  const warning = syncState?.recoveryWarning;
  if (!warning) return null;
  return <Alert severity="warning" sx={{ mb: 2 }} action={<Stack direction="row" spacing={1}><Button color="inherit" size="small" onClick={onRetrySync}>Réessayer la sync</Button></Stack>}>{warning}</Alert>;
}
