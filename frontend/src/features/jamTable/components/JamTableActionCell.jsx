import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { Box, IconButton, Stack } from "@mui/material";

import { designTokens } from "../../../theme";

export default function JamTableActionCell({ rowIndex, onCall, onPlateauPlayed }) {
  return (
    <Box
      sx={{
        position: "sticky",
        left: 0,
        zIndex: designTokens.zIndex.stickyActionColumn,
        width: designTokens.table.actionColumnWidth,
        minWidth: designTokens.table.actionColumnWidth,
        bgcolor: designTokens.app.background,
        borderRight: `${designTokens.card.borderWidth}px solid ${designTokens.colors.border}`,
      }}
    >
      <Stack spacing={`${designTokens.spacing.xs}px`} alignItems="center" justifyContent="center">
        <IconButton aria-label={`Appeler le plateau ${rowIndex + 1}`} color="primary" onClick={() => onCall(rowIndex)} sx={{ minWidth: designTokens.button.minHeight, minHeight: designTokens.button.minHeight }}>
          <CampaignRoundedIcon />
        </IconButton>
        <IconButton aria-label={`Plateau joué ${rowIndex + 1}`} color="success" onClick={() => onPlateauPlayed(rowIndex)} sx={{ minWidth: designTokens.button.minHeight, minHeight: designTokens.button.minHeight }}>
          <CheckRoundedIcon />
        </IconButton>
      </Stack>
    </Box>
  );
}
