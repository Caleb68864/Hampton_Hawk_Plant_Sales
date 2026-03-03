import { useState, useRef, useCallback } from 'react';

interface FileUploaderProps {
  accept?: string;
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
}

export function FileUploader({ accept = '.csv,.xlsx', onUpload, disabled }: FileUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(file: File | undefined) {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx') return;
    setSelectedFile(file);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  }, []);

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    try {
      await onUpload(selectedFile);
    } finally {
      setUploading(false);
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-3">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-hawk-500 bg-hawk-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files?.[0])}
        />
        <p className="text-sm text-gray-600">
          {selectedFile
            ? selectedFile.name
            : 'Drop a CSV or XLSX file here, or click to browse'}
        </p>
        {selectedFile && (
          <p className="text-xs text-gray-400 mt-1">
            {(selectedFile.size / 1024).toFixed(1)} KB
          </p>
        )}
      </div>

      {selectedFile && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={uploading}
            className="px-4 py-2 text-sm font-medium text-white bg-hawk-600 rounded-md hover:bg-hawk-700 disabled:opacity-50"
            onClick={handleUpload}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
          <button
            type="button"
            disabled={uploading}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
            onClick={() => { setSelectedFile(null); if (inputRef.current) inputRef.current.value = ''; }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
