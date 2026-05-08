import { useCallback, useState } from 'react';
import { BarcodeScanner } from '../../components/mobile/BarcodeScanner.js';
import type { NormalizedScanResult } from '../../types/scanner.js';

const MAX_HISTORY = 5;

export function MobileScannerDemoPage() {
  const [history, setHistory] = useState<NormalizedScanResult[]>([]);

  const handleScan = useCallback((result: NormalizedScanResult) => {
    setHistory((prev) => [result, ...prev].slice(0, MAX_HISTORY));
  }, []);

  return (
    <div className="mobile-scanner-demo mobile-page-bg">
      <header className="mobile-scanner-demo__header">
        <h1 className="mobile-type-display">Scanner demo</h1>
        <p className="mobile-type-body">
          Foundation verification only. Last {MAX_HISTORY} accepted scans show below.
        </p>
      </header>

      <BarcodeScanner onScan={handleScan} eyebrow="Demo / Verification" />

      <section className="mobile-scanner-demo__history" aria-label="Recent scans">
        <h2 className="mobile-type-section-title">Recent scans</h2>
        {history.length === 0 ? (
          <p className="mobile-type-body">No scans yet.</p>
        ) : (
          <ol className="mobile-scanner-demo__list">
            {history.map((r, i) => (
              <li key={`${r.scannedAtUtc}-${i}`} className="mobile-scanner-demo__item">
                <div className="mobile-type-eyebrow">
                  {r.source} {r.format ? `· ${r.format}` : ''}
                </div>
                <div className="mobile-type-scan">{r.code}</div>
                <div className="mobile-type-body" style={{ fontSize: 12, opacity: 0.7 }}>
                  {r.scannedAtUtc}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <style>{`
        .mobile-scanner-demo {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .mobile-scanner-demo__header h1 { margin: 0 0 4px; }
        .mobile-scanner-demo__history {
          background: var(--joy-paper, #fff);
          border: 1px solid var(--joy-rule, #e8e0f0);
          border-radius: var(--mobile-radius, 16px);
          padding: 16px;
        }
        .mobile-scanner-demo__list {
          margin: 12px 0 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .mobile-scanner-demo__item {
          padding: 10px 12px;
          border: 1px solid var(--joy-rule, #e8e0f0);
          border-radius: var(--mobile-radius-sm, 10px);
          background: var(--color-gold-50, #fffbf0);
        }
      `}</style>
    </div>
  );
}

export default MobileScannerDemoPage;
