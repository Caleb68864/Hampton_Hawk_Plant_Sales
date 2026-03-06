import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-hawk-700">404</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Page not found</h1>
        <p className="mt-3 text-sm text-gray-600">
          The page you requested does not exist or the link is outdated.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/" className="rounded-md bg-hawk-600 px-4 py-2 text-sm font-medium text-white hover:bg-hawk-700">
            Go to Dashboard
          </Link>
          <Link to="/orders" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Go to Orders
          </Link>
        </div>
      </div>
    </div>
  );
}
