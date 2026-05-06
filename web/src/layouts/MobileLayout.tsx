import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { MobileTopBar } from '../components/mobile/MobileTopBar.js';
import { MobileDrawer } from '../components/mobile/MobileDrawer.js';
import { MobileTabletRail } from '../components/mobile/MobileTabletRail.js';
import { MobilePageTransition } from '../components/mobile/MobilePageTransition.js';
import { MobileConnectionRequiredScene } from '../components/mobile/MobileConnectionRequiredScene.js';
import { MobileBackendUnavailableScene } from '../components/mobile/MobileBackendUnavailableScene.js';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';
import { useBackendAvailability } from '../hooks/useBackendAvailability.js';

const STATION_NAME = 'Hampton Hawks';

export function MobileLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const stationName = STATION_NAME;
  const { online } = useOnlineStatus();
  const { available } = useBackendAvailability();

  const connectionStatus = !online ? 'offline' : !available ? 'checking' : 'online';

  if (!online) {
    return (
      <MobileConnectionRequiredScene
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!available) {
    return <MobileBackendUnavailableScene />;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100svh',
        background: 'var(--joy-paper, #fff)',
      }}
    >
      <MobileTopBar
        onMenuOpen={() => setDrawerOpen(true)}
        stationName={stationName}
        connectionStatus={connectionStatus}
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Permanent left rail — shown only on tablet (>=768px via CSS inside component) */}
        <MobileTabletRail stationName={stationName} />

        {/* Main content */}
        <main
          className="mobile-page-bg"
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <MobilePageTransition>
            <Outlet />
          </MobilePageTransition>
        </main>
      </div>

      {/* Hamburger drawer — phone only */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
