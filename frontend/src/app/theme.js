import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#7b3f00', contrastText: '#ffffff' },
    secondary: { main: '#5b4bb2', contrastText: '#ffffff' },
    warning: { main: '#9a5b00', contrastText: '#1f1300' },
    error: { main: '#b3261e', contrastText: '#ffffff' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '*, *::before, *::after': { boxSizing: 'border-box' },
        ':focus-visible': { outline: '3px solid #1a73e8', outlineOffset: 2 },
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': { animationDuration: '1ms !important', transitionDuration: '1ms !important', scrollBehavior: 'auto !important' },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { minHeight: 44, borderRadius: 10, textTransform: 'none' },
        sizeSmall: { minHeight: 40 },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { minWidth: 44, minHeight: 44 },
        sizeSmall: { minWidth: 40, minHeight: 40 },
      },
    },
    MuiDialog: {
      defaultProps: { fullWidth: true },
    },
  },
});
