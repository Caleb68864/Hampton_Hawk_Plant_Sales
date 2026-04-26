import type { ReactNode } from 'react';
import { SectionHeading } from './SectionHeading.js';

export type JoyPageShellMaxWidth = 'default' | 'wide' | 'full';

export interface JoyPageShellProps {
  /** Main page heading rendered via SectionHeading level 1. */
  title: string;
  /** Optional small uppercase eyebrow label rendered above the title. */
  eyebrow?: string;
  /** Optional node rendered to the right of the heading (typically primary action TouchButtons). */
  actions?: ReactNode;
  /** Page body content. */
  children: ReactNode;
  /** Container max-width. 'default' = max-w-6xl, 'wide' = max-w-7xl, 'full' = no max. */
  maxWidth?: JoyPageShellMaxWidth;
}

const maxWidthClass: Record<JoyPageShellMaxWidth, string> = {
  default: 'max-w-6xl',
  wide: 'max-w-7xl',
  full: '',
};

/**
 * Shared back-office page chrome for the Joy Pass.
 *
 * Renders a paper-grain background, top spacing, container with sane max-width,
 * and a SectionHeading (level 1) using `title` + `eyebrow`. Children render below
 * the heading. Optional `actions` render to the right of the heading.
 *
 * Honors `prefers-reduced-motion` by introducing no new animations.
 */
export function JoyPageShell({
  title,
  eyebrow,
  actions,
  children,
  maxWidth = 'default',
}: JoyPageShellProps) {
  const widthClass = maxWidthClass[maxWidth];
  const containerClass = ['paper-grain', 'mx-auto', 'space-y-4', 'relative', widthClass]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClass}>
      <div className="relative z-10 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <SectionHeading level={1} eyebrow={eyebrow}>
            {title}
          </SectionHeading>
          {actions && (
            <div className="flex items-center gap-2 flex-wrap">{actions}</div>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
