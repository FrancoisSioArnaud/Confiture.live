import { Chip } from "@mui/material";

import { designTokens } from "../../../theme";

export default function LinkTag({ label }) {
  if (!label) {
    return null;
  }

  return (
    <Chip
      label={`🔗 ${label}`}
      size="small"
      sx={{
        height: designTokens.tags.height,
        borderRadius: `${designTokens.tags.radius}px`,
        bgcolor: designTokens.colors.link,
        color: designTokens.app.textPrimary,
        fontSize: designTokens.tags.fontSize,
        fontWeight: designTokens.typography.buttonWeight,
        "& .MuiChip-label": {
          px: `${designTokens.tags.paddingX}px`,
        },
      }}
    />
  );
}
