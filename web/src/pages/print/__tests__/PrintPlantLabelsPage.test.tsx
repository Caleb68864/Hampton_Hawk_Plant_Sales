import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockGetById = vi.fn();
vi.mock('@/api/plants.js', () => ({
  plantsApi: {
    getById: (...args: unknown[]) => mockGetById(...args),
    list: vi.fn(),
  },
}));

import { PrintPlantLabelsPage } from '../PrintPlantLabelsPage.js';

const plant = (id: string) => ({
  id, sku: `SKU-${id}`, name: `Plant ${id}`, variant: null, price: 5, barcode: `00000000000${id}`,
  isActive: true, barcodeLockedAt: null, createdAt: '2026-05-07T00:00:00Z', updatedAt: '2026-05-07T00:00:00Z',
});

describe('PrintPlantLabelsPage', () => {
  it('warns when a requested plant could not be loaded instead of printing short silently', async () => {
    mockGetById.mockImplementation(async (id: string) => {
      if (id === 'b') throw new Error('Network Error');
      return plant(id);
    });

    render(
      <MemoryRouter initialEntries={['/print/labels?ids=a,b,c&density=sheet']}>
        <Routes>
          <Route path="/print/labels" element={<PrintPlantLabelsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('1 requested plant could not be loaded');
  });
});
