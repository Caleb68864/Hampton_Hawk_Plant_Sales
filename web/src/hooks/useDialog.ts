import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

export interface UseDialogOptions {
  /** Whether the dialog is currently shown. */
  isOpen: boolean;
  /** Called on Escape. Omit (or pass undefined) to disable Escape-to-close, e.g. while busy. */
  onClose?: () => void;
  /** id of the element that labels the dialog (usually its heading). */
  labelledBy?: string;
}

export interface DialogProps {
  ref: RefObject<HTMLDivElement | null>;
  role: 'dialog';
  'aria-modal': true;
  'aria-labelledby'?: string;
  tabIndex: -1;
}

const FOCUSABLE = [
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Small accessibility helper for the app's hand-rolled modals.
 *
 * - Spreads `role="dialog"`, `aria-modal`, and an optional `aria-labelledby`
 *   onto the panel element.
 * - When the dialog opens, moves focus to the first focusable child (or the
 *   panel itself) and restores focus to the previously focused element when
 *   it closes.
 * - Escape calls `onClose` (unless it is undefined, which callers use to lock
 *   the dialog while an action is in flight).
 */
export function useDialog({ isOpen, onClose, labelledBy }: UseDialogOptions): DialogProps {
  const ref = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = ref.current;
    if (panel) {
      const alreadyInside = panel.contains(document.activeElement);
      if (!alreadyInside) {
        const first = panel.querySelector<HTMLElement>(FOCUSABLE);
        (first ?? panel).focus();
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && onCloseRef.current) {
        e.preventDefault();
        onCloseRef.current();
      }
    }
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  return {
    ref,
    role: 'dialog',
    'aria-modal': true,
    'aria-labelledby': labelledBy,
    tabIndex: -1,
  };
}
