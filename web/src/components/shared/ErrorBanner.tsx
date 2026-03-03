interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

function parseBannerMessage(message: string) {
  const lines = message.split('\n').map((line) => line.trim()).filter(Boolean);
  const whatHappened = lines.find((line) => line.startsWith('What happened:'))?.replace('What happened:', '').trim();
  const whatToDoNext = lines.find((line) => line.startsWith('What to do next:'))?.replace('What to do next:', '').trim();
  const details = lines.find((line) => line.startsWith('Technical details:'))?.replace('Technical details:', '').trim();

  return {
    whatHappened: whatHappened ?? message,
    whatToDoNext,
    details,
  };
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  const parsed = parseBannerMessage(message);

  return (
    <div className="rounded-md bg-red-50 border border-red-200 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 text-sm text-red-700">
          <p><span className="font-semibold">What happened:</span> {parsed.whatHappened}</p>
          {parsed.whatToDoNext && (
            <p><span className="font-semibold">What to do next:</span> {parsed.whatToDoNext}</p>
          )}
          {parsed.details && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-red-600">
                Admin details
              </summary>
              <p className="mt-1 text-xs text-red-600 break-words">{parsed.details}</p>
            </details>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            className="text-red-500 hover:text-red-700 text-sm"
            onClick={onDismiss}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
