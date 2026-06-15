import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';

const ConfirmDialogContext = createContext(null);

export function ConfirmDialogProvider({ children }) {
  const [confirmation, setConfirmation] = useState(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    setConfirmation({
      title: options.title,
      description: options.description,
      cancelLabel: options.cancelLabel ?? 'Annuler',
      confirmLabel: options.confirmLabel ?? 'Confirmer',
      confirmColor: options.confirmColor ?? 'primary',
      resolve,
    });
  }), []);

  const close = useCallback((result) => {
    setConfirmation((current) => {
      current?.resolve(result);
      return null;
    });
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return <ConfirmDialogContext.Provider value={value}>
    {children}
    <Dialog open={Boolean(confirmation)} onClose={() => close(false)} fullWidth maxWidth="xs">
      <DialogTitle>{confirmation?.title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{confirmation?.description}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={() => close(false)}>{confirmation?.cancelLabel ?? 'Annuler'}</Button>
        <Button color={confirmation?.confirmColor ?? 'primary'} variant="contained" onClick={() => close(true)}>{confirmation?.confirmLabel ?? 'Confirmer'}</Button>
      </DialogActions>
    </Dialog>
  </ConfirmDialogContext.Provider>;
}

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);
  if (!context) throw new Error('useConfirmDialog must be used within ConfirmDialogProvider');
  return context;
}
