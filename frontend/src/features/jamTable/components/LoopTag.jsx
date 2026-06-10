import { Chip } from "@mui/material";

import { designTokens } from "../../../theme";

export default function LoopTag({ loopNumber }) {
  if (!loopNumber) {
    return null;
  }

  return (
    <Chip
      label={`🔁 ${loopNumber}`}
      size="small"
      sx={{
        height: designTokens.tags.height,
        borderRadius: `${designTokens.tags.radius}px`,
        bgcolor: designTokens.colors.loopTagBg,
        color: designTokens.colors.loopTagText,
        fontSize: designTokens.tags.fontSize,
        fontWeight: designTokens.typography.buttonWeight,
        "& .MuiChip-label": {
          px: `${designTokens.tags.paddingX}px`,
        },
      }}
    />
  );
}
