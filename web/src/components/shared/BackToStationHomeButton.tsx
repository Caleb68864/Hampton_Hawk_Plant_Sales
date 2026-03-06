import { useNavigate } from 'react-router-dom';

interface BackToStationHomeButtonProps {
  to?: string;
  label?: string;
  className?: string;
}

export function BackToStationHomeButton({
  to = '/station',
  label = 'Back to Station Home',
  className = '',
}: BackToStationHomeButtonProps) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className={`fixed bottom-4 right-4 z-40 rounded-full bg-hawk-700 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-hawk-800 ${className}`.trim()}
    >
      ← {label}
    </button>
  );
}
