import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import { Card, Chip, IconButton, Stack, Typography } from "@mui/material";

import { designTokens } from "../../../theme";
import LinkTag from "./LinkTag";
import LoopTag from "./LoopTag";

export default function ParticipantCard({ cell, linkLabel, isLinkSelected = false, isLinkDisabled = false, isDragImpacted = false, onCheck, onLink, onMenu, onSelect }) {
  const borderColor = isLinkSelected || isDragImpacted
    ? designTokens.colors.link
    : cell.isNextPlayable
      ? designTokens.colors.nextPlayableBorder
      : designTokens.colors.border;

  return (
    <Card
      variant="outlined"
      data-state={cell.isPlayed ? "played" : cell.isNextPlayable ? "next-playable" : "normal"}
      onClick={onSelect}
      sx={{
        width: "100%",
        minWidth: 0,
        minHeight: designTokens.card.minHeight,
        px: `${designTokens.card.paddingX}px`,
        py: `${designTokens.card.paddingY}px`,
        borderRadius: `${designTokens.card.radius}px`,
        borderWidth: `${designTokens.card.borderWidth}px`,
        borderColor,
        bgcolor: cell.isPlayed ? designTokens.colors.playedBg : designTokens.colors.cardBg,
        color: cell.isPlayed ? designTokens.colors.playedText : designTokens.app.textPrimary,
        opacity: cell.isPlayed || isLinkDisabled ? designTokens.card.playedOpacity : 1,
        cursor: onSelect && !isLinkDisabled ? "pointer" : "default",
        boxSizing: "border-box",
      }}
    >
      <Stack spacing={`${designTokens.spacing.xs}px`} sx={{ minWidth: 0 }}>
        <Typography variant="body2" fontWeight={designTokens.typography.headingWeight} noWrap sx={{ minWidth: 0 }}>
          {cell.participantName}
        </Typography>
        {cell.customInstrumentLabel ? (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
            {cell.customInstrumentLabel}
          </Typography>
        ) : null}
        <Stack direction="row" spacing={0} alignItems="center" flexWrap="wrap" useFlexGap>
          {cell.isPlayed ? (
            <Chip
              icon={<CheckRoundedIcon />}
              label="A joué"
              size="small"
              sx={{
                height: designTokens.tags.height,
                color: designTokens.colors.playedText,
                bgcolor: designTokens.colors.playedBg,
                "& .MuiChip-icon": { color: designTokens.colors.playedText },
              }}
            />
          ) : null}
          {cell.isNextPlayable && !cell.isPlayed ? (
            <IconButton aria-label={`A joué ${cell.participantName}`} size="small" onClick={onCheck} sx={{ minWidth: designTokens.button.minHeight, minHeight: designTokens.button.minHeight }}>
              <CheckRoundedIcon fontSize="small" />
            </IconButton>
          ) : null}
          <IconButton aria-label={`Lier ${cell.participantName}`} size="small" onClick={onLink} disabled={cell.isPlayed || isLinkDisabled} sx={{ minWidth: designTokens.button.minHeight, minHeight: designTokens.button.minHeight }}>
            <LinkRoundedIcon fontSize="small" />
          </IconButton>
          <IconButton aria-label={`Menu ${cell.participantName}`} size="small" onClick={onMenu} sx={{ minWidth: designTokens.button.minHeight, minHeight: designTokens.button.minHeight }}>
            <MoreVertRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Stack direction="row" spacing={`${designTokens.spacing.xs}px`} flexWrap="wrap" useFlexGap>
          <LoopTag loopNumber={cell.isLoop ? cell.loopNumber : null} />
          <LinkTag label={linkLabel} />
          {cell.isParticipantLeft ? (
            <Typography variant="caption" color="text.secondary">
              parti
            </Typography>
          ) : null}
        </Stack>
      </Stack>
    </Card>
  );
}
