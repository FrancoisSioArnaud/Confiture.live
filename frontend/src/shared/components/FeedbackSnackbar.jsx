import { Alert, Snackbar } from '@mui/material';

export function FeedbackSnackbar({ open, message, severity = 'info', onClose }) {
  return (
    <Snackbar
      open={open}
      autoHideDuration={3600}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{ bottom: { xs: 80, sm: 24 }, px: 1 }}
    >
      <Alert onClose={onClose} severity={severity} variant="filled" sx={{ width: '100%', maxWidth: 520, boxShadow: 4 }}>{message}</Alert>
    </Snackbar>
  );
}
