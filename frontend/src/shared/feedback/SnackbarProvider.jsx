import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';

const SnackbarContext = createContext(null);

export function SnackbarProvider({ children }) {
  const [queue, setQueue] = useState([]);

  const showSnackbar = useCallback((message, options = {}) => {
    const normalizedOptions = typeof options === 'string' ? { severity: options } : options;
    setQueue((current) => [
      ...current,
      {
        id: `${Date.now()}_${current.length}`,
        message,
        severity: normalizedOptions.severity ?? 'success',
        autoHideDuration: normalizedOptions.autoHideDuration ?? 3000,
      },
    ]);
  }, []);

  const closeSnackbar = useCallback(() => {
    setQueue((current) => current.slice(1));
  }, []);

  const value = useMemo(() => ({ showSnackbar }), [showSnackbar]);
  const activeSnackbar = queue[0];

  return <SnackbarContext.Provider value={value}>
    {children}
    <Snackbar open={Boolean(activeSnackbar)} autoHideDuration={activeSnackbar?.autoHideDuration ?? 3000} onClose={closeSnackbar}>
      <Alert severity={activeSnackbar?.severity ?? 'success'} onClose={closeSnackbar} sx={{ width: '100%' }}>
        {activeSnackbar?.message}
      </Alert>
    </Snackbar>
  </SnackbarContext.Provider>;
}

export function useSnackbar() {
  const context = useContext(SnackbarContext);
  if (!context) throw new Error('useSnackbar must be used within SnackbarProvider');
  return context;
}
