import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { muiTheme } from "../../../theme";
import JamsListPage from "./JamsListPage";

vi.mock("../../../shared/api/jamsApi", () => ({
  fetchJams: vi.fn(async () => ([
    { id: 2, name: "Jam sans date", indicative_date: null, unique_musicians_count: 0, participant_entries_count: 0, played_plateaus_count: 0 },
    { id: 1, name: "Jam datée", indicative_date: "2026-06-12", unique_musicians_count: 3, participant_entries_count: 4, played_plateaus_count: 1 },
  ])),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: "/", element: <JamsListPage /> }], { initialEntries: ["/"] });
  render(
    <ThemeProvider theme={muiTheme}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

describe("JamsListPage", () => {
  it("renders backend jams", async () => {
    renderPage();

    expect(await screen.findByText("Jam datée")).toBeInTheDocument();
    expect(screen.getByText("Jam sans date")).toBeInTheDocument();
    expect(screen.getByText(/3 musiciens/)).toBeInTheDocument();
  });
});
