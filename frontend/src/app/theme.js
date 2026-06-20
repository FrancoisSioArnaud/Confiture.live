import { createTheme } from '@mui/material/styles';

export const colors = {
  brand: {
    primary: '#8b5cf6',
    primaryLight: '#a78bfa',
    primaryDark: '#6d28d9',
    primaryContrast: '#ffffff',
    secondary: '#06b6d4',
    secondaryLight: '#22d3ee',
    secondaryDark: '#0e7490',
    secondaryContrast: '#06131a',
  },
  semantic: {
    success: '#22c55e',
    successLight: '#86efac',
    successDark: '#15803d',
    warning: '#f59e0b',
    warningLight: '#fbbf24',
    warningDark: '#b45309',
    error: '#ef4444',
    errorLight: '#f87171',
    errorDark: '#b91c1c',
    info: '#38bdf8',
    infoLight: '#7dd3fc',
    infoDark: '#0284c7',
  },
  surface: {
    app: '#0b1020',
    paper: '#111827',
    elevated: '#182033',
    hover: '#1f2937',
    selected: '#24324a',
    divider: '#334155',
    disabledBackground: '#1e293b',
  },
  text: {
    primary: '#f8fafc',
    secondary: '#cbd5e1',
    disabled: '#64748b',
  },
  state: {
    focusOutline: '#facc15',

    // States métier volontairement très distincts
    locked: '#f59e0b',
    linked: '#facc15',
    conflict: '#ef4444',
    played: '#14532d',
    selectable: '#8b5cf6',
    selected: '#22c55e',
    skipped: '#fb7185',
    hole: '#475569',
  },
};

const focusVisibleStyle = {
  outline: `3px solid ${colors.state.focusOutline}`,
  outlineOffset: 2,
};

export const theme = createTheme({
  palette: {
    mode: 'dark',
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
      contrastText: '#04130a',
    },
    warning: {
      main: colors.semantic.warning,
      light: colors.semantic.warningLight,
      dark: colors.semantic.warningDark,
      contrastText: '#1f1300',
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
      contrastText: '#04131c',
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
      focus: colors.surface.selected,
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
          backgroundColor: colors.surface.paper,
          borderLeft: `1px solid ${colors.surface.divider}`,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        outlined: {
          borderColor: colors.surface.divider,
        },
      },
    },
  },
});
