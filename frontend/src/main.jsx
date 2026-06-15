import React from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from './app/queryClient';
import { router } from './app/router';
import { theme } from './app/theme';
import { FeedbackProvider } from './shared/feedback/FeedbackProvider';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <FeedbackProvider>
          <RouterProvider router={router} />
        </FeedbackProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
