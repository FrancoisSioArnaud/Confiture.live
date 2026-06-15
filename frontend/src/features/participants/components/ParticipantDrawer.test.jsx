import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ParticipantDrawer } from './ParticipantDrawer';

const projection = {
  jam: { jamId: 'jam_1', linkReorderStrategy: 'move_to_last' },
  instruments: {
    instrument_guitar: { instrumentId: 'instrument_guitar', label: 'Guitare', orderKey: 'b', visible: true },
    instrument_vocals: { instrumentId: 'instrument_vocals', label: 'Chant', orderKey: 'a', visible: true },
    instrument_hidden: { instrumentId: 'instrument_hidden', label: 'Masqué', orderKey: 'c', visible: false },
    instrument_other: { instrumentId: 'instrument_other', label: 'Autre', orderKey: 'd', visible: true },
  },
  participants: {},
  participations: {},
  appearances: {},
  links: {},
  conflicts: {},
};

function renderDrawer(props = {}) {
  const onTransaction = vi.fn();
  const onClose = vi.fn();
  render(
    <ParticipantDrawer
      open
      mode="create"
      projection={projection}
      clientId="client_1"
      clientSequenceNumber={1}
      onClose={onClose}
      onTransaction={onTransaction}
      {...props}
    />,
  );
  return { onTransaction, onClose };
}

describe('ParticipantDrawer', () => {
  it('renders visible instruments ordered by orderKey and excludes hidden instruments', () => {
    renderDrawer();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.map((checkbox) => checkbox.closest('label')?.textContent)).toEqual(['Chant', 'Guitare', 'Autre']);
    expect(screen.queryByLabelText('Masqué')).not.toBeInTheDocument();
  });

  it('preselects the insertion context instrument', () => {
    renderDrawer({ insertionContext: { instrumentId: 'instrument_guitar', appearanceIndex: 1 } });
    expect(screen.getByLabelText('Guitare')).toBeChecked();
  });

  it('refuses creation without a name', async () => {
    const { onTransaction } = renderDrawer();
    await userEvent.click(screen.getByLabelText('Chant'));
    await userEvent.click(screen.getByRole('button', { name: /ajouter le musicien/i }));
    expect(await screen.findByText('Nom requis')).toBeInTheDocument();
    expect(onTransaction).not.toHaveBeenCalled();
  });

  it('refuses creation without an instrument', async () => {
    const { onTransaction, onClose } = renderDrawer();
    await userEvent.type(screen.getByLabelText('Nom du musicien'), 'Nico');
    await userEvent.click(screen.getByRole('button', { name: /ajouter le musicien/i }));
    expect(await screen.findByText('Au moins un instrument doit être sélectionné.')).toBeInTheDocument();
    expect(onTransaction).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('refuses selected Autre without precision', async () => {
    const { onTransaction } = renderDrawer();
    await userEvent.type(screen.getByLabelText('Nom du musicien'), 'Nico');
    await userEvent.click(screen.getByLabelText('Autre'));
    await userEvent.click(screen.getByRole('button', { name: /ajouter le musicien/i }));
    expect(await screen.findByText('Précise l’instrument “Autre”.')).toBeInTheDocument();
    expect(onTransaction).not.toHaveBeenCalled();
  });

  it('creates an event-sourced transaction with one participation per selected instrument and a default conflict', async () => {
    const { onTransaction, onClose } = renderDrawer();
    await userEvent.type(screen.getByLabelText('Nom du musicien'), 'Nico');
    await userEvent.click(screen.getByLabelText('Chant'));
    await userEvent.click(screen.getByLabelText('Guitare'));
    await userEvent.click(screen.getByRole('button', { name: /ajouter le musicien/i }));
    expect(onTransaction).toHaveBeenCalledTimes(1);
    expect(onTransaction.mock.calls[0][0].events.map((event) => event.type)).toEqual(['participant_created', 'participation_added', 'participation_added', 'conflict_created']);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows initial pair choices and creates a link when a pair is checked', async () => {
    const { onTransaction } = renderDrawer();
    await userEvent.type(screen.getByLabelText('Nom du musicien'), 'Nico');
    await userEvent.click(screen.getByLabelText('Chant'));
    await userEvent.click(screen.getByLabelText('Guitare'));
    expect(screen.getByText('Faire passer ensemble')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Chant + Guitare'));
    await userEvent.click(screen.getByRole('button', { name: /ajouter le musicien/i }));
    expect(onTransaction.mock.calls[0][0].events.map((event) => event.type)).toEqual(['participant_created', 'participation_added', 'participation_added', 'appearance_materialized', 'appearance_materialized', 'link_created']);
  });

  it('prechecks existing instruments in edit mode and emits participant update plus added/removed instruments', async () => {
    const editProjection = {
      ...projection,
      participants: { participant_1: { participantId: 'participant_1', name: 'Nico', status: 'active' } },
      participations: { participation_vocals: { participationId: 'participation_vocals', participantId: 'participant_1', instrumentId: 'instrument_vocals', status: 'active', startAppearanceIndex: 1, baseOrderKey: 'position_vocals' } },
    };
    const { onTransaction } = renderDrawer({ mode: 'edit', projection: editProjection, participantId: 'participant_1' });
    expect(screen.getByLabelText('Chant')).toBeChecked();
    await userEvent.clear(screen.getByLabelText('Nom du musicien'));
    await userEvent.type(screen.getByLabelText('Nom du musicien'), 'Nicolas');
    await userEvent.click(screen.getByLabelText('Chant'));
    await userEvent.click(screen.getByLabelText('Guitare'));
    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }));
    expect(onTransaction.mock.calls[0][0].events.map((event) => event.type)).toEqual(['participant_updated', 'participation_added', 'participation_removed']);
  });
});
