import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient.js';
import { theme } from './theme.js';
import { ConfirmDialogProvider, SnackbarProvider } from '../shared/feedback/index.js';

export function AppProviders({ children }) {
  return <QueryClientProvider client={queryClient}><ThemeProvider theme={theme}><CssBaseline /><SnackbarProvider><ConfirmDialogProvider>{children}</ConfirmDialogProvider></SnackbarProvider></ThemeProvider></QueryClientProvider>;
}
