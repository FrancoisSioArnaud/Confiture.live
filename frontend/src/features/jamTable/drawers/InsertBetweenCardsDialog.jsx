import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";

export default function InsertBetweenCardsDialog({ open, selection, onClose, onAddParticipant, onAddHole }) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Ajouter ici</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary">
          Ligne {selection ? selection.rowIndex + 1 : ""} · {selection?.column.name}.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button onClick={onAddParticipant}>Ajouter un participant</Button>
        <Button variant="contained" onClick={onAddHole}>Ajouter un trou</Button>
      </DialogActions>
    </Dialog>
  );
}
