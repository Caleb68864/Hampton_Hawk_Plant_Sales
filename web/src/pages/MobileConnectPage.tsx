import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';

function buildMobileUrl(): string {
  if (typeof window === 'undefined') return '/mobile';
  const { protocol, host } = window.location;
  return `${protocol}//${host}/mobile`;
}

function isHttpsOrLocalhost(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:') return true;
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
    return false;
  } catch {
    return false;
  }
}

export function MobileConnectPage() {
  const [mobileUrl, setMobileUrl] = useState<string>(() => buildMobileUrl());
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cameraReady = useMemo(() => isHttpsOrLocalhost(mobileUrl), [mobileUrl]);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(mobileUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: { dark: '#2d1152', light: '#ffffff' },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render QR');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mobileUrl]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-2">
      <header className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-gold-700">
          Mobile Connect
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-hawk-800">
          Pair a phone with this app
        </h1>
        <p className="text-sm text-hawk-700">
          Scan the QR code from your phone&apos;s camera (or paste the URL into the
          phone&apos;s browser) to open the volunteer mobile experience.
        </p>
      </header>

      <section
        className="joy-shadow-plum rounded-2xl border border-gold-200 bg-[color:var(--joy-paper)] p-6"
        aria-labelledby="mc-qr-title"
      >
        <h2 id="mc-qr-title" className="sr-only">
          QR code for mobile URL
        </h2>
        <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
          <div className="flex h-[340px] w-[340px] items-center justify-center rounded-xl border border-gold-200 bg-white p-2">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR code for ${mobileUrl}`}
                className="h-full w-full"
              />
            ) : error ? (
              <p className="px-4 text-center text-sm text-red-700">
                Could not render QR: {error}
              </p>
            ) : (
              <p className="text-sm text-hawk-600">Generating QR&hellip;</p>
            )}
          </div>

          <div className="space-y-3">
            <label htmlFor="mc-url" className="block">
              <span className="block text-[11px] font-bold uppercase tracking-[0.22em] text-hawk-600">
                Mobile URL
              </span>
              <input
                id="mc-url"
                type="text"
                value={mobileUrl}
                onChange={(e) => setMobileUrl(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                className="mt-1 block w-full rounded-md border border-gold-300 bg-white px-3 py-2 font-mono text-sm shadow-inner outline-none focus:ring-2 focus:ring-gold-300"
              />
            </label>

            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(mobileUrl);
              }}
              className="rounded-md bg-hawk-700 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-hawk-800"
            >
              Copy URL
            </button>

            <p className="text-xs text-hawk-600">
              Default value is the address you have open right now. Edit it if you
              want to point the QR at a different host (e.g. a LAN IP or HTTPS
              tunnel).
            </p>
          </div>
        </div>
      </section>

      <section
        className={`rounded-xl border p-4 ${
          cameraReady
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : 'border-amber-300 bg-amber-50 text-amber-900'
        }`}
        aria-live="polite"
      >
        <h2 className="font-display text-lg font-semibold">
          {cameraReady ? 'Camera scanning ready' : 'Camera scanning blocked over plain HTTP'}
        </h2>
        {cameraReady ? (
          <p className="mt-1 text-sm">
            This URL is HTTPS or localhost, so phones will allow camera access for
            barcode/QR scanning.
          </p>
        ) : (
          <div className="mt-2 space-y-2 text-sm">
            <p>
              Phones (iPhone Safari + Android Chrome) only allow camera access on
              <strong> HTTPS </strong> or <strong> localhost</strong>. The URL in
              the QR is plain HTTP, so the camera path will fail with{' '}
              <code>insecure-context</code>. Manual entry will still work.
            </p>
            <p>To enable camera scanning over LAN, pick one of:</p>
            <ul className="list-disc pl-6">
              <li>
                Run a local HTTPS reverse proxy (e.g.{' '}
                <code>caddy reverse-proxy --from :443 --to :3000</code> with a
                self-signed cert installed on the phone).
              </li>
              <li>
                Use an HTTPS tunnel (<code>cloudflared tunnel</code> or{' '}
                <code>ngrok http 3000</code>) and paste the resulting{' '}
                <code>https://</code> URL into the box above.
              </li>
              <li>
                For a quick demo: keep the laptop running the app, plug the phone
                directly into the laptop via USB-C, enable USB debugging, and use
                <code> localhost:3000 </code>via Chrome remote debugging.
              </li>
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-hawk-200 bg-white/70 p-4">
        <h2 className="font-display text-lg font-semibold text-hawk-800">
          What you&apos;ll see on the phone
        </h2>
        <ol className="mt-2 list-decimal space-y-1 pl-6 text-sm text-hawk-800">
          <li>
            Login screen (use the same admin/volunteer account you use on
            desktop).
          </li>
          <li>
            Mobile drawer with available workflows: <em>Pickup</em>,{' '}
            <em>Lookup</em>, and (for admins) <em>Scanner Demo</em>.
          </li>
          <li>
            Open <strong>Scanner Demo</strong> at <code>/mobile/scanner-demo</code>{' '}
            to test the camera + manual entry without touching real orders.
          </li>
          <li>
            Add to home screen (Safari: Share → Add to Home Screen; Chrome: Menu →
            Add to Home Screen) for full PWA mode.
          </li>
        </ol>
      </section>
    </div>
  );
}

export default MobileConnectPage;
