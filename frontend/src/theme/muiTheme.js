import { createTheme } from "@mui/material/styles";

import { designTokens } from "./designTokens";

export const muiTheme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: designTokens.app.background,
      paper: designTokens.app.surface,
    },
    primary: {
      main: designTokens.colors.primary,
      dark: designTokens.colors.primaryDark,
      contrastText: designTokens.app.background,
    },
    success: {
      main: designTokens.colors.success,
    },
    warning: {
      main: designTokens.colors.warning,
    },
    error: {
      main: designTokens.colors.danger,
    },
    text: {
      primary: designTokens.app.textPrimary,
      secondary: designTokens.app.textSecondary,
    },
  },
  typography: {
    fontFamily: designTokens.typography.fontFamily.join(","),
    h1: {
      fontSize: designTokens.typography.h1FontSize,
      fontWeight: designTokens.typography.headingWeight,
    },
    h2: {
      fontSize: designTokens.typography.h2FontSize,
      fontWeight: designTokens.typography.headingWeight,
    },
    button: {
      fontWeight: designTokens.typography.buttonWeight,
      textTransform: "none",
    },
  },
  shape: {
    borderRadius: designTokens.card.radius,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: designTokens.card.radius,
          minHeight: designTokens.button.minHeight,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: "none",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage: "none",
        },
      },
    },
  },
});
