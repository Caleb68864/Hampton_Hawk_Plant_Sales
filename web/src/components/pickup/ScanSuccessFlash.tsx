import { useEffect, useRef } from 'react';

export interface ScanSuccessFlashProps {
  visible: boolean;
  plantName: string;
  sku?: string;
  barcode?: string;
  remainingForOrder?: number;
  onAnimationEnd?: () => void;
}

export function ScanSuccessFlash({
  visible,
  plantName,
  sku,
  barcode,
  remainingForOrder,
  onAnimationEnd,
}: ScanSuccessFlashProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible || !onAnimationEnd) return;

    timerRef.current = setTimeout(() => {
      onAnimationEnd();
    }, 520);

    const dismiss = () => onAnimationEnd();
    window.addEventListener('keydown', dismiss);
    window.addEventListener('pointerdown', dismiss);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener('keydown', dismiss);
      window.removeEventListener('pointerdown', dismiss);
    };
  }, [visible, onAnimationEnd]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      role="status"
      aria-live="polite"
      style={{
        background:
          'radial-gradient(600px 280px at 50% 50%, rgba(212, 160, 33, 0.20) 0%, rgba(0,0,0,0.10) 50%, transparent 75%)',
      }}
    >
      <div
        className="flex flex-col items-center gap-4 rounded-2xl px-12 py-8"
        style={{
          background: 'var(--joy-paper, #fbf7ee)',
          border: '1px solid var(--color-gold-300)',
          boxShadow:
            '0 30px 80px -20px rgba(68, 29, 85, 0.45), 0 8px 24px -8px rgba(68, 29, 85, 0.25)',
        }}
      >
      {/* Checkbloom circle */}
      <div
        className="relative w-36 h-36 rounded-full grid place-items-center joy-animate-pop"
        style={{
          background:
            'radial-gradient(circle at 30% 25%, white, var(--color-gold-200) 60%, var(--color-gold-500))',
          boxShadow:
            '0 30px 60px -20px rgba(184, 129, 26, 0.55), 0 0 0 8px rgba(244, 222, 165, 0.45)',
        }}
      >
        {/* Ring animation */}
        <span
          className="absolute inset-[-22px] rounded-full border-2 joy-animate-ring"
          style={{
            borderColor: 'rgba(212, 160, 33, 0.35)',
          }}
        />
        {/* Checkmark */}
        <svg
          className="w-20 h-20 text-hawk-800"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>

      {/* Meta info */}
      <div className="text-center">
        <p
          className="text-3xl leading-tight text-hawk-900"
          style={{
            fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
            fontVariationSettings: "'opsz' 144, 'wght' 600",
          }}
        >
          {plantName}
        </p>
        {(sku || barcode) && (
          <p
            className="text-sm text-hawk-600 mt-1 tracking-wide"
            style={{
              fontFamily: "var(--font-body), 'Manrope', sans-serif",
            }}
          >
            {sku && <span>SKU {sku}</span>}
            {sku && barcode && <span> &middot; </span>}
            {barcode && <span>{barcode}</span>}
          </p>
        )}
      </div>

      {/* Remaining pill */}
      {remainingForOrder !== undefined && (
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm text-hawk-800"
          style={{
            background: 'white',
            border: '1px solid var(--color-gold-300)',
            boxShadow: '0 6px 16px -10px rgba(68, 29, 85, 0.3)',
            fontFamily: "var(--font-body), 'Manrope', sans-serif",
          }}
        >
          Remaining for this order{' '}
          <strong
            className="text-lg text-gold-800"
            style={{
              fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
              fontVariationSettings: "'wght' 700",
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {remainingForOrder}
          </strong>
        </div>
      )}
      </div>
    </div>
  );
}
