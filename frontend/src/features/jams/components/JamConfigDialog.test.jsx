import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { JamConfigDialog } from './JamConfigDialog';

const projection = {
  jam: { jamId: 'jam_1', name: 'Jam du jeudi', indicativeDate: '2026-01-15', linkReorderStrategy: 'move_to_first' },
  instruments: {
    instrument_vocals: { instrumentId: 'instrument_vocals', label: 'Chant', orderKey: 'a', visible: true },
    instrument_guitar: { instrumentId: 'instrument_guitar', label: 'Guitare', orderKey: 'b', visible: true },
  },
  participations: {},
  appearances: {},
  holes: {},
  links: {},
};

function renderDialog(props = {}) {
  const onTransaction = vi.fn();
  const onClose = vi.fn();
  render(
    <JamConfigDialog
      open
      projection={projection}
      clientId="client_1"
      clientSequenceNumber={2}
      onClose={onClose}
      onTransaction={onTransaction}
      {...props}
    />,
  );
  return { onTransaction, onClose };
}

describe('JamConfigDialog', () => {
  it('prefills jam name, date, strategy and existing instruments', () => {
    renderDialog();
    expect(screen.getByDisplayValue('Jam du jeudi')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-01-15')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveTextContent('Déplacer vers le premier');
    expect(screen.getByDisplayValue('Chant')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Guitare')).toBeInTheDocument();
  });

  it('closes without transaction when saving an unchanged draft', async () => {
    const { onTransaction, onClose } = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }));
    expect(onTransaction).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('applies a transaction for name, added, renamed, hidden and reordered instruments', async () => {
    const { onTransaction, onClose } = renderDialog();
    await userEvent.clear(screen.getByLabelText('Nom'));
    await userEvent.type(screen.getByLabelText('Nom'), 'Jam modifiée');
    const guitarInput = screen.getByDisplayValue('Guitare');
    await userEvent.clear(guitarInput);
    await userEvent.type(guitarInput, 'Guitare lead');
    await userEvent.type(screen.getByPlaceholderText('Ajouter un instrument'), 'Saxophone');
    await userEvent.click(screen.getByRole('button', { name: /^ajouter$/i }));
    await userEvent.click(screen.getAllByRole('button', { name: /masquer/i })[0]);
    await userEvent.click(screen.getAllByLabelText('Descendre')[0]);
    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }));

    expect(onTransaction).toHaveBeenCalledTimes(1);
    expect(onTransaction.mock.calls[0][0].events.map((event) => event.type)).toEqual([
      'jam_updated',
      'instrument_updated',
      'instrument_visibility_changed',
      'instrument_added',
      'instruments_reordered',
    ]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
