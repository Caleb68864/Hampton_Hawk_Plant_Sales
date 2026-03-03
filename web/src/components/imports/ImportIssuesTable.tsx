import { useState, useMemo } from 'react';
import { SearchBar } from '@/components/shared/SearchBar.js';
import { PaginationControls } from '@/components/shared/PaginationControls.js';
import type { ImportIssue } from '@/types/import.js';

interface ImportIssuesTableProps {
  issues: ImportIssue[];
}

export function ImportIssuesTable({ issues }: ImportIssuesTableProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    if (!search.trim()) return issues;
    const q = search.toLowerCase();
    return issues.filter(
      (i) =>
        i.message.toLowerCase().includes(q) ||
        i.issueType.toLowerCase().includes(q) ||
        (i.sku && i.sku.toLowerCase().includes(q)) ||
        (i.barcode && i.barcode.toLowerCase().includes(q)) ||
        String(i.rowNumber).includes(q),
    );
  }, [issues, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">
          Import Issues ({filtered.length})
        </h3>
        <div className="w-64">
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Filter issues..." />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Row #</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Issue Type</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Barcode</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {paginated.map((issue) => (
              <tr key={issue.id}>
                <td className="px-4 py-2 text-sm text-gray-900">{issue.rowNumber}</td>
                <td className="px-4 py-2 text-sm">
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    {issue.issueType}
                  </span>
                </td>
                <td className="px-4 py-2 text-sm text-gray-600 font-mono">{issue.sku ?? '-'}</td>
                <td className="px-4 py-2 text-sm text-gray-600 font-mono">{issue.barcode ?? '-'}</td>
                <td className="px-4 py-2 text-sm text-gray-700">{issue.message}</td>
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-sm text-gray-500 text-center">
                  No issues found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > pageSize && (
        <PaginationControls
          page={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      )}
    </div>
  );
}
