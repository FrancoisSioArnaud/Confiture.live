import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';

export function RemoveTargetDialog({ target, isReadOnly, onCancel, onRemove }) {
  return <Dialog open={Boolean(target)} onClose={onCancel}>
    <DialogTitle>Supprimer ce passage ?</DialogTitle>
    <DialogContent><DialogContentText>{target?.isLinked ? 'Ce passage est lié : le link sera retiré de la projection.' : 'Cette action crée un event de suppression.'}</DialogContentText></DialogContent>
    <DialogActions><Button onClick={onCancel}>Annuler</Button><Button color="error" disabled={isReadOnly} onClick={onRemove}>Supprimer</Button></DialogActions>
  </Dialog>;
}
