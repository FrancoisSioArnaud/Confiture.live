import { Box, IconButton, Menu, MenuItem, Stack, Tooltip, Typography } from '@mui/material';
import { memo, useState } from 'react';

function cardColors({ item, isAnchor, isSelected, isConflictAnchor, isConflictSelected, canSelect, canSelectConflict }) {
  if (isConflictAnchor) return { borderColor: 'error.main', bgcolor: 'action.hover' };
  if (isConflictSelected) return { borderColor: 'warning.main', bgcolor: 'action.hover' };
  if (isAnchor) return { borderColor: 'primary.main', bgcolor: 'action.selected' };
  if (isSelected) return { borderColor: 'secondary.main', bgcolor: 'action.selected' };
  if (item.isPlayed) return { borderColor: 'divider', bgcolor: 'action.disabledBackground' };
  if (item.type === 'hole') return { borderColor: 'warning.main', bgcolor: 'action.hover' };
  if (item.isLocked) return { borderColor: 'primary.main', bgcolor: 'background.paper' };
  if (item.isLinked) return { borderColor: 'secondary.main', bgcolor: 'background.paper' };
  if (item.hasConflict) return { borderColor: 'error.light', bgcolor: 'background.paper' };
  if (canSelect || canSelectConflict) return { borderColor: 'primary.light', bgcolor: 'action.hover' };
  return { borderColor: 'divider', bgcolor: 'background.paper' };
}

