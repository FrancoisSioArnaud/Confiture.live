import { Chip } from "@mui/material";

import { designTokens } from "../../../theme";

export default function RoundTag({ roundNumber }) {
  if (!roundNumber || roundNumber <= 1) return null;
  return (
    <Chip
      label={`Round ${roundNumber}`}
      size="small"
      sx={{
        height: designTokens.tags.height,
        fontSize: designTokens.tags.fontSize,
        color: designTokens.colors.loopTagText,
        bgcolor: designTokens.colors.loopTagBg,
      }}
    />
  );
}
