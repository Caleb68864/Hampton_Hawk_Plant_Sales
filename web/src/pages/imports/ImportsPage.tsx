import { useState, useEffect } from 'react';
import { importsApi } from '@/api/imports.js';
import { FileUploader } from '@/components/imports/FileUploader.js';
import { ImportResultsSummary } from '@/components/imports/ImportResultsSummary.js';
import { ImportIssuesTable } from '@/components/imports/ImportIssuesTable.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import type { ImportBatch, ImportIssue, ImportResult } from '@/types/import.js';

type Tab = 'import' | 'history';

interface ImportSectionProps {
  title: string;
  hint: string;
  type: 'plants' | 'orders' | 'inventory';
  accept?: string;
  allowedExtensions?: string[];
  promptText?: string;
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

function ImportSection({ title, hint, type, accept, allowedExtensions, promptText, onUpload, templateLinks }: ImportSectionProps) {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skuPreview, setSkuPreview] = useState<string[]>([]);

  async function handleUpload(file: File) {
    setError(null);
    setResult(null);
    setIssues([]);
    setSkuPreview([]);

    try {
      if (type === 'plants') {
        const skuValues = await extractCsvColumnValues(file, 'sku');
        setSkuPreview(skuValues);
      }

      const uploadResult = await onUpload(file);
      setResult(uploadResult);

      if (uploadResult.skippedCount > 0 && uploadResult.batchId) {
        setLoadingIssues(true);
        try {
          const issueResult = await importsApi.getIssues(uploadResult.batchId, { page: 1, pageSize: 200 });
          setIssues(issueResult.items);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Import completed, but issue details could not be loaded.');
        } finally {
          setLoadingIssues(false);
        }
      }
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

      <FileUploader
        onUpload={handleUpload}
        accept={accept}
        allowedExtensions={allowedExtensions}
        promptText={promptText}
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {result && (
        <div className="space-y-4">
          <ImportResultsSummary
            totalRows={result.totalRows}
            importedCount={result.importedCount}
            skippedCount={result.skippedCount}
          />
          {loadingIssues && <LoadingSpinner message="Loading import issues..." />}
          {!loadingIssues && issues.length > 0 && <ImportIssuesTable issues={issues} />}
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
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<ImportBatch | null>(null);
  const [selectedBatchIssues, setSelectedBatchIssues] = useState<ImportIssue[]>([]);
  const [loadingBatchIssues, setLoadingBatchIssues] = useState(false);

  useEffect(() => {
    if (tab !== 'history') {
      return;
    }

    setLoadingHistory(true);
    setHistoryError(null);
    setSelectedBatch(null);
    setSelectedBatchIssues([]);

    importsApi.list({ page: 1, pageSize: 100 })
      .then((response) => setBatches(response.items))
      .catch((e) => setHistoryError(e instanceof Error ? e.message : 'Failed to load import history'))
      .finally(() => setLoadingHistory(false));
  }, [tab]);

  async function importOrdersWithDuplicateConfirmation(file: File) {
    try {
      return await importsApi.importOrders(file);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Import failed';
      const hasDuplicateOrderNumber =
        message.toLowerCase().includes('order number') && message.toLowerCase().includes('already exists');

      if (!hasDuplicateOrderNumber) {
        throw e;
      }

      const confirmed = window.confirm(
        `${message}\n\nThis order number is already in the system. Do you want to import it with a new order number?`,
      );

      if (!confirmed) {
        throw e;
      }

      return importsApi.importOrders(file, true);
    }
  }

  async function openBatchIssues(batch: ImportBatch) {
    setSelectedBatch(batch);
    setSelectedBatchIssues([]);
    setLoadingBatchIssues(true);
    setHistoryError(null);

    try {
      const response = await importsApi.getIssues(batch.id, { page: 1, pageSize: 200 });
      setSelectedBatchIssues(response.items);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : 'Failed to load import issues');
    } finally {
      setLoadingBatchIssues(false);
    }
  }

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

      {historyError && <ErrorBanner message={historyError} onDismiss={() => setHistoryError(null)} />}

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
            hint="Columns: CustomerDisplayName, SellerDisplayName, PlantSKU, Qty, Notes (CSV/XLSX) or Hampton customer-order PDF"
            accept=".csv,.xlsx,.pdf"
            allowedExtensions={['csv', 'xlsx', 'pdf']}
            promptText="Drop a CSV, XLSX, or order PDF file here, or click to browse"
            onUpload={(file) => importOrdersWithDuplicateConfirmation(file)}
            templateLinks={{
              csvHref: '/templates/orders-import-template.csv',
            }}
          />
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          {loadingHistory && <LoadingSpinner message="Loading import history..." />}

          {!loadingHistory && batches.length === 0 && !selectedBatch && (
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
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {batches.map((batch) => (
                    <tr key={batch.id}>
                      <td className="px-4 py-2 text-sm text-gray-600">{new Date(batch.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {batch.type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900 font-mono">{batch.filename}</td>
                      <td className="px-4 py-2 text-sm text-gray-600 text-right">{batch.totalRows}</td>
                      <td className="px-4 py-2 text-sm text-green-600 text-right">{batch.importedCount}</td>
                      <td className="px-4 py-2 text-sm text-right">
                        <span className={batch.skippedCount > 0 ? 'text-amber-600' : 'text-gray-600'}>{batch.skippedCount}</span>
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {batch.skippedCount > 0 && (
                          <button
                            type="button"
                            className="text-blue-600 hover:text-blue-700 text-sm"
                            onClick={() => openBatchIssues(batch)}
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
                  onClick={() => {
                    setSelectedBatch(null);
                    setSelectedBatchIssues([]);
                  }}
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
              {loadingBatchIssues && <LoadingSpinner message="Loading import issues..." />}
              {!loadingBatchIssues && selectedBatchIssues.length > 0 && (
                <ImportIssuesTable issues={selectedBatchIssues} />
              )}
              {!loadingBatchIssues && selectedBatch.skippedCount > 0 && selectedBatchIssues.length === 0 && (
                <p className="text-sm text-gray-500">No issues were returned for this batch.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
