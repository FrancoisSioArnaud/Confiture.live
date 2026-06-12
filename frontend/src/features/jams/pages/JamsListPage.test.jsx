import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { muiTheme } from "../../../theme";
import { deleteJam } from "../../../shared/api/jamsApi";
import JamsListPage from "./JamsListPage";

vi.mock("../../../shared/api/jamsApi", () => ({
  deleteJam: vi.fn(async () => undefined),
  fetchJams: vi.fn(async () => ([
    { id: 2, name: "Jam sans date", indicative_date: null, unique_musicians_count: 0, participant_entries_count: 0, played_plateaus_count: 0 },
    { id: 1, name: "Jam datée", indicative_date: "2026-06-12", unique_musicians_count: 3, participant_entries_count: 4, played_plateaus_count: 1 },
  ])),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter([
    { path: "/", element: <JamsListPage /> },
    { path: "/jams/:jamId", element: <div>Jam ouverte</div> },
  ], { initialEntries: ["/"] });
  render(
    <ThemeProvider theme={muiTheme}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

describe("JamsListPage", () => {
  beforeEach(() => {
    deleteJam.mockClear();
  });

  it("renders backend jams with explicit open and delete actions", async () => {
    renderPage();

    const jamTitle = await screen.findByText("Jam datée");

    expect(jamTitle).toBeInTheDocument();
    expect(screen.getByText("Jam sans date")).toBeInTheDocument();
    expect(screen.getByText(/3 musiciens/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Ouvrir" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Supprimer Jam datée" })).toBeInTheDocument();
    expect(jamTitle.closest("a")).toBeNull();
  });

  it("confirms and cancels jam deletion in a dialog", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Supprimer Jam datée" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Supprimer cette jam ?")).toBeInTheDocument();
    expect(screen.getByText("La jam “Jam datée” sera supprimée définitivement.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(deleteJam).not.toHaveBeenCalled();
  });

  it("calls the delete API after confirming jam deletion", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Supprimer Jam datée" }));
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));

    await waitFor(() => {
      expect(deleteJam).toHaveBeenCalledWith(1, expect.anything());
    });
  });
});
