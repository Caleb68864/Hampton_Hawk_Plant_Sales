import type { ReactNode } from 'react';

interface PrintLayoutProps {
  children: ReactNode;
  backTo?: string;
  className?: string;
}

export function PrintLayout({ children, backTo, className }: PrintLayoutProps) {
  return (
    <div className={['max-w-4xl mx-auto p-6', className].filter(Boolean).join(' ')}>
      <div className="no-print mb-4 flex items-center gap-4">
        {backTo && (
          <a href={backTo} className="text-sm text-blue-600 hover:text-blue-700">
            &larr; Back
          </a>
        )}
        <button
          type="button"
          className="px-4 py-2 text-sm font-medium text-white bg-hawk-600 rounded-md hover:bg-hawk-700"
          onClick={() => window.print()}
        >
          Print
        </button>
      </div>
      {children}
    </div>
  );
}
