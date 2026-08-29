import { useState, useRef } from 'react';
import { MAX_UPLOAD_BYTES, describeFileRejection } from './fileRejection.js';

interface FileUploaderProps {
  accept?: string;
  allowedExtensions?: string[];
  promptText?: string;
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
  maxBytes?: number;
}

export function FileUploader({
  accept = '.csv,.xlsx',
  allowedExtensions = ['csv', 'xlsx'],
  promptText = 'Drop a CSV or XLSX file here, or click to browse',
  onUpload,
  disabled,
  maxBytes = MAX_UPLOAD_BYTES,
}: FileUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function resetInput() {
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleFileSelect(file: File | undefined) {
    if (!file) return;
    const reason = describeFileRejection(file, allowedExtensions, maxBytes);
    if (reason) {
      // Previously a wrong extension was silently ignored, which reads as
      // "the click did nothing" to a volunteer. Say why, and clear the input
      // so re-picking the same file fires change again.
      setSelectedFile(null);
      setRejection(reason);
      resetInput();
      return;
    }
    setRejection(null);
    setSelectedFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    try {
      await onUpload(selectedFile);
    } finally {
      setUploading(false);
      setSelectedFile(null);
      resetInput();
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
          aria-label="Choose a file to import"
          onChange={(e) => handleFileSelect(e.target.files?.[0])}
        />
        <p className="text-sm text-gray-600">
          {selectedFile
            ? selectedFile.name
            : promptText}
        </p>
        {selectedFile && (
          <p className="text-xs text-gray-400 mt-1">
            {(selectedFile.size / 1024).toFixed(1)} KB
          </p>
        )}
      </div>

      {rejection && (
        <p role="alert" className="text-sm text-red-600">{rejection}</p>
      )}

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
            onClick={() => { setSelectedFile(null); resetInput(); }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
