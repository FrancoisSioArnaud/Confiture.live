import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { useMemo, useState } from "react";

import AppDrawer from "../../../shared/components/AppDrawer";
import { designTokens } from "../../../theme";
import LinkTag from "../components/LinkTag";
import LoopTag from "../components/LoopTag";

function getReplacementCandidates(rows, instrumentId, unavailableEntryId) {
  const seen = new Set([unavailableEntryId]);
  const candidates = [];

  for (const row of rows) {
    const cell = row.cells[instrumentId];
    if (cell?.type === "entry" && !cell.isPlayed && !cell.isParticipantLeft && !seen.has(cell.entryId)) {
      seen.add(cell.entryId);
      candidates.push({ rowIndex: row.rowIndex, cell });
    }
  }

  return candidates;
}

export default function UnavailableReplacementDrawer({ open, target, projection, linkLabels, onClose, onReplaceUnavailable }) {
  const [confirmCandidate, setConfirmCandidate] = useState(null);
  const candidates = useMemo(() => (
    target?.cell
      ? getReplacementCandidates(projection.rows, target.cell.instrumentId, target.cell.entryId)
      : []
  ), [projection.rows, target]);
  const needsUnavailableConfirm = Boolean(target?.cell?.linkGroupId);

  const chooseCandidate = (candidate) => {
    if (needsUnavailableConfirm || candidate.cell.linkGroupId) {
      setConfirmCandidate(candidate);
      return;
    }

    onReplaceUnavailable({ unavailableEntryId: target.cell.entryId, replacementEntryId: candidate.cell.entryId });
    onClose();
  };

  const confirmReplacement = () => {
    if (confirmCandidate && target?.cell) {
      onReplaceUnavailable({ unavailableEntryId: target.cell.entryId, replacementEntryId: confirmCandidate.cell.entryId });
    }
    setConfirmCandidate(null);
    onClose();
  };

  return (
    <>
      <AppDrawer
        open={open}
        onClose={onClose}
        title={target?.cell ? `Remplacer ${target.cell.participantName}` : "Remplacer"}
        subtitle={target?.column?.name}
        actions={<Button onClick={onClose}>Fermer</Button>}
      >
        <Stack spacing={`${designTokens.spacing.md}px`}>
          {candidates.length === 0 ? (
            <Typography color="text.secondary">Aucun remplaçant disponible pour cet instrument.</Typography>
          ) : null}
          {candidates.map((candidate) => (
            <Stack
              key={`${candidate.cell.entryId}-${candidate.rowIndex}`}
              direction="row"
              alignItems="center"
              spacing={`${designTokens.spacing.sm}px`}
              sx={{
                p: `${designTokens.spacing.sm}px`,
                border: `${designTokens.card.borderWidth}px solid ${designTokens.colors.border}`,
                borderRadius: `${designTokens.card.radius}px`,
              }}
            >
              <Stack spacing={`${designTokens.spacing.xs}px`} sx={{ flex: 1 }}>
                <Typography fontWeight={designTokens.typography.headingWeight}>{candidate.cell.participantName}</Typography>
                <Stack direction="row" spacing={`${designTokens.spacing.xs}px`}>
                  <LoopTag loopNumber={candidate.cell.isLoop ? candidate.cell.loopNumber : null} />
                  <LinkTag label={linkLabels[candidate.cell.linkGroupId]} />
                  <Typography variant="caption" color="text.secondary">
                    {candidate.cell.linkGroupId ? "Lié — sera délié" : "Non lié"}
                  </Typography>
                </Stack>
              </Stack>
              <Button variant="outlined" onClick={() => chooseCandidate(candidate)}>Choisir</Button>
            </Stack>
          ))}
        </Stack>
      </AppDrawer>

      <Dialog open={Boolean(confirmCandidate)} onClose={() => setConfirmCandidate(null)}>
        <DialogTitle>Confirmer le remplacement ?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            Le musicien indisponible ou le remplaçant est lié. Continuer va délier les cartes concernées et déplacer le remplaçant seul.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmCandidate(null)}>Annuler</Button>
          <Button variant="contained" onClick={confirmReplacement}>Continuer</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
