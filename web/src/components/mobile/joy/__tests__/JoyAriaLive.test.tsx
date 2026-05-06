import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { JoyAriaLive, useJoyAnnounce } from '../JoyAriaLive.js';

// Helper component that calls useJoyAnnounce and exposes the fn via callback
function Announcer({ onMount }: { onMount: (fn: ReturnType<typeof useJoyAnnounce>) => void }) {
  const announce = useJoyAnnounce();
  onMount(announce);
  return null;
}

// Component used outside provider
function OutsideAnnouncer({ onMount }: { onMount: (fn: ReturnType<typeof useJoyAnnounce>) => void }) {
  const announce = useJoyAnnounce();
  onMount(announce);
  return null;
}

describe('JoyAriaLive', () => {
  it('(a) renders both polite and assertive live regions', () => {
    render(
      <JoyAriaLive>
        <div />
      </JoyAriaLive>
    );
    expect(screen.getByTestId('joy-live-polite')).toBeInTheDocument();
    expect(screen.getByTestId('joy-live-assertive')).toBeInTheDocument();
  });

  it('(b) useJoyAnnounce outside provider is a no-op (does not throw)', () => {
    let fn!: ReturnType<typeof useJoyAnnounce>;
    render(<OutsideAnnouncer onMount={(f) => { fn = f; }} />);
    expect(() => fn('hello')).not.toThrow();
  });

  it('(c) announce updates polite region within one render tick', async () => {
    let fn!: ReturnType<typeof useJoyAnnounce>;
    render(
      <JoyAriaLive>
        <Announcer onMount={(f) => { fn = f; }} />
      </JoyAriaLive>
    );
    await act(async () => {
      fn('test polite message');
      await Promise.resolve();
    });
    expect(screen.getByTestId('joy-live-polite').textContent).toBe('test polite message');
  });

  it('(d) politeness assertive updates assertive region', async () => {
    let fn!: ReturnType<typeof useJoyAnnounce>;
    render(
      <JoyAriaLive>
        <Announcer onMount={(f) => { fn = f; }} />
      </JoyAriaLive>
    );
    await act(async () => {
      fn('urgent message', { politeness: 'assertive' });
      await Promise.resolve();
    });
    expect(screen.getByTestId('joy-live-assertive').textContent).toBe('urgent message');
  });

  it('(e) message clears after ttlMs', async () => {
    vi.useFakeTimers();
    let fn!: ReturnType<typeof useJoyAnnounce>;
    render(
      <JoyAriaLive>
        <Announcer onMount={(f) => { fn = f; }} />
      </JoyAriaLive>
    );
    await act(async () => {
      fn('expiring message', { ttlMs: 100 });
      await Promise.resolve();
    });
    expect(screen.getByTestId('joy-live-polite').textContent).toBe('expiring message');
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByTestId('joy-live-polite').textContent).toBe('');
    vi.useRealTimers();
  });

  it('(f) subsequent calls replace prior message', async () => {
    let fn!: ReturnType<typeof useJoyAnnounce>;
    render(
      <JoyAriaLive>
        <Announcer onMount={(f) => { fn = f; }} />
      </JoyAriaLive>
    );
    await act(async () => {
      fn('first message');
      await Promise.resolve();
    });
    await act(async () => {
      fn('second message');
      await Promise.resolve();
    });
    expect(screen.getByTestId('joy-live-polite').textContent).toBe('second message');
  });
});
