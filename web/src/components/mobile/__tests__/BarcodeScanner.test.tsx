import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BarcodeScanner } from '../BarcodeScanner.js';
import type { BarcodeScannerOptions, BarcodeScannerResult } from '../../../hooks/useBarcodeScanner.js';
import type { ScannerError, ScannerStatus, CameraDevice } from '../../../types/scanner.js';

interface MockState {
  status: ScannerStatus;
  error: ScannerError | null;
  torchSupported: boolean;
  devices: CameraDevice[];
  capturedOnScan: BarcodeScannerOptions['onScan'] | null;
}

const mockState: MockState = {
  status: 'active',
  error: null,
  torchSupported: false,
  devices: [],
  capturedOnScan: null,
};

vi.mock('../../../hooks/useBarcodeScanner.js', () => ({
  useBarcodeScanner: (opts: BarcodeScannerOptions): BarcodeScannerResult => {
    mockState.capturedOnScan = opts.onScan;
    return {
      status: mockState.status,
      error: mockState.error,
      devices: mockState.devices,
      selectedDeviceId: mockState.devices[0]?.deviceId ?? null,
      torchSupported: mockState.torchSupported,
      torchOn: false,
      lastResult: null,
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
      switchDevice: vi.fn().mockResolvedValue(undefined),
      toggleTorch: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      resume: vi.fn(),
    };
  },
}));

describe('BarcodeScanner', () => {
  beforeEach(() => {
    mockState.status = 'active';
    mockState.error = null;
    mockState.torchSupported = false;
    mockState.devices = [];
    mockState.capturedOnScan = null;
  });

  it('emits source: "mobile-camera" with format and ISO scannedAtUtc when hook decodes', () => {
    const onScan = vi.fn();
    render(<BarcodeScanner onScan={onScan} />);
    expect(mockState.capturedOnScan).not.toBeNull();
    act(() => {
      mockState.capturedOnScan?.({
        code: 'TEST123',
        format: 'qr-code',
        source: 'mobile-camera',
        scannedAtUtc: new Date().toISOString(),
      });
    });
    expect(onScan).toHaveBeenCalledTimes(1);
    const call = onScan.mock.calls[0][0];
    expect(call.source).toBe('mobile-camera');
    expect(call.format).toBe('qr-code');
    expect(call.code).toBe('TEST123');
    expect(() => new Date(call.scannedAtUtc).toISOString()).not.toThrow();
    expect(call.scannedAtUtc).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('renders Fraunces empty-state and keeps manual entry operable on permission-denied', () => {
    mockState.status = 'error';
    mockState.error = { kind: 'permission-denied', message: 'denied' };
    const onScan = vi.fn();
    render(<BarcodeScanner onScan={onScan} />);
    expect(screen.getByText(/Camera permission needed/i)).toBeInTheDocument();
    const input = screen.getByLabelText(/Manual scan entry/i) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'ABCD' } });
    fireEvent.submit(input.closest('form')!);
    expect(onScan).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ABCD', source: 'manual-entry' })
    );
  });

  it('manual-entry submission emits source: "manual-entry" with trimmed value', () => {
    const onScan = vi.fn();
    render(<BarcodeScanner onScan={onScan} />);
    const input = screen.getByLabelText(/Manual scan entry/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ORDER-99   ' } });
    fireEvent.submit(input.closest('form')!);
    expect(onScan).toHaveBeenCalledTimes(1);
    const arg = onScan.mock.calls[0][0];
    expect(arg.code).toBe('ORDER-99');
    expect(arg.source).toBe('manual-entry');
    expect(arg.format).toBeUndefined();
    expect(arg.scannedAtUtc).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('does not render torch button when torchSupported is false', () => {
    mockState.torchSupported = false;
    render(<BarcodeScanner onScan={() => undefined} />);
    expect(screen.queryByRole('button', { name: /toggle torch/i })).toBeNull();
  });

  it('renders torch button when torchSupported is true', () => {
    mockState.torchSupported = true;
    render(<BarcodeScanner onScan={() => undefined} />);
    expect(screen.getByRole('button', { name: /toggle torch/i })).toBeInTheDocument();
  });
});
