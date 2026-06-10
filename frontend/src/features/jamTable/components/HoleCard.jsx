import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import { Card, IconButton, Stack, Typography } from "@mui/material";

import { designTokens } from "../../../theme";
import LinkTag from "./LinkTag";

export default function HoleCard({ cell, instrumentName, linkLabel, isLinkSelected = false, isLinkDisabled = false, onLink, onMenu, onSelect }) {
  return (
    <Card
      variant="outlined"
      data-state={cell.isPlayed ? "played-hole" : "hole"}
      onClick={onSelect}
      sx={{
        minHeight: designTokens.card.minHeight,
        px: `${designTokens.card.paddingX}px`,
        py: `${designTokens.card.paddingY}px`,
        borderRadius: `${designTokens.card.radius}px`,
        borderWidth: `${designTokens.card.borderWidth}px`,
        borderStyle: "dashed",
        borderColor: isLinkSelected ? designTokens.colors.link : designTokens.colors.holeBorder,
        bgcolor: cell.isPlayed ? designTokens.colors.playedBg : designTokens.colors.holeBg,
        color: cell.isPlayed ? designTokens.colors.playedText : designTokens.app.textPrimary,
        opacity: cell.isPlayed || isLinkDisabled ? designTokens.card.playedOpacity : 1,
        cursor: onSelect && !isLinkDisabled ? "pointer" : "default",
      }}
    >
      <Stack spacing={`${designTokens.spacing.xs}px`}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={`${designTokens.spacing.xs}px`}>
          <Typography variant="body2" fontWeight={designTokens.typography.headingWeight}>
            Sans {instrumentName.toLowerCase()}
          </Typography>
          <Stack direction="row" spacing={0} alignItems="center">
            <IconButton aria-label={`Lier trou ${instrumentName}`} size="small" onClick={onLink} disabled={cell.isPlayed || isLinkDisabled} sx={{ minWidth: designTokens.button.minHeight, minHeight: designTokens.button.minHeight }}>
              <LinkRoundedIcon fontSize="small" />
            </IconButton>
            <IconButton aria-label={`Menu trou ${instrumentName}`} size="small" onClick={onMenu} sx={{ minWidth: designTokens.button.minHeight, minHeight: designTokens.button.minHeight }}>
              <MoreVertRoundedIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
        <LinkTag label={linkLabel} />
      </Stack>
    </Card>
  );
}
