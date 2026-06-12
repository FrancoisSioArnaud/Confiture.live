import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { muiTheme } from "../../../theme";
import ParticipantFormDrawer from "../../participants/components/ParticipantFormDrawer";
import JamFormPage from "../../jams/pages/JamFormPage";
import { createJamTableUiFixture } from "../engine/uiFixtures.js";
import { projectJamTable } from "../engine/projectJamTable.js";
import { useJamTableStore } from "../store/useJamTableStore.js";
import CallPlateauDrawer from "./CallPlateauDrawer";
import InsertBetweenCardsDialog from "./InsertBetweenCardsDialog";
import WantsToPlayWithoutDrawer from "./WantsToPlayWithoutDrawer";

function renderWithTheme(ui) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <ThemeProvider theme={muiTheme}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          {ui}
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

describe("V0 drawers", () => {
  it("blocks a duplicate participant name", async () => {
    const jamState = createJamTableUiFixture();

    renderWithTheme(
      <ParticipantFormDrawer
        open
        onClose={() => {}}
        jamState={jamState}
        insertionSelection={null}
        onAddParticipant={() => {}}
        onLinkItems={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Sarah" } });
    fireEvent.click(screen.getByLabelText("Chant"));
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));

    expect(await screen.findByText("Ce nom existe déjà dans cette jam. Ajoute une initiale ou un détail.")).toBeInTheDocument();
  });

  it("InsertBetweenCardsDialog calls the selected action", () => {
    const onAddParticipant = vi.fn();
    const onAddHole = vi.fn();

    renderWithTheme(
      <InsertBetweenCardsDialog
        open
        selection={{ rowIndex: 1, column: { name: "Batterie", instrumentId: "drums" } }}
        onClose={() => {}}
        onAddParticipant={onAddParticipant}
        onAddHole={onAddHole}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ajouter un trou" }));
    expect(onAddHole).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Ajouter un participant" }));
    expect(onAddParticipant).toHaveBeenCalledTimes(1);
  });

  it("CallPlateauDrawer displays the musicians in a row", () => {
    const projection = projectJamTable(createJamTableUiFixture());

    renderWithTheme(
      <CallPlateauDrawer
        open
        row={projection.rows[1]}
        columns={projection.columns}
        onClose={() => {}}
        onMarkEntryPlayed={() => {}}
        onMarkPlateauPlayed={() => {}}
        onUnavailable={() => {}}
      />,
    );

    expect(screen.getByText("Maya")).toBeInTheDocument();
    expect(screen.getByText("Nicolas")).toBeInTheDocument();
  });

  it("WantsToPlayWithoutDrawer validates multiple instruments", () => {
    const projection = projectJamTable(createJamTableUiFixture());
    const cell = projection.rows[1].cells.guitar;
    const onValidate = vi.fn();

    renderWithTheme(
      <WantsToPlayWithoutDrawer
        open
        cell={cell}
        columns={projection.columns}
        onClose={() => {}}
        onValidate={onValidate}
      />,
    );

    fireEvent.click(screen.getByLabelText("Chant"));
    fireEvent.click(screen.getByLabelText("Batterie"));
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));

    expect(onValidate).toHaveBeenCalledWith({ entryId: cell.entryId, instrumentIds: ["vocal", "drums"] });
  });

  it("JamFormPage shows stats in edit mode", () => {
    useJamTableStore.getState().loadFixtureJam();

    renderWithTheme(<JamFormPage mode="edit" />);

    expect(screen.getByText("Stats")).toBeInTheDocument();
    expect(screen.getByText(/musiciens uniques/)).toBeInTheDocument();
    expect(screen.getByText(/participations instrumentales/)).toBeInTheDocument();
    expect(screen.getByText(/plateaux joués/)).toBeInTheDocument();
  });
});
