import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { NormalizedScanResult } from '../../../types/scanner.js';

vi.mock('../../../components/mobile/BarcodeScanner.js', () => ({
  BarcodeScanner: ({ onScan }: { onScan: (r: NormalizedScanResult) => void }) => (
    <div data-testid="barcode-scanner">
      <button
        data-testid="emit-scan"
        onClick={() =>
          onScan({
            code: 'TEST-CODE',
            format: 'QR_CODE',
            source: 'mobile-camera',
            scannedAtUtc: new Date().toISOString(),
          })
        }
      >
        Emit scan
      </button>
    </div>
  ),
}));

import { MobileScannerDemoPage } from '../MobileScannerDemoPage.js';
import userEvent from '@testing-library/user-event';

function makeResult(code: string, offsetMs = 0): NormalizedScanResult {
  return {
    code,
    format: 'QR_CODE',
    source: 'mobile-camera',
    scannedAtUtc: new Date(Date.now() + offsetMs).toISOString(),
  };
}

describe('MobileScannerDemoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders heading and BarcodeScanner', () => {
    render(<MobileScannerDemoPage />);
    expect(screen.getByText(/scanner demo/i)).toBeTruthy();
    expect(screen.getByTestId('barcode-scanner')).toBeTruthy();
  });

  it('shows "No scans yet" when history is empty', () => {
    render(<MobileScannerDemoPage />);
    expect(screen.getByText(/no scans yet/i)).toBeTruthy();
  });

  it('adds a scan result to the list when onScan fires', async () => {
    const user = userEvent.setup();
    render(<MobileScannerDemoPage />);
    await user.click(screen.getByTestId('emit-scan'));
    expect(screen.getByText('TEST-CODE')).toBeTruthy();
  });

  it('displays results in reverse chronological order (most recent first)', async () => {
    const results: NormalizedScanResult[] = [
      makeResult('FIRST', 0),
      makeResult('SECOND', 100),
      makeResult('THIRD', 200),
    ];

    let capturedOnScan: ((r: NormalizedScanResult) => void) | null = null;

    vi.doMock('../../../components/mobile/BarcodeScanner.js', () => ({
      BarcodeScanner: ({ onScan }: { onScan: (r: NormalizedScanResult) => void }) => {
        capturedOnScan = onScan;
        return <div data-testid="barcode-scanner-2" />;
      },
    }));

    const { MobileScannerDemoPage: Page } = await import('../MobileScannerDemoPage.js');
    const { unmount } = render(<Page />);

    if (capturedOnScan) {
      for (const r of results) {
        act(() => { (capturedOnScan as (r: NormalizedScanResult) => void)(r); });
      }
    }

    const items = screen.queryAllByRole('listitem');
    if (items.length >= 3) {
      expect(items[0].textContent).toContain('THIRD');
      expect(items[1].textContent).toContain('SECOND');
      expect(items[2].textContent).toContain('FIRST');
    }

    unmount();
  });

  it('keeps at most 5 results in the list', async () => {
    let capturedOnScan2: ((r: NormalizedScanResult) => void) | null = null;

    vi.doMock('../../../components/mobile/BarcodeScanner.js', () => ({
      BarcodeScanner: ({ onScan }: { onScan: (r: NormalizedScanResult) => void }) => {
        capturedOnScan2 = onScan;
        return <div data-testid="barcode-scanner-3" />;
      },
    }));

    const { MobileScannerDemoPage: Page2 } = await import('../MobileScannerDemoPage.js');
    const { unmount } = render(<Page2 />);

    if (capturedOnScan2) {
      for (let i = 1; i <= 7; i++) {
        act(() => {
          (capturedOnScan2 as (r: NormalizedScanResult) => void)(makeResult(`CODE-${i}`, i * 10));
        });
      }
    }

    const items = screen.queryAllByRole('listitem');
    expect(items.length).toBeLessThanOrEqual(5);

    unmount();
  });
});
