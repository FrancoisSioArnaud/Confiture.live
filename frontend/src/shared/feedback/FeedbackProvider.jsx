import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { FeedbackSnackbar } from '../components/FeedbackSnackbar';

const FeedbackContext = createContext({ enqueueFeedback: () => {} });

export function FeedbackProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const current = queue[0] ?? null;

  const enqueueFeedback = useCallback((message, severity = 'success') => {
    if (!message) return;
    setQueue((items) => [...items, { id: `${Date.now()}_${items.length}`, message, severity }]);
  }, []);

  const closeCurrent = useCallback(() => {
    setQueue((items) => items.slice(1));
  }, []);

  const value = useMemo(() => ({ enqueueFeedback }), [enqueueFeedback]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <FeedbackSnackbar open={Boolean(current)} message={current?.message ?? ''} severity={current?.severity ?? 'success'} onClose={closeCurrent} />
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  return useContext(FeedbackContext);
}
