import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore.js';
import { MobilePrimaryButton } from '../../components/mobile/buttons/MobilePrimaryButton.js';

export function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/';
  const fromMobile = from.startsWith('/mobile');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (fromMobile) {
    return (
      <div
        style={{
          minHeight: '100svh',
          background: 'var(--joy-paper, #faf7f2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 360,
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}
        >
          <h1
            style={{
              fontFamily: 'var(--font-display, "Fraunces", serif)',
              fontSize: 'clamp(1.5rem, 5vw, 2rem)',
              fontWeight: 700,
              color: 'var(--color-hawk-800, #2d1152)',
              textAlign: 'center',
              margin: 0,
            }}
          >
            Sign in
          </h1>

          <form
            onSubmit={(e) => void handleSubmit(e)}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <div>
              <label
                htmlFor="username"
                style={{
                  fontFamily: 'var(--font-body, "Manrope", sans-serif)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--color-hawk-700, #3d1f6e)',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid var(--color-hawk-200, #c4a8e0)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  fontSize: 15,
                  fontFamily: 'var(--font-body, "Manrope", sans-serif)',
                  outline: 'none',
                  background: 'white',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                style={{
                  fontFamily: 'var(--font-body, "Manrope", sans-serif)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--color-hawk-700, #3d1f6e)',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid var(--color-hawk-200, #c4a8e0)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  fontSize: 15,
                  fontFamily: 'var(--font-body, "Manrope", sans-serif)',
                  outline: 'none',
                  background: 'white',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {error && (
              <p
                style={{
                  color: 'var(--color-danger, #dc2626)',
                  fontSize: 13,
                  margin: 0,
                  fontFamily: 'var(--font-body, "Manrope", sans-serif)',
                }}
              >
                {error}
              </p>
            )}

            <MobilePrimaryButton type="submit" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </MobilePrimaryButton>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Sign in</h1>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-lg py-2 transition-colors"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
