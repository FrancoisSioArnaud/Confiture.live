import { designTokens } from "../../../theme";

const instrumentColumnWidthVar = "--jam-instrument-column-width";

export function getPlateauGridSx(columnCount) {
  return {
    [instrumentColumnWidthVar]: {
      xs: `${designTokens.table.instrumentColumnMinWidth}px`,
      sm: `${designTokens.table.instrumentColumnTabletMinWidth}px`,
    },
    display: "grid",
    gridTemplateColumns: `${designTokens.table.actionColumnWidth}px repeat(${columnCount}, var(${instrumentColumnWidthVar}))`,
    minWidth: {
      xs: designTokens.table.actionColumnWidth + (columnCount * designTokens.table.instrumentColumnMinWidth),
      sm: designTokens.table.actionColumnWidth + (columnCount * designTokens.table.instrumentColumnTabletMinWidth),
    },
  };
}

export const actionColumnSx = {
  position: "sticky",
  left: 0,
  zIndex: designTokens.zIndex.stickyActionColumn,
  width: designTokens.table.actionColumnWidth,
  minWidth: designTokens.table.actionColumnWidth,
  maxWidth: designTokens.table.actionColumnWidth,
  boxSizing: "border-box",
  bgcolor: designTokens.app.background,
  borderRight: `${designTokens.card.borderWidth}px solid ${designTokens.colors.border}`,
};

export const instrumentCellSx = {
  width: "100%",
  minWidth: 0,
  maxWidth: "100%",
  boxSizing: "border-box",
};
