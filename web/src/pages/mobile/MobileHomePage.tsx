import { useAuthStore } from '../../stores/authStore.js';
import { getMobileWorkflows } from '../../routes/mobileRouteConfig.js';

export function MobileHomePage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const workflows = getMobileWorkflows(currentUser);

  return (
    <div className="mobile-home">
      <h1>Mobile</h1>
      <div className="mobile-home__workflows">
        {workflows.map((w) => (
          <div key={w.id} className="mobile-home__workflow-card mobile-home__workflow-card--coming-soon">
            <span>{w.label}</span>
            <span className="mobile-home__coming-soon-badge">Coming Soon</span>
          </div>
        ))}
      </div>
    </div>
  );
}
