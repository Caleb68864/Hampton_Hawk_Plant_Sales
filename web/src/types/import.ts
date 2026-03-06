export type ImportType = 'Plants' | 'Orders' | 'Inventory';

export interface ImportBatch {
  id: string;
  type: ImportType;
  filename: string;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  createdAt: string;
}

export interface ImportIssue {
  id: string;
  rowNumber: number;
  issueType: string;
  barcode: string | null;
  sku: string | null;
  message: string;
  rawData?: string | null;
}

export interface ImportResult {
  batchId: string;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  issueCount: number;
  dryRun: boolean;
}
