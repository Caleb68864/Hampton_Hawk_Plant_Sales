import type { ReactNode } from 'react';

export interface QuickAction {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

export interface BrandedStationGreetingProps {
  workstationName: string;
  saleStatus?: 'open' | 'closed';
  stats?: {
    ordersDone: number;
    plantsOut: number;
    inProgress: number;
  };
  quickActions: QuickAction[];
}

function getGreetingTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

export function BrandedStationGreeting({
  workstationName,
  saleStatus = 'open',
  stats,
  quickActions,
}: BrandedStationGreetingProps) {
  const timeOfDay = getGreetingTimeOfDay();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8 items-start">
      {/* Left column - greeting */}
      <div>
        {/* Ribbon */}
        <span
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-[0.18em] border"
          style={{
            background: 'linear-gradient(180deg, var(--color-gold-100), var(--color-gold-200))',
            borderColor: 'var(--color-gold-300)',
            color: 'var(--color-gold-900)',
          }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: 'var(--color-gold-600)',
              boxShadow: '0 0 0 3px rgba(212, 160, 33, 0.25)',
            }}
          />
          Spring Sale &middot; {saleStatus === 'open' ? 'Open' : 'Closed'}
        </span>

        {/* Main heading */}
        <h1
          className="text-5xl lg:text-6xl leading-none text-hawk-900 mt-3 mb-3"
          style={{
            fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
            fontVariationSettings: "'opsz' 144, 'SOFT' 80, 'wght' 500",
            letterSpacing: '-0.02em',
          }}
        >
          Good <em className="text-gold-700 italic font-semibold">{timeOfDay}</em>,{' '}
          {workstationName}.
        </h1>

        {/* Lede */}
        <p
          className="text-base text-hawk-700 max-w-[42ch] mb-5"
          style={{
            fontFamily: "var(--font-body), 'Manrope', sans-serif",
          }}
        >
          Scan the customer&rsquo;s order sheet to start, or tap a quick action below.
        </p>
      </div>

      {/* Right column - stats + quick actions */}
      <aside
        className="rounded-2xl p-5 border"
        style={{
          background: 'var(--joy-paper, #fbf7ee)',
          borderColor: 'var(--joy-rule, rgba(102, 46, 128, 0.12))',
          backgroundImage:
            'radial-gradient(at 100% 0%, var(--color-gold-50) 0%, transparent 40%), radial-gradient(at 0% 100%, var(--color-hawk-50) 0%, transparent 40%)',
        }}
      >
        {stats && (
          <>
            <p
              className="text-xs font-bold uppercase tracking-[0.22em] text-hawk-700 mb-3"
              style={{
                fontFamily: "var(--font-body), 'Manrope', sans-serif",
              }}
            >
              Today so far
            </p>
            <div className="flex gap-6 mb-5">
              <div>
                <div
                  className="text-4xl leading-none text-hawk-800"
                  style={{
                    fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
                    fontVariationSettings: "'opsz' 60, 'wght' 600",
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {stats.ordersDone}
                </div>
                <div
                  className="text-xs uppercase tracking-[0.22em] text-hawk-600 mt-1"
                  style={{
                    fontFamily: "var(--font-body), 'Manrope', sans-serif",
                  }}
                >
                  Orders done
                </div>
              </div>
              <div>
                <div
                  className="text-4xl leading-none text-hawk-800"
                  style={{
                    fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
                    fontVariationSettings: "'opsz' 60, 'wght' 600",
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {stats.plantsOut}
                </div>
                <div
                  className="text-xs uppercase tracking-[0.22em] text-hawk-600 mt-1"
                  style={{
                    fontFamily: "var(--font-body), 'Manrope', sans-serif",
                  }}
                >
                  Plants out
                </div>
              </div>
              <div>
                <div
                  className="text-4xl leading-none text-hawk-800"
                  style={{
                    fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
                    fontVariationSettings: "'opsz' 60, 'wght' 600",
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {stats.inProgress}
                </div>
                <div
                  className="text-xs uppercase tracking-[0.22em] text-hawk-600 mt-1"
                  style={{
                    fontFamily: "var(--font-body), 'Manrope', sans-serif",
                  }}
                >
                  In progress
                </div>
              </div>
            </div>
          </>
        )}

        {/* Quick action cards */}
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.title}
              type="button"
              className="group relative overflow-hidden border rounded-2xl p-4 flex flex-col items-start gap-2 bg-white cursor-pointer transition-all text-left"
              style={{
                borderColor: 'var(--joy-rule, rgba(102, 46, 128, 0.12))',
              }}
              onClick={action.onClick}
            >
              {/* Gold edge on hover */}
              <span
                className="absolute left-0 top-0 bottom-0 w-1 origin-top transition-transform duration-200 scale-y-0 group-hover:scale-y-100"
                style={{
                  background:
                    'linear-gradient(180deg, var(--color-gold-400), var(--color-hawk-600))',
                }}
              />
              <span
                className="w-10 h-10 rounded-xl grid place-items-center text-hawk-700"
                style={{
                  background: 'var(--color-hawk-50)',
                }}
              >
                {action.icon}
              </span>
              <span
                className="text-lg font-semibold text-hawk-900"
                style={{
                  fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
                }}
              >
                {action.title}
              </span>
              <span
                className="text-sm text-hawk-600"
                style={{
                  fontFamily: "var(--font-body), 'Manrope', sans-serif",
                }}
              >
                {action.description}
              </span>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
