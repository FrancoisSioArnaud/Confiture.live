import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { describe, expect, it, vi } from "vitest";

import { muiTheme } from "../../../theme";
import { createJamTableUiFixture } from "../engine/uiFixtures.js";
import { projectJamTable } from "../engine/projectJamTable.js";
import JamTable from "./JamTable";

function renderJamTable(customJamState = null, customProps = {}) {
  const jamState = customJamState ?? createJamTableUiFixture();
  const projection = projectJamTable(jamState);

  const defaultProps = {
    onOpenParticipantDrawer: () => {},
  };
  const props = { ...defaultProps, ...customProps };

  const renderResult = render(
    <ThemeProvider theme={muiTheme}>
      <JamTable
        jamState={jamState}
        projection={projection}
        drawerOpen={null}
        insertionSelection={null}
        linkMode={{ active: false, source: null, selectedEntryIds: [], selectedHoleIds: [] }}
        onOpenCallDrawer={() => {}}
        onCloseDrawer={() => {}}
        onOpenParticipantDrawer={props.onOpenParticipantDrawer}
        onOpenParticipantEditDrawer={() => {}}
        onOpenWantsToPlayWithoutDrawer={() => {}}
        onOpenUnavailableReplacementDrawer={() => {}}
        onSetInsertionSelection={() => {}}
        onClearInsertionSelection={() => {}}
        onAddParticipant={() => {}}
        onUpdateParticipant={() => {}}
        onAddParticipantEntry={() => {}}
        onUpdateParticipantEntry={() => {}}
        onAddHole={() => {}}
        onRemoveHole={() => {}}
        onMarkEntryPlayed={() => {}}
        onMarkPlateauPlayed={() => {}}
        onUndoEntryPlayed={() => {}}
        onMarkParticipantLeft={() => {}}
        onWantsToPlayWithout={() => {}}
        onReplaceUnavailable={() => {}}
        onMoveEntryVertical={() => {}}
        onStartLinkMode={() => {}}
        onToggleLinkSelection={() => {}}
        onCancelLinkMode={() => {}}
        onValidateLinkMode={() => {}}
        onLinkItems={() => {}}
      />
    </ThemeProvider>,
  );

  return { ...projection, projection, ...renderResult };
}

describe("JamTable", () => {
  it("renders instrument headers only", () => {
    renderJamTable();

    expect(screen.getByRole("columnheader", { name: "Chant" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Guitare" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Basse" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Batterie" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Piano" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Autres" })).toBeInTheDocument();
  });

  it("marks a played card with a played visual state", () => {
    const { container } = renderJamTable();

    expect(screen.getAllByText("Paul").length).toBeGreaterThan(0);
    expect(container.querySelector('[data-state="played"]')).toBeInTheDocument();
  });

  it("renders loop tags", () => {
    renderJamTable();

    expect(screen.getAllByText("🔁 2").length).toBeGreaterThan(0);
  });

  it("renders a voluntary drum hole", () => {
    renderJamTable();

    expect(screen.getByText("Sans batterie")).toBeInTheDocument();
  });


  it("opens the global participant drawer without instrument preselection", () => {
    const onOpenParticipantDrawer = vi.fn();
    renderJamTable(null, { onOpenParticipantDrawer });

    fireEvent.click(screen.getByRole("button", { name: "Ajouter un participant" }));

    expect(onOpenParticipantDrawer).toHaveBeenCalledWith(null);
  });

  it("renders two left action buttons per projected row", () => {
    const projection = renderJamTable();

    expect(screen.getAllByLabelText(/Appeler le plateau/)).toHaveLength(projection.rows.length);
    expect(screen.getAllByLabelText(/Plateau joué/)).toHaveLength(projection.rows.length);
  });

  it("shows the empty participant state for a new jam table", () => {
    const onOpenParticipantDrawer = vi.fn();
    renderJamTable({
      jam: { id: "jam-empty", name: "Jam vide", indicativeDate: null },
      instruments: [{ id: "drums", name: "Batterie", order: 0, isDefault: true }],
      participants: [],
      entries: [],
      linkGroups: [],
      holes: [],
      playedPassages: [],
    }, { onOpenParticipantDrawer });

    expect(screen.getByText("Aucun participant pour l’instant.")).toBeInTheDocument();
    expect(screen.getByText("Ajoute un participant pour préparer le premier plateau.")).toBeInTheDocument();
    const addParticipantButton = screen.getByRole("button", { name: "Ajouter un participant" });
    expect(addParticipantButton).toBeInTheDocument();
    expect(addParticipantButton).toHaveTextContent("");
    fireEvent.click(addParticipantButton);
    expect(onOpenParticipantDrawer).toHaveBeenCalledWith(null);

  });

  it("uses the expected wording in the card action menu", () => {
    renderJamTable();

    fireEvent.click(screen.getAllByLabelText(/Menu /)[0]);

    expect(screen.getByRole("menuitem", { name: "Marquer comme parti" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Veux jouer sans…" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Annuler le passage" })).toBeInTheDocument();
  });

});
