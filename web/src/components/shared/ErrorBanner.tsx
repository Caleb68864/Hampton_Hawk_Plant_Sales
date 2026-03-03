interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div className="rounded-md bg-red-50 border border-red-200 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-red-700">{message}</p>
        {onDismiss && (
          <button
            type="button"
            className="ml-4 text-red-500 hover:text-red-700 text-sm"
            onClick={onDismiss}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
