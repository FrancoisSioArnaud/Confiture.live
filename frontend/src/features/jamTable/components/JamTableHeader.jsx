import { Box, Typography } from "@mui/material";

import { designTokens } from "../../../theme";

export default function JamTableHeader({ columns }) {
  return (
    <Box
      role="row"
      sx={{
        display: "flex",
        position: "sticky",
        top: 0,
        zIndex: designTokens.zIndex.stickyHeader,
        bgcolor: designTokens.app.background,
      }}
    >
      <Box
        sx={{
          position: "sticky",
          left: 0,
          zIndex: designTokens.zIndex.stickyActionColumn,
          width: designTokens.table.actionColumnWidth,
          minWidth: designTokens.table.actionColumnWidth,
          height: designTokens.table.headerHeight,
          bgcolor: designTokens.app.background,
          borderRight: `${designTokens.card.borderWidth}px solid ${designTokens.colors.border}`,
        }}
      />
      {columns.map((column) => (
        <Box
          key={column.instrumentId}
          role="columnheader"
          sx={{
            minWidth: {
              xs: designTokens.table.instrumentColumnMinWidth,
              sm: designTokens.table.instrumentColumnTabletMinWidth,
            },
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
