import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';

export function RemoveTargetDialog({ target, isReadOnly, onCancel, onRemove }) {
  const isHole = target?.type === 'hole';
  const title = isHole ? 'Supprimer ce trou ?' : 'Supprimer ce passage ?';
  const description = isHole
    ? target?.isLinked
      ? 'Ce trou est lié à un autre passage. Le supprimer supprimera aussi les links associés, sans supprimer le musicien lié.'
      : 'Cette action supprime uniquement ce trou, sans toucher aux musiciens.'
    : target?.isLinked
      ? 'Ce passage est lié : le link sera retiré de la projection.'
      : 'Cette action crée un event de suppression.';
  return <Dialog open={Boolean(target)} onClose={onCancel}>
    <DialogTitle>{title}</DialogTitle>
    <DialogContent><DialogContentText>{description}</DialogContentText></DialogContent>
    <DialogActions><Button onClick={onCancel}>Annuler</Button><Button color="error" disabled={isReadOnly || target?.isPlayed} onClick={onRemove}>Supprimer</Button></DialogActions>
  </Dialog>;
}
