import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileUploader } from '../FileUploader.js';
import { describeFileRejection, MAX_UPLOAD_BYTES } from '../fileRejection.js';

function pick(file: File) {
  const input = screen.getByLabelText('Choose a file to import') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
  return input;
}

describe('FileUploader', () => {
  it('explains a rejected extension instead of silently ignoring it', () => {
    render(<FileUploader onUpload={vi.fn()} />);
    pick(new File(['%PDF'], 'orders.pdf', { type: 'application/pdf' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Only .csv or .xlsx files are accepted (got .pdf).');
    expect(screen.queryByRole('button', { name: 'Upload' })).not.toBeInTheDocument();
  });

  it('rejects files over the size ceiling', () => {
    render(<FileUploader onUpload={vi.fn()} maxBytes={1024} />);
    const big = new File([new Uint8Array(2048)], 'orders.csv', { type: 'text/csv' });
    pick(big);

    expect(screen.getByRole('alert')).toHaveTextContent('File is 0.0 MB; the limit is 0.0 MB.');
    expect(screen.queryByRole('button', { name: 'Upload' })).not.toBeInTheDocument();
  });

  it('clears the rejection once an acceptable file is chosen', () => {
    render(<FileUploader onUpload={vi.fn()} />);
    pick(new File(['x'], 'nope.txt'));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    pick(new File(['sku,name'], 'plants.csv', { type: 'text/csv' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('plants.csv')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument();
  });
});

describe('describeFileRejection', () => {
  it('accepts allowed extensions case-insensitively under the limit', () => {
    expect(describeFileRejection({ name: 'A.CSV', size: 10 }, ['csv', 'xlsx'])).toBeNull();
    expect(describeFileRejection({ name: 'a.xlsx', size: MAX_UPLOAD_BYTES }, ['csv', 'xlsx'])).toBeNull();
  });

  it('rejects a missing extension and an oversized file', () => {
    expect(describeFileRejection({ name: 'README', size: 1 }, ['csv'])).toBe('Only .csv files are accepted.');
    expect(describeFileRejection({ name: 'a.csv', size: MAX_UPLOAD_BYTES + 1 }, ['csv'])).toMatch(/limit is 10\.0 MB/);
  });
});
