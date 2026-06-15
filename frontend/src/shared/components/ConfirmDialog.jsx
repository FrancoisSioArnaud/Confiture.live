import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, useMediaQuery, useTheme } from '@mui/material';

export function ConfirmDialog({ open, title, description, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', onCancel, onConfirm }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="xs" fullScreen={fullScreen} aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description">
      <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id="confirm-dialog-description">{description}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' }, alignItems: 'stretch' }}>
        <Button onClick={onCancel} fullWidth={fullScreen}>{cancelLabel}</Button>
        <Button onClick={onConfirm} color="error" variant="contained" fullWidth={fullScreen}>{confirmLabel}</Button>
      </DialogActions>
    </Dialog>
  );
}
