import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';

export function ConflictScopeDialog({ open, isReadOnly, onClose, onCreateConflict }) {
  return <Dialog open={open} onClose={onClose}>
    <DialogTitle>Portée du conflit</DialogTitle>
    <DialogContent><DialogContentText>Choisis si ce conflit concerne seulement ce passage ou toute la soirée.</DialogContentText></DialogContent>
    <DialogActions><Button onClick={onClose}>Annuler</Button><Button disabled={isReadOnly} onClick={() => onCreateConflict('appearance')}>Ce passage</Button><Button variant="contained" disabled={isReadOnly} onClick={() => onCreateConflict('participation')}>Toute la soirée</Button></DialogActions>
  </Dialog>;
}
