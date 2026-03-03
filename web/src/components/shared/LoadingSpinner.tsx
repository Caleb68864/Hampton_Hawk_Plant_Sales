export function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-hawk-600 border-t-transparent" />
      <p className="mt-3 text-sm text-gray-500">{message}</p>
    </div>
  );
}
