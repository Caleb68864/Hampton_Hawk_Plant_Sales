import '@testing-library/jest-dom';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ScanInput } from '../ScanInput.js';

describe('ScanInput stray-keystroke recapture', () => {
  afterEach(() => cleanup());

  it('routes a wedge scan that starts while a button has focus into the buffer', () => {
    const onScan = vi.fn();
    render(
      <div>
        <button type="button">×7 preset</button>
        <ScanInput onScan={onScan} />
      </div>,
    );
    const input = screen.getByPlaceholderText('Scan barcode or type SKU...') as HTMLInputElement;
    const button = screen.getByText('×7 preset');

    button.focus();
    expect(document.activeElement).toBe(button);

    // First digit of the barcode arrives on the button: it must be captured
    // (not swallowed) and focus must move to the input so the browser delivers
    // the rest of the scan there natively.
    fireEvent.keyDown(window, { key: '0' });
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('0');

    // Remaining digits are typed into the (now focused) input by the browser.
    fireEvent.change(input, { target: { value: '000000000047' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onScan).toHaveBeenCalledWith('000000000047');
    expect(input.value).toBe('');
  });

  it('submits a buffered scan when the scanner Enter arrives on a button', () => {
    const onScan = vi.fn();
    render(
      <div>
        <button type="button">Complete Order</button>
        <ScanInput onScan={onScan} />
      </div>,
    );
    const input = screen.getByPlaceholderText('Scan barcode or type SKU...') as HTMLInputElement;
    const button = screen.getByText('Complete Order');

    fireEvent.change(input, { target: { value: 'PL-77' } });
    button.focus();

    const enter = fireEvent.keyDown(window, { key: 'Enter' });

    // Default action (re-clicking the focused button) is suppressed.
    expect(enter).toBe(false);
    expect(onScan).toHaveBeenCalledWith('PL-77');
    expect(document.activeElement).toBe(input);
  });

  it('routes keystrokes that land on <body> into the buffer', () => {
    const onScan = vi.fn();
    render(<ScanInput onScan={onScan} />);
    const input = screen.getByPlaceholderText('Scan barcode or type SKU...') as HTMLInputElement;

    input.blur();
    expect(document.activeElement).toBe(document.body);

    fireEvent.keyDown(window, { key: 'P' });
    expect(input.value).toBe('P');
    expect(document.activeElement).toBe(input);
  });

  it('leaves keystrokes alone when another text control is focused', () => {
    const onScan = vi.fn();
    render(
      <div>
        <textarea aria-label="reason" />
        <ScanInput onScan={onScan} />
      </div>,
    );
    const input = screen.getByPlaceholderText('Scan barcode or type SKU...') as HTMLInputElement;
    const reason = screen.getByLabelText('reason');

    reason.focus();
    fireEvent.keyDown(window, { key: '4' });
    fireEvent.keyDown(window, { key: '2' });
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(input.value).toBe('');
    expect(document.activeElement).toBe(reason);
    expect(onScan).not.toHaveBeenCalled();
  });

  it('does not recapture while disabled', () => {
    const onScan = vi.fn();
    render(<ScanInput onScan={onScan} disabled />);
    const input = screen.getByPlaceholderText('Scan barcode or type SKU...') as HTMLInputElement;

    fireEvent.keyDown(window, { key: '1' });
    expect(input.value).toBe('');
    expect(onScan).not.toHaveBeenCalled();
  });

  it('ignores modified keys (shortcuts) and non-printable keys', () => {
    const onScan = vi.fn();
    render(<ScanInput onScan={onScan} />);
    const input = screen.getByPlaceholderText('Scan barcode or type SKU...') as HTMLInputElement;
    input.blur();

    fireEvent.keyDown(window, { key: 'r', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'Tab' });
    fireEvent.keyDown(window, { key: 'ArrowDown' });

    expect(input.value).toBe('');
  });

  it('still submits from the input itself on Enter', () => {
    const onScan = vi.fn();
    render(<ScanInput onScan={onScan} />);
    const input = screen.getByPlaceholderText('Scan barcode or type SKU...') as HTMLInputElement;

    fireEvent.change(input, { target: { value: ' PL-9 ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onScan).toHaveBeenCalledWith('PL-9');
    expect(input.value).toBe('');
  });
});

describe('ScanInput duplicate-read window', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function scan(input: HTMLInputElement, code: string) {
    fireEvent.change(input, { target: { value: code } });
    fireEvent.keyDown(input, { key: 'Enter' });
  }

  it('counts two identical scans made at human speed (0.7 s apart)', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(10_000);
    const onScan = vi.fn();
    render(<ScanInput onScan={onScan} />);
    const input = screen.getByPlaceholderText('Scan barcode or type SKU...') as HTMLInputElement;

    scan(input, 'PL-1');
    now.mockReturnValue(10_700);
    scan(input, 'PL-1');

    expect(onScan).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('drops a hardware double-read and tells the volunteer', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(10_000);
    const onScan = vi.fn();
    const onDup = vi.fn();
    render(<ScanInput onScan={onScan} onDuplicateIgnored={onDup} />);
    const input = screen.getByPlaceholderText('Scan barcode or type SKU...') as HTMLInputElement;

    scan(input, 'PL-1');
    now.mockReturnValue(10_050);
    scan(input, 'PL-1');

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onDup).toHaveBeenCalledWith('PL-1');
    expect(screen.getByRole('status').textContent).toMatch(/ignored/);

    // The next accepted scan clears the notice.
    scan(input, 'PL-2');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('never drops a different barcode, however fast', () => {
    vi.spyOn(Date, 'now').mockReturnValue(10_000);
    const onScan = vi.fn();
    render(<ScanInput onScan={onScan} />);
    const input = screen.getByPlaceholderText('Scan barcode or type SKU...') as HTMLInputElement;
    scan(input, 'PL-1');
    scan(input, 'PL-2');
    expect(onScan).toHaveBeenCalledTimes(2);
  });
});
