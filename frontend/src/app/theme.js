import { createTheme } from '@mui/material/styles';

export const colors = {
  brand: {
    primary: '#7b3f00',
    primaryLight: '#a8672b',
    primaryDark: '#4f2800',
    primaryContrast: '#fffaf2',
    secondary: '#c26a00',
    secondaryLight: '#de8730',
    secondaryDark: '#7a3f00',
    secondaryContrast: '#1f1200',
  },
  semantic: {
    success: '#2e7d32',
    successLight: '#4caf50',
    successDark: '#1b5e20',
    warning: '#ed6c02',
    warningLight: '#ff9800',
    warningDark: '#b45309',
    error: '#d32f2f',
    errorLight: '#ef5350',
    errorDark: '#9a1f1f',
    info: '#0288d1',
    infoLight: '#03a9f4',
    infoDark: '#01579b',
  },
  surface: {
    app: '#fff8ef',
    paper: '#fffaf2',
    elevated: '#ffffff',
    hover: '#f5eadb',
    selected: '#efe0ca',
    divider: '#e4d3be',
    disabledBackground: '#eadfce',
  },
  text: {
    primary: '#1f1200',
    secondary: '#6f5b45',
    disabled: '#9c8c7c',
  },
  state: {
    focusOutline: '#1d4ed8',
    locked: '#ed6c02',
    linked: '#7b3f00',
    conflict: '#d32f2f',
    played: '#f5eadb',
  },
};

const focusVisibleStyle = {
  outline: `3px solid ${colors.state.focusOutline}`,
  outlineOffset: 2,
};

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: colors.brand.primary,
      light: colors.brand.primaryLight,
      dark: colors.brand.primaryDark,
      contrastText: colors.brand.primaryContrast,
    },
    secondary: {
      main: colors.brand.secondary,
      light: colors.brand.secondaryLight,
      dark: colors.brand.secondaryDark,
      contrastText: colors.brand.secondaryContrast,
    },
    success: {
      main: colors.semantic.success,
      light: colors.semantic.successLight,
      dark: colors.semantic.successDark,
      contrastText: '#ffffff',
    },
    warning: {
      main: colors.semantic.warning,
      light: colors.semantic.warningLight,
      dark: colors.semantic.warningDark,
      contrastText: '#1f1200',
    },
    error: {
      main: colors.semantic.error,
      light: colors.semantic.errorLight,
      dark: colors.semantic.errorDark,
      contrastText: '#ffffff',
    },
    info: {
      main: colors.semantic.info,
      light: colors.semantic.infoLight,
      dark: colors.semantic.infoDark,
      contrastText: '#ffffff',
    },
    background: {
      default: colors.surface.app,
      paper: colors.surface.paper,
    },
    text: {
      primary: colors.text.primary,
      secondary: colors.text.secondary,
      disabled: colors.text.disabled,
    },
    divider: colors.surface.divider,
    action: {
      hover: colors.surface.hover,
      selected: colors.surface.selected,
      disabled: colors.text.disabled,
      disabledBackground: colors.surface.disabledBackground,
    },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: colors.surface.app,
          color: colors.text.primary,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 40,
          '&.Mui-focusVisible': focusVisibleStyle,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: 44,
          minHeight: 44,
          '&.Mui-focusVisible': focusVisibleStyle,
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
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 700,
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
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});
