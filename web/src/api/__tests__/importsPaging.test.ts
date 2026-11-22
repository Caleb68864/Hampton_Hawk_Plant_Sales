import { describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('../client.js', () => ({ get: (...args: unknown[]) => get(...args), post: vi.fn(), postForm: vi.fn(), postFormWithTimeout: vi.fn() }));

const { importsApi } = await import('../imports.js');

describe('importsApi.getAllIssues', () => {
  it('reads every page instead of stopping at the first 200', async () => {
    const issue = (n: number) => ({ id: `i-${n}`, rowNumber: n });
    get.mockImplementation(async (_url: string, params: { page: number }) => ({
      items: params.page === 1 ? Array.from({ length: 200 }, (_, i) => issue(i)) : params.page === 2 ? [issue(200), issue(201)] : [],
      totalCount: 202,
      page: params.page,
      pageSize: 200,
    }));

    const issues = await importsApi.getAllIssues('b-1');

    expect(issues).toHaveLength(202);
    expect(get).toHaveBeenCalledTimes(2);
  });
});
