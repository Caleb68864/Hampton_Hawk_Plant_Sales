import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDialog } from '../useDialog.js';
import { ConfirmModal } from '../../components/shared/ConfirmModal.js';

function Harness({ isOpen, onClose }: { isOpen: boolean; onClose?: () => void }) {
  const dialogProps = useDialog({ isOpen, onClose, labelledBy: 'h' });
  return (
    <div>
      <button type="button">Opener</button>
      {isOpen && (
        <div {...dialogProps} data-testid="panel">
          <h2 id="h">Title</h2>
          <input aria-label="first" />
          <button type="button">Second</button>
        </div>
      )}
    </div>
  );
}

describe('useDialog', () => {
  it('exposes dialog semantics and moves focus to the first focusable child', () => {
    render(<Harness isOpen onClose={vi.fn()} />);
    const panel = screen.getByRole('dialog', { name: 'Title' });
    expect(panel).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText('first')).toHaveFocus();
  });

  it('calls onClose on Escape and restores focus when it closes', () => {
    const onClose = vi.fn();
    const { rerender } = render(<Harness isOpen={false} onClose={onClose} />);
    const opener = screen.getByRole('button', { name: 'Opener' });
    opener.focus();

    rerender(<Harness isOpen onClose={onClose} />);
    expect(screen.getByLabelText('first')).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<Harness isOpen={false} onClose={onClose} />);
    expect(opener).toHaveFocus();
  });

  it('ignores Escape when no onClose is supplied (busy lock)', () => {
    render(<Harness isOpen />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('ConfirmModal', () => {
  it('is a labelled dialog that closes on Escape', () => {
    const onCancel = vi.fn();
    render(<ConfirmModal isOpen title="Delete Order" message="Sure?" onConfirm={vi.fn()} onCancel={onCancel} />);
    expect(screen.getByRole('dialog', { name: 'Delete Order' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('locks both buttons, the backdrop and Escape while busy', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmModal isOpen busy title="Delete Order" message="Sure?" confirmLabel="Delete" onConfirm={onConfirm} onCancel={onCancel} />,
    );
    const confirm = screen.getByRole('button', { name: 'Working…' });
    expect(confirm).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.click(confirm);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('confirm-backdrop'));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
