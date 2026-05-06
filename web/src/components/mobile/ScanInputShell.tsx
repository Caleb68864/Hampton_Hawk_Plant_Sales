import { type ReactNode, type InputHTMLAttributes, forwardRef } from 'react';

interface ScanInputShellProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label?: ReactNode;
  hint?: ReactNode;
  id?: string;
}

export const ScanInputShell = forwardRef<HTMLInputElement, ScanInputShellProps>(
  ({ label, hint, id = 'scan-input', ...inputProps }, ref) => {
    return (
      <div className="scan-input-shell">
        {label && (
          <label
            htmlFor={id}
            className="scan-input-shell__label"
          >
            {label}
          </label>
        )}

        <div className="scan-input-shell__outer">
          <div className="scan-input-shell__inset">
            <input
              ref={ref}
              id={id}
              className="scan-input"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              {...inputProps}
            />
          </div>
        </div>

        {hint && (
          <div className="scan-input-shell__hint">
            {hint}
          </div>
        )}

        <style>{`
          .scan-input-shell {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .scan-input-shell__label {
            font-family: var(--font-body, "Manrope", sans-serif);
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--color-hawk-500, #7d52a0);
          }
          .scan-input-shell__outer {
            border: 2px solid var(--color-gold-300, #f0c84a);
            border-radius: 10px;
            background: linear-gradient(to bottom, var(--joy-paper, #fff), var(--color-gold-50, #fffbf0));
            padding: 3px;
          }
          .scan-input-shell__inset {
            border-radius: 7px;
            background: white;
            border: 1px solid var(--rule, var(--color-rule, #e8e0f0));
            overflow: hidden;
          }
          .scan-input {
            display: block;
            width: 100%;
            padding: 12px 14px;
            font-family: var(--font-mono, "JetBrains Mono", "Fira Code", monospace);
            font-size: 20px;
            line-height: 1.3;
            color: var(--color-hawk-900, #1e0a35);
            background: transparent;
            border: none;
            outline: none;
            box-sizing: border-box;
          }
          @media (min-width: 768px) {
            .scan-input {
              font-size: 24px;
            }
          }
          .scan-input-shell__outer:focus-within {
            border-color: var(--color-gold-500, #c9910a);
            box-shadow: 0 0 0 4px rgba(212, 160, 33, 0.18);
          }
          .scan-input-shell__hint {
            font-family: var(--font-body, "Manrope", sans-serif);
            font-size: 12px;
            color: var(--color-hawk-400, #8a68a8);
          }
        `}</style>
      </div>
    );
  }
);

ScanInputShell.displayName = 'ScanInputShell';

// Re-export as FC-compatible type for consumers that don't need ref
export type { ScanInputShellProps };
