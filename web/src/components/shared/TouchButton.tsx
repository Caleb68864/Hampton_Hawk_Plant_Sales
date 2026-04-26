import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface TouchButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'gold' | 'ghost' | 'danger';
  children: ReactNode;
}

const baseClasses =
  'inline-flex items-center justify-center gap-2.5 min-h-14 min-w-14 px-5 py-4 rounded-xl font-semibold text-base tracking-tight transition-transform duration-100 ease-out active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed';

const variantClasses: Record<NonNullable<TouchButtonProps['variant']>, string> =
  {
    primary: [
      'text-white',
      'bg-gradient-to-b from-hawk-600 to-hawk-800',
      'shadow-[0_1px_0_rgba(255,255,255,0.1)_inset,0_2px_0_var(--color-hawk-950),0_12px_24px_-10px_rgba(68,29,85,0.55)]',
      'hover:brightness-105',
    ].join(' '),
    gold: [
      'text-hawk-950',
      'bg-gradient-to-b from-gold-300 to-gold-500',
      'shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_2px_0_var(--color-gold-800),0_12px_24px_-10px_rgba(184,129,26,0.6)]',
      'hover:brightness-105',
    ].join(' '),
    ghost: [
      'text-hawk-800',
      'bg-white',
      'border border-hawk-200',
      'shadow-[0_1px_0_rgba(0,0,0,0.06),inset_0_-2px_0_rgba(0,0,0,0.06)]',
      'hover:border-hawk-300 hover:bg-hawk-50',
    ].join(' '),
    danger: [
      'text-red-800',
      'bg-red-50',
      'border border-red-200',
      'shadow-[0_1px_0_rgba(0,0,0,0.06),inset_0_-2px_0_rgba(0,0,0,0.06)]',
      'hover:bg-red-100 hover:border-red-300',
    ].join(' '),
  };

export function TouchButton({
  variant = 'primary',
  children,
  className = '',
  ...props
}: TouchButtonProps) {
  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`.trim()}
      style={{ fontFamily: "var(--font-body), 'Manrope', system-ui, sans-serif" }}
      {...props}
    >
      {children}
    </button>
  );
}
