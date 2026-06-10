export const designTokens = {
  app: {
    background: "#0F1115",
    surface: "#171A21",
    textPrimary: "#FFFFFF",
    textSecondary: "#AEB4C0",
  },

  colors: {
    primary: "#FF8A00",
    primaryDark: "#D96F00",
    success: "#3CCB7F",
    danger: "#FF5C5C",
    warning: "#FFD166",
    link: "#7C5CFF",
    loopTagBg: "#E6F0FF",
    loopTagText: "#1D5FD1",
    playedBg: "#2A2D34",
    playedText: "#8B929F",
    holeBg: "#20242D",
    holeBorder: "#6D7480",
    border: "#2F3440",
    cardBg: "#1D212A",
    nextPlayableBorder: "#FFB14A",
    emptyCellBg: "#12151B",
    syncPendingBg: "#2C2414",
    syncPendingText: "#FFD166",
  },

  table: {
    actionColumnWidth: 64,
    instrumentColumnMinWidth: 132,
    instrumentColumnTabletMinWidth: 164,
    headerHeight: 44,
    maxViewportHeight: "70vh",
    rowGap: 8,
    columnGap: 8,
  },

  card: {
    minHeight: 56,
    paddingX: 8,
    paddingY: 8,
    radius: 10,
    borderWidth: 1,
    playedOpacity: 0.72,
  },

  drawer: {
    mobileBorderRadius: 16,
    desktopWidth: 420,
    mobilePeekHeight: "min(88vh, 720px)",
    bottomActionHeight: 72,
  },

  tags: {
    height: 20,
    radius: 999,
    paddingX: 6,
    fontSize: 11,
  },

  typography: {
    fontFamily: ['"Inter"', '"Roboto"', '"Helvetica"', '"Arial"', "sans-serif"],
    h1FontSize: "2rem",
    h2FontSize: "1.5rem",
    headingWeight: 700,
    buttonWeight: 700,
  },

  button: {
    minHeight: 44,
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },

  zIndex: {
    stickyHeader: 10,
    stickyActionColumn: 11,
    drawer: 1200,
    bottomActionBar: 1250,
  },

  transitions: {
    fast: "120ms ease",
    normal: "180ms ease",
  },
};
