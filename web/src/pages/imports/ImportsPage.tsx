import { useState, useEffect } from 'react';
import { importsApi } from '@/api/imports.js';
import { FileUploader } from '@/components/imports/FileUploader.js';
import { ImportResultsSummary } from '@/components/imports/ImportResultsSummary.js';
import { ImportIssuesTable } from '@/components/imports/ImportIssuesTable.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import type { ImportResult, ImportBatch } from '@/types/import.js';

type Tab = 'import' | 'history';

interface ImportSectionProps {
  title: string;
  hint: string;
  type: 'plants' | 'orders' | 'inventory';
  onUpload: (file: File) => Promise<ImportResult>;
  templateLinks?: TemplateDownloadLinksProps;
}

interface TemplateDownloadLinksProps {
  csvHref: string;
  excelHref?: string;
}

function TemplateDownloadLinks({ csvHref, excelHref }: TemplateDownloadLinksProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <span className="text-xs font-medium text-gray-600">Templates:</span>
      <a
        href={csvHref}
        download
        className="inline-flex items-center rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        Download CSV
      </a>
      {excelHref && (
        <a
          href={excelHref}
          download
          className="inline-flex items-center rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Download Excel
        </a>
      )}
    </div>
  );
}

async function extractCsvColumnValues(file: File, columnName: string) {
  const text = await file.text();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const index = headers.indexOf(columnName.toLowerCase());
  if (index === -1) return [];

  return Array.from(new Set(lines.slice(1)
    .map((line) => line.split(',')[index]?.trim() ?? '')
    .filter(Boolean)));
}

function ImportSection({ title, hint, type, onUpload, templateLinks }: ImportSectionProps) {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skuPreview, setSkuPreview] = useState<string[]>([]);

  async function handleUpload(file: File) {
    setError(null);
    setResult(null);
    setSkuPreview([]);
    try {
      if (type === 'plants') {
        const skuValues = await extractCsvColumnValues(file, 'sku');
        setSkuPreview(skuValues);
      }
      const r = await onUpload(file);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        <p className="text-xs text-gray-500 mt-1">{hint}</p>
        {templateLinks && (
          <TemplateDownloadLinks csvHref={templateLinks.csvHref} excelHref={templateLinks.excelHref} />
        )}
      </div>

      <FileUploader onUpload={handleUpload} />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {result && (
        <div className="space-y-4">
          <ImportResultsSummary
            totalRows={result.totalRows}
            importedCount={result.importedCount}
            skippedCount={result.skippedCount}
          />
          {result.skippedCount > 0 && result.issues.length > 0 && (
            <ImportIssuesTable issues={result.issues} />
          )}
          {type === 'plants' && result.importedCount > 0 && skuPreview.length > 0 && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-blue-900">Print labels for imported plants</p>
                <p className="text-xs text-blue-700">
                  Opens label print view with up to {skuPreview.length} imported SKUs preloaded.
                </p>
              </div>
              <a
                className="px-3 py-1.5 text-sm bg-hawk-600 text-white rounded-md hover:bg-hawk-700"
                href={`/print/labels?skus=${encodeURIComponent(skuPreview.join(','))}&density=sheet`}
                target="_blank"
                rel="noreferrer"
              >
                Print Labels
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ImportsPage() {
  const [tab, setTab] = useState<Tab>('import');
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<ImportBatch | null>(null);

  useEffect(() => {
    if (tab === 'history') {
      setLoadingHistory(true);
      importsApi.list()
        .then((r) => setBatches(r.items))
        .catch(() => {})
        .finally(() => setLoadingHistory(false));
    }
  }, [tab]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Imports</h1>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === 'import'
              ? 'border-hawk-600 text-hawk-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setTab('import')}
        >
          Import Data
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === 'history'
              ? 'border-hawk-600 text-hawk-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setTab('history')}
        >
          Import History
        </button>
      </div>

      {tab === 'import' && (
        <div className="space-y-6">
          <ImportSection
            type="plants"
            title="Import Plants"
            hint="Columns: SKU, Name, Variant, Price, Barcode"
            onUpload={(file) => importsApi.importPlants(file)}
            templateLinks={{
              csvHref: '/templates/plants-import-template.csv',
            }}
          />
          <ImportSection
            type="inventory"
            title="Import Inventory"
            hint="Columns: SKU (or Barcode), OnHandQty"
            onUpload={(file) => importsApi.importInventory(file)}
          />
          <ImportSection
            type="orders"
            title="Import Orders"
            hint="Columns: OrderNumber, CustomerDisplayName, SellerDisplayName, Sku, QtyOrdered"
            onUpload={(file) => importsApi.importOrders(file)}
            templateLinks={{
              csvHref: '/templates/orders-import-template.csv',
            }}
          />
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          {loadingHistory && <LoadingSpinner message="Loading import history..." />}

          {!loadingHistory && batches.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">No import history found.</p>
          )}

          {!loadingHistory && batches.length > 0 && !selectedBatch && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">File</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Imported</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Skipped</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {batches.map((b) => (
                    <tr key={b.id}>
                      <td className="px-4 py-2 text-sm text-gray-600">{new Date(b.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {b.type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900 font-mono">{b.filename}</td>
                      <td className="px-4 py-2 text-sm text-gray-600 text-right">{b.totalRows}</td>
                      <td className="px-4 py-2 text-sm text-green-600 text-right">{b.importedCount}</td>
                      <td className="px-4 py-2 text-sm text-right">
                        <span className={b.skippedCount > 0 ? 'text-amber-600' : 'text-gray-600'}>{b.skippedCount}</span>
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {b.skippedCount > 0 && (
                          <button
                            type="button"
                            className="text-blue-600 hover:text-blue-700 text-sm"
                            onClick={() => setSelectedBatch(b)}
                          >
                            View Issues
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedBatch && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="text-sm text-gray-500 hover:text-gray-700"
                  onClick={() => setSelectedBatch(null)}
                >
                  Back to History
                </button>
                <span className="text-sm text-gray-400">|</span>
                <span className="text-sm font-medium text-gray-700">
                  {selectedBatch.type} - {selectedBatch.filename}
                </span>
              </div>
              <ImportResultsSummary
                totalRows={selectedBatch.totalRows}
                importedCount={selectedBatch.importedCount}
                skippedCount={selectedBatch.skippedCount}
              />
              {selectedBatch.issues.length > 0 && (
                <ImportIssuesTable issues={selectedBatch.issues} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
