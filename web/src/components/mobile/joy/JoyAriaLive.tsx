import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from 'react';

interface AnnounceOptions {
  politeness?: 'polite' | 'assertive';
  ttlMs?: number;
}

type AnnounceFn = (message: string, opts?: AnnounceOptions) => void;

const JoyAnnounceContext = createContext<AnnounceFn | null>(null);

export const JoyAriaLive: FC<{ children: ReactNode }> = ({ children }) => {
  const [politeMsg, setPoliteMsg] = useState('');
  const [assertiveMsg, setAssertiveMsg] = useState('');
  const politeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assertiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback<AnnounceFn>((message, opts = {}) => {
    const { politeness = 'polite', ttlMs = 4000 } = opts;

    if (politeness === 'assertive') {
      setAssertiveMsg('');
      if (assertiveTimer.current) clearTimeout(assertiveTimer.current);
      // RAF so clearing + setting fires as separate renders, allowing identical re-announce
      requestAnimationFrame(() => {
        setAssertiveMsg(message);
        assertiveTimer.current = setTimeout(() => setAssertiveMsg(''), ttlMs);
      });
    } else {
      setPoliteMsg('');
      if (politeTimer.current) clearTimeout(politeTimer.current);
      requestAnimationFrame(() => {
        setPoliteMsg(message);
        politeTimer.current = setTimeout(() => setPoliteMsg(''), ttlMs);
      });
    }
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
        {politeMsg}
      </div>
      <div
        aria-live="assertive"
        aria-atomic="true"
        role="alert"
        style={srOnly}
        data-testid="joy-live-assertive"
      >
        {assertiveMsg}
      </div>
    </JoyAnnounceContext.Provider>
  );
};

export function useJoyAnnounce(): AnnounceFn {
  const fn = useContext(JoyAnnounceContext);
  if (!fn) {
    // Safe no-op outside provider
    return () => {};
  }
  return fn;
}
