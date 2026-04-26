import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BrandedStationGreeting,
  type QuickAction,
} from '@/components/shared/BrandedStationGreeting.js';

interface StationModeCard {
  title: string;
  mode: string;
  icon: string;
  instruction: string;
  to: string;
  colorClass: string;
}

const modeCards: StationModeCard[] = [
  {
    title: 'Scan Pickups',
    mode: 'scan',
    icon: '📷',
    instruction: 'Find a customer order, open it, and scan each plant barcode to fulfill pickup items.',
    to: '/pickup',
    colorClass: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  },
  {
    title: 'Lookup & Print',
    mode: 'lookup',
    icon: '🖨️',
    instruction: 'Search by customer, order number, or pickup code and print only the paperwork volunteers need.',
    to: '/lookup-print',
    colorClass: 'border-sky-300 bg-sky-50 text-sky-900',
  },
  {
    title: 'Walk-Up Sales',
    mode: 'walkup',
    icon: '🛍️',
    instruction: 'Create a same-day walk-up order with live availability checks and admin overrides when required.',
    to: '/walkup/new',
    colorClass: 'border-amber-300 bg-amber-50 text-amber-900',
  },
  {
    title: 'Admin Tools',
    mode: 'admin',
    icon: '🛠️',
    instruction: 'Open sale controls and operational settings used by supervisors and checkout leads.',
    to: '/settings',
    colorClass: 'border-violet-300 bg-violet-50 text-violet-900',
  },
];

// Icon components for quick actions
function ScanIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7h18" />
      <path d="M3 12h18" />
      <path d="M3 17h18" />
    </svg>
  );
}

function WalkUpIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12h4l3-9 4 18 3-9h6" />
    </svg>
  );
}

function OrdersIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 4 4 5-7" />
    </svg>
  );
}

export function StationHomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const presetMode = searchParams.get('mode');
    const selectedMode = modeCards.find((card) => card.mode === presetMode);
    if (selectedMode) {
      navigate(selectedMode.to, { replace: true });
    }
  }, [navigate, searchParams]);

  const quickActions: QuickAction[] = [
    {
      icon: <ScanIcon />,
      title: 'Pick list scan',
      description: "Load a buyer or student's plants",
      onClick: () => navigate('/pickup'),
    },
    {
      icon: <WalkUpIcon />,
      title: 'New walk-up',
      description: 'Cash-register flow',
      onClick: () => navigate('/walkup/new'),
    },
    {
      icon: <OrdersIcon />,
      title: 'Order list',
      description: 'Sortable, bulk actions',
      onClick: () => navigate('/orders'),
    },
    {
      icon: <ReportsIcon />,
      title: 'Reports',
      description: 'By student, by buyer',
      onClick: () => navigate('/reports'),
    },
  ];

  // Placeholder stats - these could be driven by a hook in the future
  const stats = {
    ordersDone: 38,
    plantsOut: 241,
    inProgress: 12,
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <BrandedStationGreeting
        workstationName="Pickup Station 1"
        saleStatus="open"
        stats={stats}
        quickActions={quickActions}
      />
    </div>
  );
}
