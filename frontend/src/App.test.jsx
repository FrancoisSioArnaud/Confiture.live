import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { App } from './App';
import { JamListPage } from './features/jams/pages/JamListPage';

vi.mock('./shared/api/jamsApi', () => ({
  listJams: vi.fn().mockResolvedValue({ results: [] }),
  archiveJam: vi.fn().mockResolvedValue(null),
}));

function renderWithProviders(ui) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('App shell', () => {
  it('renders the jams landing page', async () => {
    const router = createMemoryRouter([{ path: '/', element: <App />, children: [{ index: true, element: <JamListPage /> }] }]);
    renderWithProviders(<RouterProvider router={router} />);
    expect(await screen.findByRole('heading', { name: 'Jams' })).toBeInTheDocument();
    expect(await screen.findByText('Aucune jam créée pour l’instant.')).toBeInTheDocument();
  });
});
