import { Alert, Button, Stack, Typography } from '@mui/material';

export function TableModeActionBar({ linkMode, conflictMode, onValidateLink, onCancelLink, onOpenConflictScope, onCancelConflict }) {
  return <>
    {conflictMode ? <Alert severity="warning" variant="outlined" sx={{ mb: 2, position: 'sticky', top: 8, zIndex: 4, transition: 'box-shadow 180ms ease, transform 180ms ease' }} action={<Stack direction="row" spacing={1}><Button color="inherit" size="small" onClick={onOpenConflictScope} disabled={conflictMode.selectedTargets.length < 2}>Valider</Button><Button color="inherit" size="small" onClick={onCancelConflict}>Annuler</Button></Stack>}><Typography fontWeight={600}>Mode conflict · {conflictMode.selectedTargets.length} sélection</Typography>Sélectionne les appearances incompatibles. Les trous sont exclus. La validation demandera si le conflict vaut seulement pour ce passage ou toute la soirée.</Alert> : null}
    {linkMode ? <Alert severity="info" variant="outlined" sx={{ mb: 2, position: 'sticky', top: 8, zIndex: 4, transition: 'box-shadow 180ms ease, transform 180ms ease' }} action={<Stack direction="row" spacing={1}><Button color="inherit" size="small" onClick={onValidateLink} disabled={linkMode.selectedTargets.length < 2}>Valider le link</Button><Button color="inherit" size="small" onClick={onCancelLink}>Annuler</Button></Stack>}><Typography fontWeight={600}>Mode link · {linkMode.selectedTargets.length} sélection</Typography>Une seule card par instrument. Recliquer la card de départ annule le mode.</Alert> : null}
  </>;
}
