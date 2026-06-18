import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import * as jamsApi from '../../../shared/api/jamsApi';
import { JamListPage } from './JamListPage';
import { NewJamPage } from './NewJamPage';
import { JamDetailPage } from './JamDetailPage';
import { getLocalTransactions, resetLocalDbForTests } from '../../sync/localDb';
import { resetSyncStatusForTests, setSyncStatus, SYNC_STATUS } from '../../sync/syncStatus';

const mockedNavigate = vi.hoisted(() => vi.fn());

vi.mock('../../../shared/api/jamsApi', () => ({
  listJams: vi.fn().mockResolvedValue({ results: [{ jamId: 'jam_1', name: 'Jam du jeudi', indicativeDate: '2026-01-15', summary: { uniqueParticipantsCount: 2, playedPlateausCount: 1 } }] }),
  archiveJam: vi.fn().mockResolvedValue(null),
  createJam: vi.fn().mockResolvedValue({ jamId: 'jam_1', latestServerSequenceNumber: 2, transactionAck: { transactionId: 'transaction_test', serverSequenceNumberStart: 1, serverSequenceNumberEnd: 2 } }),
  getJam: vi.fn().mockResolvedValue({ jam: { jamId: 'jam_1', name: 'Jam du jeudi', indicativeDate: '2026-01-15' }, snapshot: null, transactions: [{ transactionId: 'tx_1', clientSequenceNumber: 1, serverSequenceNumberStart: 1, events: [{ eventId: 'evt_1', transactionId: 'tx_1', type: 'jam_created', payload: { jamId: 'jam_1', name: 'Jam du jeudi', indicativeDate: '2026-01-15', linkReorderStrategy: 'move_to_first' }, clientSequenceNumber: 1, serverSequenceNumber: 1, eventIndexInTransaction: 0 }, { eventId: 'evt_2', transactionId: 'tx_1', type: 'instrument_added', payload: { instrumentId: 'instrument_guitar', label: 'Guitare', orderKey: 'a', visible: true, isDefault: true }, clientSequenceNumber: 1, serverSequenceNumber: 2, eventIndexInTransaction: 1 }] }] }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useParams: () => ({ jamId: 'jam_1' }), useNavigate: () => mockedNavigate };
});

function renderPage(ui) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
}

describe('jam pages', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetLocalDbForTests();
    resetSyncStatusForTests();
  });

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

  it('does not navigate to a local-only jam when backend creation fails', async () => {
    jamsApi.createJam.mockRejectedValueOnce(new Error('server down'));

    renderPage(<NewJamPage />);
    await userEvent.type(screen.getByPlaceholderText('Nom de la jam'), 'Jam en panne');
    await userEvent.click(screen.getByRole('button', { name: /créer la jam/i }));

    expect(await screen.findByText(/impossible de créer la jam côté serveur/i)).toBeInTheDocument();
    expect(mockedNavigate).not.toHaveBeenCalled();

    const { transaction } = jamsApi.createJam.mock.calls[0][0];
    await expect(getLocalTransactions(transaction.jamId)).resolves.toEqual([]);
  });

  it('navigates to the created jam only after backend creation succeeds', async () => {
    renderPage(<NewJamPage />);
    await userEvent.type(screen.getByPlaceholderText('Nom de la jam'), 'Jam OK');
    await userEvent.click(screen.getByRole('button', { name: /créer la jam/i }));

    await waitFor(() => expect(mockedNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/jams\/jam_/)));
  });

  it('sends a null indicative date and respects initial instrument reorder', async () => {
    renderPage(<NewJamPage />);
    await userEvent.type(screen.getByPlaceholderText('Nom de la jam'), 'Jam sans date');
    await userEvent.click(screen.getByRole('button', { name: 'Descendre Chant' }));
    await userEvent.click(screen.getByRole('button', { name: /créer la jam/i }));

    await waitFor(() => expect(jamsApi.createJam).toHaveBeenCalled());
    const { transaction } = jamsApi.createJam.mock.calls[0][0];
    expect(transaction.events[0]).toMatchObject({ type: 'jam_created', payload: { indicativeDate: null } });
    expect(transaction.events.filter((event) => event.type === 'instrument_added').map((event) => event.payload.label).slice(0, 2)).toEqual(['Guitare', 'Chant']);
  });

  it('renders jam detail header and projected table without route debug text', async () => {
    renderPage(<JamDetailPage />);
    expect(await screen.findByRole('heading', { name: 'Jam du jeudi' })).toBeInTheDocument();
    expect(screen.getByText(/Sauvegardé sur cet appareil|Synchronisé|Synchronisation/)).toBeInTheDocument();
    expect(screen.queryByText(/route jam_1/i)).not.toBeInTheDocument();
  });

  it('updates the sync status indicator when the vanilla sync store changes after a successful push', async () => {
    renderPage(<JamDetailPage />);
    expect(await screen.findByRole('heading', { name: 'Jam du jeudi' })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Synchronisé')).toBeInTheDocument());

    setSyncStatus('jam_1', { status: SYNC_STATUS.PENDING, pendingCount: 1 });
    await waitFor(() => expect(screen.getByText('Synchronisation en attente')).toBeInTheDocument());

    setSyncStatus('jam_1', { status: SYNC_STATUS.SYNCED, pendingCount: 0 });
    await waitFor(() => expect(screen.getByText('Synchronisé')).toBeInTheDocument());
  });

  it('does not call client session APIs when the jam API returns 404', async () => {
    const notFound = new Error('HTTP 404');
    notFound.status = 404;
    jamsApi.getJam.mockRejectedValueOnce(notFound);

    renderPage(<JamDetailPage />);

    expect(await screen.findByText(/impossible de charger cette jam/i)).toBeInTheDocument();
  });

  it('opens jam configuration from the jam detail header', async () => {
    renderPage(<JamDetailPage />);
    await screen.findByRole('heading', { name: 'Jam du jeudi' });
    await userEvent.click(screen.getByRole('button', { name: 'Configuration' }));
    expect(await screen.findByRole('heading', { name: 'Configuration de la jam' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Jam du jeudi')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Guitare')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

});
