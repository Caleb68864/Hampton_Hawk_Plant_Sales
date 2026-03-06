import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

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

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Station Home</h1>
        <p className="mt-1 text-gray-600">Choose a station workflow below, or use a preset link such as <span className="font-mono">/station?mode=scan</span>.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {modeCards.map((card) => (
          <button
            key={card.mode}
            type="button"
            className={`w-full rounded-xl border-2 p-6 text-left shadow-sm transition hover:shadow-md ${card.colorClass}`}
            onClick={() => navigate(card.to)}
          >
            <p className="text-3xl" aria-hidden>{card.icon}</p>
            <h2 className="mt-2 text-2xl font-bold">{card.title}</h2>
            <p className="mt-2 text-sm leading-6">{card.instruction}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
