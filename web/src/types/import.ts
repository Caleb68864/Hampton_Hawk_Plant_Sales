export type ImportType = 'Plants' | 'Orders' | 'Inventory';

export interface ImportBatch {
  id: string;
  type: ImportType;
  filename: string;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  issues: ImportIssue[];
  createdAt: string;
}

export interface ImportIssue {
  id: string;
  importBatchId: string;
  rowNumber: number;
  issueType: string;
  barcode: string | null;
  sku: string | null;
  message: string;
  rawData: Record<string, unknown>;
  createdAt: string;
}

export interface ImportResult {
  batchId: string;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  issues: ImportIssue[];
}