export const CardItem = memo(function CardItem({ item, projectedState, disabled = false, onLockToggle, onRemove, onEditParticipant, onMove, linkMode, onLinkClick, onLinkTargetClick, conflictMode, onConflictClick, onConflictTargetClick, onRemoveConflicts, onPlayWithout }) {
  const [menuAnchor, setMenuAnchor] = useState(null);
  const label = item.type === 'hole' ? 'Trou' : projectedState.participants[item.participantId]?.name;
  const itemId = item.appearanceId ?? item.holeId;
  const isAnchor = linkMode?.anchor?.id === itemId;
  const isSelected = linkMode?.selectedTargets?.some((target) => target.id === itemId);
  const canSelect = linkMode && !isAnchor && linkMode.anchor.instrumentId !== item.instrumentId;
  const isConflictAnchor = conflictMode?.anchor?.id === itemId;
  const isConflictSelected = conflictMode?.selectedTargets?.some((target) => target.id === itemId);
  const canSelectConflict = conflictMode && item.type !== 'hole' && !isConflictAnchor;
  const menuOpen = Boolean(menuAnchor);
  const movementDisabled = disabled || item.isLocked || item.isPlayed;
  const colors = cardColors({ item, isAnchor, isSelected, isConflictAnchor, isConflictSelected, canSelect, canSelectConflict });

  function closeMenu() {
    setMenuAnchor(null);
  }

  function menuAction(callback) {
    closeMenu();
    callback?.();
  }

  return <Box
    role="group"
    tabIndex={0}
    aria-label={`${label} ${item.type === 'hole' ? 'trou' : 'passage'} ${item.isPlayed ? 'joué' : 'à jouer'}${item.isLocked ? ', verrouillé' : ''}${item.isLinked ? ', lié' : ''}${item.hasConflict ? ', conflict' : ''}`}
    onClick={() => { if (canSelect) onLinkTargetClick(item); if (canSelectConflict) onConflictTargetClick(item); }}
    sx={{
      border: '1px solid',
      borderColor: colors.borderColor,
      borderRadius: 1.5,
      p: 1,
      minHeight: 112,
      outline: 'none',
      transition: 'background-color 850ms ease, border-color 850ms ease, transform 850ms ease, box-shadow 850ms ease',
      '&:focus-visible': { boxShadow: 4, borderColor: 'primary.main', transform: 'translateY(-1px)' },
      bgcolor: colors.bgcolor,
      opacity: item.isPlayed ? 0.78 : 1,
    }}>
    <Stack spacing={0.75}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: item.type === 'hole' ? 600 : 500 }}>{label}</Typography>
          <Typography variant="caption" color="text.secondary">{item.isLinked ? 'lié · ' : ''}{item.hasConflict ? 'conflict · ' : ''}{item.isLocked ? 'verrouillé · ' : ''}{item.isPlayed ? 'joué · ' : ''}{item.type === 'hole' ? 'trou · ' : ''}Round {item.appearanceIndex}</Typography>
        </Box>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title={isAnchor ? 'Annuler le mode link' : item.isLinked ? 'Supprimer le link' : 'Créer un link'}>
            <span><IconButton size="small" color={isAnchor || item.isLinked ? 'primary' : 'default'} aria-label={`${isAnchor ? 'Annuler link' : item.isLinked ? 'Supprimer link' : 'Créer link'} ${label}`} disabled={disabled} onClick={(event) => { event.stopPropagation(); onLinkClick(item); }}>🔗</IconButton></span>
          </Tooltip>
          <Tooltip title={item.isLocked ? 'Déverrouiller' : 'Verrouiller'}>
            <span><IconButton size="small" color={item.isLocked ? 'primary' : 'default'} aria-label={`${item.isLocked ? 'Déverrouiller' : 'Verrouiller'} ${label}`} disabled={disabled} onClick={(event) => { event.stopPropagation(); onLockToggle(item); }}>{item.isLocked ? '🔒' : '🔓'}</IconButton></span>
          </Tooltip>
          <Tooltip title="Actions">
            <span><IconButton size="small" aria-label={`Actions ${label}`} aria-controls={menuOpen ? `menu_${itemId}` : undefined} aria-haspopup="menu" aria-expanded={menuOpen ? 'true' : undefined} disabled={disabled} onClick={(event) => { event.stopPropagation(); setMenuAnchor(event.currentTarget); }}>⋯</IconButton></span>
          </Tooltip>
        </Stack>
      </Stack>

      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Stack direction="row" spacing={0.5} aria-label={`Déplacement vertical ${label}`}>
          <Tooltip title="Monter dans cette colonne">
            <span><IconButton size="small" aria-label={`Monter ${label}`} disabled={movementDisabled} onClick={(event) => { event.stopPropagation(); onMove(item, -1); }}>↑</IconButton></span>
          </Tooltip>
          <Tooltip title="Descendre dans cette colonne">
            <span><IconButton size="small" aria-label={`Descendre ${label}`} disabled={movementDisabled} onClick={(event) => { event.stopPropagation(); onMove(item, 1); }}>↓</IconButton></span>
          </Tooltip>
        </Stack>
        <Typography variant="caption" color="text.secondary">↕︎ vertical</Typography>
      </Stack>
    </Stack>

    <Menu id={`menu_${itemId}`} anchorEl={menuAnchor} open={menuOpen} onClose={closeMenu} onClick={(event) => event.stopPropagation()}>
      {item.type !== 'hole' ? <MenuItem onClick={() => menuAction(() => onEditParticipant(item.participantId))}>Modifier le musicien</MenuItem> : null}
      {item.type !== 'hole' ? <MenuItem onClick={() => menuAction(() => onConflictClick(item))}>{isConflictAnchor ? 'Annuler le mode conflict' : 'Créer un conflict'}</MenuItem> : null}
      {item.activeConflicts?.length ? <MenuItem onClick={() => menuAction(() => onRemoveConflicts(item))}>Supprimer conflict{item.activeConflicts.length > 1 ? 's' : ''}</MenuItem> : null}
      {item.type !== 'hole' ? <MenuItem onClick={() => menuAction(() => onPlayWithout(item))}>Jouer sans…</MenuItem> : null}
      <MenuItem sx={{ color: 'error.main' }} onClick={() => menuAction(() => onRemove(item))}>{item.type === 'hole' ? 'Supprimer le trou' : 'Supprimer le passage'}</MenuItem>
    </Menu>
  </Box>;
});
