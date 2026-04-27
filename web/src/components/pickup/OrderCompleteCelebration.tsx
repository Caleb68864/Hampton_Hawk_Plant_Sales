import { useEffect, useRef } from 'react';

export interface OrderCompleteCelebrationProps {
  visible: boolean;
  orderNumber: string;
  customerName?: string;
  onComplete?: () => void;
}

const confettiColors = [
  'var(--color-gold-500)',
  'var(--color-hawk-500)',
  'var(--color-gold-300)',
  'var(--color-hawk-700)',
  'var(--color-gold-600)',
  'var(--color-hawk-400)',
  'var(--color-gold-400)',
  'var(--color-hawk-600)',
];

const confettiPositions = ['10%', '22%', '35%', '48%', '60%', '72%', '84%', '92%'];
const confettiDelays = [50, 110, 30, 180, 90, 150, 70, 200];

export function OrderCompleteCelebration({
  visible,
  orderNumber,
  customerName,
  onComplete,
}: OrderCompleteCelebrationProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible || !onComplete) return;

    timerRef.current = setTimeout(() => {
      onComplete();
    }, 700);

    const dismiss = () => onComplete();
    window.addEventListener('keydown', dismiss);
    window.addEventListener('pointerdown', dismiss);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener('keydown', dismiss);
      window.removeEventListener('pointerdown', dismiss);
    };
  }, [visible, onComplete]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center text-center px-4 overflow-hidden pointer-events-none"
      role="status"
      aria-live="polite"
      style={{
        background:
          'radial-gradient(900px 500px at 50% 45%, rgba(212, 160, 33, 0.22) 0%, rgba(102, 46, 128, 0.15) 40%, rgba(0,0,0,0.25) 100%)',
      }}
    >
      {/* Confetti */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        {confettiColors.map((color, i) => (
          <i
            key={i}
            className="absolute top-[-6px] w-2 h-3.5 rounded-sm joy-animate-fall"
            style={{
              left: confettiPositions[i],
              background: color,
              animationDelay: `${confettiDelays[i]}ms`,
              transformOrigin: 'center',
            }}
          />
        ))}
      </div>

      {/* Stamp */}
      <div
        className="inline-block px-7 py-3.5 mb-3 joy-animate-stamp"
        style={{
          border: '2px dashed var(--color-gold-600)',
          color: 'var(--color-gold-800)',
          fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
          fontVariationSettings: "'wght' 700",
          fontStyle: 'italic',
          fontSize: '2rem',
          letterSpacing: '0.04em',
          textShadow: '0 1px 0 rgba(255, 255, 255, 0.6)',
        }}
      >
        All Picked &middot; Ready
      </div>

      {/* Headline */}
      <h2
        className="text-4xl lg:text-5xl text-hawk-900 my-1"
        style={{
          fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
          fontVariationSettings: "'opsz' 144, 'wght' 600",
        }}
      >
        {orderNumber} is on its way.
      </h2>

      {/* Customer instructions */}
      <p
        className="text-hawk-600 max-w-[46ch] mx-auto mt-2"
        style={{
          fontFamily: "var(--font-body), 'Manrope', sans-serif",
        }}
      >
        {customerName
          ? `Hand the order to ${customerName} and clear the bench.`
          : 'Hand the order to the customer and clear the bench.'}{' '}
        The next order is already focused below.
      </p>
    </div>
  );
}
