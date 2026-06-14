import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient.js';
import { theme } from './theme.js';

export function AppProviders({ children }) {
  return <QueryClientProvider client={queryClient}><ThemeProvider theme={theme}><CssBaseline />{children}</ThemeProvider></QueryClientProvider>;
}
