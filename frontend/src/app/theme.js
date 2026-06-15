import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#7b3f00', contrastText: '#fffaf2' },
    secondary: { main: '#c26a00', contrastText: '#1f1200' },
    background: { default: '#fff8ef' },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 40,
          '&.Mui-focusVisible': { outline: '3px solid #1d4ed8', outlineOffset: 2 },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: 44,
          minHeight: 44,
          '&.Mui-focusVisible': { outline: '3px solid #1d4ed8', outlineOffset: 2 },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          transition: 'transform 850ms ease, opacity 300ms ease, border-color 200ms ease, background-color 200ms ease',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
        },
      },
    },
  },
});
