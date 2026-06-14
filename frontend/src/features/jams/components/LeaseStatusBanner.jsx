import { Alert, Button } from '@mui/material';

export function LeaseStatusBanner({ clientSession, onTakeover }) {
  if (clientSession.status === 'acquiring') return <Alert severity="info" sx={{ mb: 2 }}>Prise de contrôle de la jam en cours…</Alert>;
  if (!clientSession.readOnly) return null;
  return <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={onTakeover}>Reprendre le contrôle</Button>}>Lecture seule : un autre appareil contrôle peut-être cette jam.</Alert>;
}
