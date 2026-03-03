import { useNavigate } from 'react-router-dom';

export function BackToStationHomeButton() {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate('/station')}
      className="fixed bottom-4 right-4 z-40 rounded-full bg-hawk-700 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-hawk-800"
    >
      ← Back to Station Home
    </button>
  );
}
