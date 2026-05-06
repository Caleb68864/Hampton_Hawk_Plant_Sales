import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore.js';
import { getMobileWorkflows } from '../../routes/mobileRouteConfig.js';
import { MobileGreeting } from '../../components/mobile/MobileGreeting.js';
import { MobileStatsRibbon } from '../../components/mobile/MobileStatsRibbon.js';
import { MobileQuickActionCard } from '../../components/mobile/MobileQuickActionCard.js';
import { MobilePrimaryButton } from '../../components/mobile/buttons/MobilePrimaryButton.js';

// Icon components
const PickupIcon = () => (
  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);

const LookupIcon = () => (
  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const WORKFLOW_META: Record<string, { icon: React.ReactNode; description: string }> = {
  pickup: {
    icon: <PickupIcon />,
    description: 'Process customer plant pickups by scanning barcodes',
  },
  lookup: {
    icon: <LookupIcon />,
    description: 'Look up orders and customer information',
  },
};

const STATS = [
  { label: 'Orders', value: '—' },
  { label: 'Ready', value: '—' },
  { label: 'Fulfilled', value: '—' },
];

export function MobileHomePage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const navigate = useNavigate();
  const workflows = getMobileWorkflows(currentUser);

  const firstEnabledWorkflow = workflows.find((w) => w.enabled);

  return (
    <>
      <div className="mobile-home">
        {/* === Phone layout (single column) / Tablet left panel === */}
        <div className="mobile-home__left">
          <MobileGreeting name={currentUser?.displayName} />

          <div style={{ marginTop: 16 }}>
            <MobileStatsRibbon stats={STATS} />
          </div>

          {firstEnabledWorkflow && (
            <div style={{ marginTop: 20 }}>
              <MobilePrimaryButton onClick={() => navigate(firstEnabledWorkflow.path)}>
                Start {firstEnabledWorkflow.label}
              </MobilePrimaryButton>
            </div>
          )}
        </div>

        {/* === Phone layout (single column) / Tablet right panel === */}
        <div className="mobile-home__right">
          {/* Station identity */}
          <div className="mobile-home__station-id">
            <span className="mobile-home__station-name">Hampton Hawks</span>
            {currentUser && (
              <span className="mobile-home__user-badge">
                {currentUser.displayName}
              </span>
            )}
          </div>

          {/* Quick-action cards */}
          <div className="mobile-home__cards">
            {workflows.map((w) => {
              const meta = WORKFLOW_META[w.id] ?? {
                icon: null,
                description: w.label,
              };
              return (
                <MobileQuickActionCard
                  key={w.id}
                  id={w.id}
                  title={w.label}
                  description={meta.description}
                  icon={meta.icon}
                  path={w.path}
                  enabled={w.enabled}
                  comingSoon={!w.enabled}
                />
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        .mobile-home {
          padding: 20px 16px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          box-sizing: border-box;
        }
        .mobile-home__left {
          display: flex;
          flex-direction: column;
        }
        .mobile-home__right {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .mobile-home__station-id {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        .mobile-home__station-name {
          font-family: var(--font-display, "Fraunces", serif);
          font-size: 13px;
          font-weight: 600;
          color: var(--color-hawk-400, #8a68a8);
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .mobile-home__user-badge {
          font-family: var(--font-body, "Manrope", sans-serif);
          font-size: 12px;
          color: var(--color-hawk-600, #4b2e6e);
          background: var(--color-hawk-50, #f5f0fa);
          padding: 2px 8px;
          border-radius: 20px;
          font-weight: 600;
        }
        .mobile-home__cards {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        @media (min-width: 768px) {
          .mobile-home {
            flex-direction: row;
            align-items: flex-start;
            padding: 28px 24px;
            gap: 32px;
          }
          .mobile-home__left {
            flex: 0 0 300px;
            max-width: 320px;
          }
          .mobile-home__right {
            flex: 1;
            min-width: 0;
          }
        }
      `}</style>
    </>
  );
}
