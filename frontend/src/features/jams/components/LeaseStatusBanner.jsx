import { Alert, Button } from '@mui/material';

export function LeaseStatusBanner({ clientSession, onTakeover }) {
  if (clientSession.status === 'acquiring') return <Alert severity="info" sx={{ mb: 2 }}>Prise de contrôle de la jam en cours…</Alert>;
  if (clientSession.status === 'taking_over') return <Alert severity="info" sx={{ mb: 2 }}>Reprise du contrôle en cours…</Alert>;
  if (clientSession.status === 'warning') return <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={onTakeover}>Réessayer / reprendre</Button>}>{clientSession.message ?? 'Connexion instable, sauvegarde locale active.'}</Alert>;
  if (!clientSession.readOnly) return null;
  return <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={onTakeover}>Reprendre le contrôle</Button>}>{clientSession.message ?? 'Lecture seule : un autre appareil contrôle peut-être cette jam.'}</Alert>;
}
