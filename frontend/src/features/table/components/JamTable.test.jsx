import { render, screen } from '@testing-library/react';
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
