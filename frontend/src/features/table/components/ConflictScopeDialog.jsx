import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack, Typography } from '@mui/material';

export function ConflictScopeDialog({ open, isReadOnly, onClose, onCreateConflict }) {
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
    <DialogTitle>Ce conflict concerne quoi ?</DialogTitle>
    <DialogContent>
      <Stack spacing={1.5}>
        <DialogContentText>Choisis la portée avant d’enregistrer le conflict.</DialogContentText>
        <Typography variant="body2"><strong>Seulement ce passage</strong> bloque uniquement les appearances sélectionnées.</Typography>
        <Typography variant="body2"><strong>Toute la soirée</strong> bloque les participations sélectionnées partout dans la jam.</Typography>
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Annuler</Button>
      <Button disabled={isReadOnly} onClick={() => onCreateConflict('appearance')}>Seulement ce passage</Button>
      <Button variant="contained" disabled={isReadOnly} onClick={() => onCreateConflict('participation')}>Toute la soirée</Button>
    </DialogActions>
  </Dialog>;
}
