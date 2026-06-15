import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { JamListPage } from './JamListPage';
import { NewJamPage } from './NewJamPage';
import { JamDetailPage } from './JamDetailPage';

vi.mock('../../../shared/api/jamsApi', () => ({
  listJams: vi.fn().mockResolvedValue({ results: [{ jamId: 'jam_1', name: 'Jam du jeudi', indicativeDate: '2026-01-15', summary: { uniqueParticipantsCount: 2, playedPlateausCount: 1 } }] }),
  archiveJam: vi.fn().mockResolvedValue(null),
  createJam: vi.fn().mockResolvedValue({ jamId: 'jam_1' }),
  getJam: vi.fn().mockResolvedValue({ jam: { jamId: 'jam_1', name: 'Jam du jeudi', indicativeDate: '2026-01-15' }, snapshot: null, transactions: [{ transactionId: 'tx_1', clientSequenceNumber: 1, serverSequenceNumberStart: 1, events: [{ eventId: 'evt_1', transactionId: 'tx_1', type: 'jam_created', payload: { jamId: 'jam_1', name: 'Jam du jeudi', indicativeDate: '2026-01-15', linkReorderStrategy: 'move_to_first' }, clientSequenceNumber: 1, serverSequenceNumber: 1, eventIndexInTransaction: 0 }, { eventId: 'evt_2', transactionId: 'tx_1', type: 'instrument_added', payload: { instrumentId: 'instrument_guitar', label: 'Guitare', orderKey: 'a', visible: true, isDefault: true }, clientSequenceNumber: 1, serverSequenceNumber: 2, eventIndexInTransaction: 1 }] }] }),
  acquireClientSession: vi.fn().mockResolvedValue({ clientId: 'client_1', leaseToken: 'lease_1' }),
  releaseClientSession: vi.fn().mockResolvedValue({ status: 'released' }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useParams: () => ({ jamId: 'jam_1' }), useNavigate: () => vi.fn() };
});

function renderPage(ui) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
}

describe('jam pages', () => {
  it('renders jam list cards with explicit open and delete buttons', async () => {
    renderPage(<JamListPage />);
    expect(await screen.findByText('Jam du jeudi')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ouvrir/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /supprimer/i })).toBeInTheDocument();
  });

  it('renders the new jam form with default instruments and custom instrument input', () => {
    renderPage(<NewJamPage />);
    expect(screen.getByPlaceholderText('Nom de la jam')).toBeInTheDocument();
    expect(screen.getByLabelText('Chant')).toBeChecked();
    expect(screen.getByLabelText('Autre')).toBeChecked();
    expect(screen.getByPlaceholderText('Ajouter un instrument')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /créer la jam/i })).toBeInTheDocument();
  });

  it('adds a custom instrument inline', async () => {
    renderPage(<NewJamPage />);
    await userEvent.type(screen.getByPlaceholderText('Ajouter un instrument'), 'Saxophone');
    await userEvent.click(screen.getByRole('button', { name: /ajouter/i }));
    expect(screen.getByText(/Saxophone/)).toBeInTheDocument();
  });

  it('renders jam detail header and projected table without route debug text', async () => {
    renderPage(<JamDetailPage />);
    expect(await screen.findByRole('heading', { name: 'Jam du jeudi' })).toBeInTheDocument();
    expect(screen.getByText(/Sauvegardé sur cet appareil|Synchronisé|Synchronisation/)).toBeInTheDocument();
    expect(screen.queryByText(/route jam_1/i)).not.toBeInTheDocument();
  });

  it('opens jam configuration from the jam detail header', async () => {
    renderPage(<JamDetailPage />);
    await screen.findByRole('heading', { name: 'Jam du jeudi' });
    await userEvent.click(screen.getByLabelText('Configuration'));
    expect(await screen.findByRole('heading', { name: 'Configuration de la jam' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Jam du jeudi')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Guitare')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
