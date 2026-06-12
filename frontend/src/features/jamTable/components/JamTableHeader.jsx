import { Box, Typography } from "@mui/material";

import { designTokens } from "../../../theme";
import { actionColumnSx, getPlateauGridSx, instrumentCellSx } from "./tableLayoutStyles";

export default function JamTableHeader({ columns }) {
  return (
    <Box
      role="row"
      sx={{
        ...getPlateauGridSx(columns.length),
        position: "sticky",
        top: 0,
        zIndex: designTokens.zIndex.stickyHeader,
        bgcolor: designTokens.app.background,
      }}
    >
      <Box
        sx={{
          ...actionColumnSx,
          height: designTokens.table.headerHeight,
        }}
      />
      {columns.map((column) => (
        <Box
          key={column.instrumentId}
          role="columnheader"
          sx={{
            ...instrumentCellSx,
            height: designTokens.table.headerHeight,
            display: "flex",
            alignItems: "center",
            px: `${designTokens.spacing.sm}px`,
            borderBottom: `${designTokens.card.borderWidth}px solid ${designTokens.colors.border}`,
          }}
        >
          <Typography variant="subtitle2" fontWeight={designTokens.typography.headingWeight} noWrap>
            {column.name}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
