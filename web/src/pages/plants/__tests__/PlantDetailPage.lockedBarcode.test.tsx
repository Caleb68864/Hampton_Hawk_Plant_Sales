import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockNavigate = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateLocked = vi.fn();
const mockOpenPinModal = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('@/api/plants.js', () => ({
  plantsApi: {
    getById: async () => ({
      id: 'p-1', sku: '1001', name: 'Fern', variant: null, price: 5, barcode: '000000001001', isActive: true,
      barcodeLockedAt: '2026-05-09T15:00:00Z', createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z',
    }),
    update: (...args: unknown[]) => mockUpdate(...args),
    updateLockedBarcode: (...args: unknown[]) => mockUpdateLocked(...args),
    create: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock('@/stores/authStore.js', () => ({
  useAuthStore: <T,>(selector: (s: { openPinModal: typeof mockOpenPinModal }) => T) => selector({ openPinModal: mockOpenPinModal }),
}));

import { PlantDetailPage } from '../PlantDetailPage.js';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/plants/p-1']}>
      <Routes>
        <Route path="/plants/:id" element={<PlantDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PlantDetailPage with a locked barcode', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUpdate.mockReset().mockResolvedValue({});
    mockUpdateLocked.mockReset().mockResolvedValue({});
    mockOpenPinModal.mockReset();
  });
  afterEach(() => cleanup());

  it('asks for the PIN before changing the barcode of a scanned plant', async () => {
    mockOpenPinModal.mockResolvedValue({ pin: '1234', reason: 'label misprint' });
    renderPage();
    const barcode = (await screen.findByLabelText('Barcode *')) as HTMLInputElement;
    await waitFor(() => expect(barcode.value).toBe('000000001001'));
    fireEvent.change(barcode, { target: { value: '000000009999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(mockUpdateLocked).toHaveBeenCalledWith('p-1', expect.objectContaining({ barcode: '000000009999' }), '1234', 'label misprint'));
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('saves other edits normally', async () => {
    renderPage();
    const name = (await screen.findByLabelText('Name *')) as HTMLInputElement;
    await waitFor(() => expect(name.value).toBe('Fern'));
    fireEvent.change(name, { target: { value: 'Fern, Boston' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockOpenPinModal).not.toHaveBeenCalled();
  });
});
