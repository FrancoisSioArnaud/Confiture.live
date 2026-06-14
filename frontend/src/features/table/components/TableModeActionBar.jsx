import { Alert, Button, Stack } from '@mui/material';

export function TableModeActionBar({ linkMode, conflictMode, onValidateLink, onCancelLink, onOpenConflictScope, onCancelConflict }) {
  return <>
    {conflictMode ? <Alert severity="warning" sx={{ mb: 2 }} action={<Stack direction="row" spacing={1}><Button color="inherit" size="small" onClick={onOpenConflictScope} disabled={conflictMode.selectedTargets.length < 2}>Valider</Button><Button color="inherit" size="small" onClick={onCancelConflict}>Annuler</Button></Stack>}>Mode conflict : sélectionne les appearances incompatibles.</Alert> : null}
    {linkMode ? <Alert severity="info" sx={{ mb: 2 }} action={<Stack direction="row" spacing={1}><Button color="inherit" size="small" onClick={onValidateLink} disabled={linkMode.selectedTargets.length < 2}>Valider</Button><Button color="inherit" size="small" onClick={onCancelLink}>Annuler</Button></Stack>}>Mode link : sélectionne au maximum une card par autre instrument.</Alert> : null}
  </>;
}
