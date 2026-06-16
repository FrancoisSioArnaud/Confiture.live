import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { JamTable } from './JamTable';

const baseProps = {
  clientId: 'client_1',
  clientSequenceNumber: 1,
  onTransaction: vi.fn(),
  onOpenCallDrawer: vi.fn(),
  onFeedback: vi.fn(),
  onCreateParticipant: vi.fn(),
  onEditParticipant: vi.fn(),
};

function tableProjection() {
  const guitar = { instrumentId: 'instrument_guitar', label: 'Guitare', visible: true, orderKey: 'order_0' };
  return {
    jam: { jamId: 'jam_1' },
    instruments: { instrument_guitar: guitar },
    columns: [{
      instrument: guitar,
      visibleRoundCount: 1,
      cards: [{
        id: 'appearance_1',
        type: 'appearance',
        appearanceId: 'appearance_1',
        participantId: 'participant_nicolas',
        participationId: 'participation_1',
        instrumentId: 'instrument_guitar',
        appearanceIndex: 1,
        locked: false,
        played: false,
      }],
    }],
    countersByInstrument: { instrument_guitar: { notYetPlayedFirstTime: 1 } },
    playedPlateaux: {},
    links: {},
    conflicts: {},
    participants: { participant_nicolas: { participantId: 'participant_nicolas', name: 'Nicolas' } },
    participations: {},
    appearances: { appearance_1: { appearanceId: 'appearance_1', participantId: 'participant_nicolas', played: false } },
    holes: {},
  };
}

function renderTable(props = {}) {
  const mergedProps = {
    ...baseProps,
    onTransaction: vi.fn(),
    onOpenCallDrawer: vi.fn(),
    onFeedback: vi.fn(),
    onCreateParticipant: vi.fn(),
    onEditParticipant: vi.fn(),
    ...props,
  };
  render(<JamTable {...mergedProps} />);
  return mergedProps;
}

describe('JamTable empty states', () => {
  it('explains when no visible instrument column exists', () => {
    render(<JamTable {...baseProps} projection={{ jam: { jamId: 'jam_1' }, columns: [], instruments: {}, playedPlateaux: {} }} />);

    expect(screen.getByText(/aucun instrument visible/i)).toBeInTheDocument();
  });

  it('keeps visible empty columns distinct from the no-instrument state', () => {
    render(<JamTable {...baseProps} projection={{
      jam: { jamId: 'jam_1' },
      instruments: { instrument_guitar: { instrumentId: 'instrument_guitar', label: 'Guitare', visible: true, orderKey: 'order_0' } },
      columns: [{ instrument: { instrumentId: 'instrument_guitar', label: 'Guitare', visible: true, orderKey: 'order_0' }, visibleRoundCount: 1, cards: [] }],
      countersByInstrument: { instrument_guitar: { notYetPlayedFirstTime: 0 } },
      playedPlateaux: {},
      links: {},
      conflicts: {},
      participants: {},
      participations: {},
      appearances: {},
      holes: {},
    }} />);

    expect(screen.getByText('Guitare')).toBeInTheDocument();
    expect(screen.getByText('Aucun participant')).toBeInTheDocument();
    expect(screen.queryByText(/aucun instrument visible/i)).not.toBeInTheDocument();
  });
});

describe('JamTable insertion zones and compact cards', () => {
  it('replaces visible insertion labels with compact add menus', async () => {
    const user = userEvent.setup();
    renderTable({ projection: tableProjection() });

    expect(screen.queryByText('Entre les cards')).not.toBeInTheDocument();
    expect(screen.queryByText('Début de colonne')).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Ajouter un trou' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Ajouter un participant' })).not.toBeInTheDocument();

    const addButtons = screen.getAllByRole('button', { name: 'Ajouter entre les cards' });
    expect(addButtons.length).toBeGreaterThan(0);

    await user.click(addButtons[0]);

    expect(screen.getByRole('menuitem', { name: 'Ajouter un trou' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Ajouter un participant' })).toBeInTheDocument();
  });

  it('keeps add-hole and add-participant actions available from the plus menu', async () => {
    const user = userEvent.setup();
    const onTransaction = vi.fn();
    const onCreateParticipant = vi.fn();
    renderTable({ projection: tableProjection(), onTransaction, onCreateParticipant });

    await user.click(screen.getAllByRole('button', { name: 'Ajouter entre les cards' })[0]);
    await user.click(screen.getByRole('menuitem', { name: 'Ajouter un trou' }));

    expect(onTransaction).toHaveBeenCalledWith(expect.objectContaining({ label: 'Ajouter un trou' }));

    await user.click(screen.getAllByRole('button', { name: 'Ajouter entre les cards' })[0]);
    await user.click(screen.getByRole('menuitem', { name: 'Ajouter un participant' }));

    expect(onCreateParticipant).toHaveBeenCalledWith(expect.objectContaining({ instrumentId: 'instrument_guitar' }));
  });

  it('does not repeat the instrument label inside an appearance card', () => {
    renderTable({ projection: tableProjection() });

    const card = screen.getByTestId('appearance-card-appearance_1');
    expect(within(card).getByText('Nicolas')).toBeInTheDocument();
    expect(within(card).queryByText('Guitare')).not.toBeInTheDocument();
  });

  it('keeps direct card actions and renders the desktop drag handle outside the action row', () => {
    renderTable({ projection: tableProjection() });

    const card = screen.getByTestId('appearance-card-appearance_1');
    const actionButtons = within(card).getAllByRole('button', { name: /card|verrouiller|menu/i });

    expect(within(card).getByRole('button', { name: 'Card non liée' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Verrouiller' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Menu card' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Déplacer verticalement' })).toBeInTheDocument();
    expect(actionButtons).toHaveLength(3);
  });
});
