import { describe, it, expect } from 'vitest';
import { getMobileWorkflows, hasMobileAccess } from '../mobileRouteConfig.js';
import type { CurrentUser } from '../../types/auth.js';

function makeUser(roles: CurrentUser['roles']): CurrentUser {
  return { id: 1, username: 'test', displayName: 'Test', roles };
}

describe('getMobileWorkflows', () => {
  it('returns empty array for null user', () => {
    expect(getMobileWorkflows(null)).toEqual([]);
  });

  it('Admin gets both pickup and lookup workflows', () => {
    const workflows = getMobileWorkflows(makeUser(['Admin']));
    const ids = workflows.map((w) => w.id);
    expect(ids).toContain('pickup');
    expect(ids).toContain('lookup');
  });

  it('Pickup role gets both pickup and lookup workflows', () => {
    const workflows = getMobileWorkflows(makeUser(['Pickup']));
    const ids = workflows.map((w) => w.id);
    expect(ids).toContain('pickup');
    expect(ids).toContain('lookup');
  });

  it('LookupPrint role gets lookup workflow only', () => {
    const workflows = getMobileWorkflows(makeUser(['LookupPrint']));
    const ids = workflows.map((w) => w.id);
    expect(ids).not.toContain('pickup');
    expect(ids).toContain('lookup');
  });

  it('POS-only role gets no mobile workflows', () => {
    const workflows = getMobileWorkflows(makeUser(['POS']));
    expect(workflows).toHaveLength(0);
  });

  it('Volunteer-only role gets no mobile workflows', () => {
    const workflows = getMobileWorkflows(makeUser(['Volunteer']));
    expect(workflows).toHaveLength(0);
  });

  it('Pickup + Admin roles do not duplicate entries', () => {
    const workflows = getMobileWorkflows(makeUser(['Pickup', 'Admin']));
    const ids = workflows.map((w) => w.id);
    expect(ids.filter((id) => id === 'pickup')).toHaveLength(1);
    expect(ids.filter((id) => id === 'lookup')).toHaveLength(1);
  });
});

describe('hasMobileAccess', () => {
  it('returns false for null user', () => {
    expect(hasMobileAccess(null)).toBe(false);
  });

  it('returns true for Admin', () => {
    expect(hasMobileAccess(makeUser(['Admin']))).toBe(true);
  });

  it('returns true for Pickup', () => {
    expect(hasMobileAccess(makeUser(['Pickup']))).toBe(true);
  });

  it('returns true for LookupPrint', () => {
    expect(hasMobileAccess(makeUser(['LookupPrint']))).toBe(true);
  });

  it('returns false for POS only', () => {
    expect(hasMobileAccess(makeUser(['POS']))).toBe(false);
  });

  it('returns false for Volunteer only', () => {
    expect(hasMobileAccess(makeUser(['Volunteer']))).toBe(false);
  });
});
