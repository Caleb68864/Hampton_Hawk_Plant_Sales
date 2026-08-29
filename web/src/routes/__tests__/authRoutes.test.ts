import { describe, expect, it } from 'vitest';

// Route guard components are React components; this only checks that the
// modules export what App.tsx imports so a misnamed export fails at test time.

describe('auth route guards', () => {
  it('ProtectedRoute is exported as a function', async () => {
    const mod = await import('../ProtectedRoute.js');
    expect(typeof mod.ProtectedRoute).toBe('function');
  });

  it('RoleRoute is exported as a function', async () => {
    const mod = await import('../RoleRoute.js');
    expect(typeof mod.RoleRoute).toBe('function');
  });
});
