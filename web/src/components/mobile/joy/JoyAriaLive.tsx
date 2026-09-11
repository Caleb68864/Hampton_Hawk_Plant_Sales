import { useCallback, useEffect, useRef, useState, type FC, type ReactNode } from 'react';
import { JoyAnnounceContext, type AnnounceFn } from './joyAnnounce.js';

/**
 * Live-region content. `nonce` flips whenever the same text is announced
 * twice in a row; the rendered string gets a zero-width space appended on odd
 * nonces so the DOM text actually changes and screen readers re-announce it.
 * This keeps every announce a single synchronous state update (no RAF), which
 * is what makes it observable "within one render tick" in tests and reliable
 * when the page is backgrounded (RAF callbacks stall on hidden tabs).
 */
interface LiveMessage {
  text: string;
  nonce: number;
}

const EMPTY: LiveMessage = { text: '', nonce: 0 };
const ZERO_WIDTH_SPACE = '\u200B';

function nextMessage(prev: LiveMessage, text: string): LiveMessage {
  return { text, nonce: prev.text === text ? prev.nonce + 1 : prev.nonce };
}

function renderMessage(msg: LiveMessage): string {
  if (!msg.text) return '';
  return msg.nonce % 2 === 1 ? msg.text + ZERO_WIDTH_SPACE : msg.text;
}

export const JoyAriaLive: FC<{ children: ReactNode }> = ({ children }) => {
  const [politeMsg, setPoliteMsg] = useState<LiveMessage>(EMPTY);
  const [assertiveMsg, setAssertiveMsg] = useState<LiveMessage>(EMPTY);
  const politeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assertiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (politeTimer.current) clearTimeout(politeTimer.current);
      if (assertiveTimer.current) clearTimeout(assertiveTimer.current);
    },
    [],
  );

  const announce = useCallback<AnnounceFn>((message, opts = {}) => {
    const { politeness = 'polite', ttlMs = 4000 } = opts;
    const timer = politeness === 'assertive' ? assertiveTimer : politeTimer;
    const setMsg = politeness === 'assertive' ? setAssertiveMsg : setPoliteMsg;

    if (timer.current) clearTimeout(timer.current);
    setMsg((prev) => nextMessage(prev, message));
    timer.current = setTimeout(() => {
      timer.current = null;
      setMsg((prev) => ({ ...prev, text: '' }));
    }, ttlMs);
  }, []);

  const srOnly: React.CSSProperties = {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0,0,0,0)',
    whiteSpace: 'nowrap',
    border: 0,
  };

  return (
    <JoyAnnounceContext.Provider value={announce}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        role="status"
        style={srOnly}
        data-testid="joy-live-polite"
      >
        {renderMessage(politeMsg)}
      </div>
      <div
        aria-live="assertive"
        aria-atomic="true"
        role="alert"
        style={srOnly}
        data-testid="joy-live-assertive"
      >
        {renderMessage(assertiveMsg)}
      </div>
    </JoyAnnounceContext.Provider>
  );
};
