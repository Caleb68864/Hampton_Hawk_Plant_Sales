import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore.js';

export function AccessDeniedPage() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-8 text-center">
        <div className="text-5xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-600 mb-6">You don't have permission to view this page.</p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg py-2 transition-colors"
          >
            Go to Dashboard
          </button>
          <button
            onClick={() => void handleLogout()}
            className="w-full border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg py-2 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
