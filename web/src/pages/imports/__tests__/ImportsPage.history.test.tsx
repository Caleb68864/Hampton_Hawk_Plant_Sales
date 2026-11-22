import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockList = vi.fn();
vi.mock('@/api/imports.js', () => ({
  importsApi: {
    list: (...args: unknown[]) => mockList(...args),
    getIssues: vi.fn(),
    getAllIssues: vi.fn(async () => []),
    importPlants: vi.fn(),
    importInventory: vi.fn(),
    importOrders: vi.fn(),
  },
}));

import { ImportsPage } from '../ImportsPage.js';

const batch = (n: number) => ({
  id: `b-${n}`, type: 'Plants', filename: `file-${n}.csv`, totalRows: 1, importedCount: 1, skippedCount: 0,
  createdAt: '2026-05-01T00:00:00Z',
});

describe('ImportsPage history', () => {
  it('can load batches older than the first page', async () => {
    mockList.mockImplementation(async ({ page }: { page: number }) => ({
      items: page === 1 ? Array.from({ length: 50 }, (_, i) => batch(i)) : [batch(50), batch(51)],
      totalCount: 52,
      page,
      pageSize: 50,
    }));

    render(<ImportsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Import History' }));
    expect(await screen.findByText('Showing 50 of 52')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Load older imports' }));
    await waitFor(() => expect(screen.getByText('file-51.csv')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Load older imports' })).not.toBeInTheDocument();
  });
});
