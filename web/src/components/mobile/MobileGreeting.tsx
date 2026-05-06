import { type FC } from 'react';

interface MobileGreetingProps {
  name?: string | null;
}

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

export const MobileGreeting: FC<MobileGreetingProps> = ({ name }) => {
  const time = getTimeOfDay();

  return (
    <div
      style={{
        fontFamily: 'var(--font-display, "Fraunces", serif)',
        fontSize: 28,
        fontWeight: 600,
        color: 'var(--color-hawk-900, #1e0a35)',
        lineHeight: 1.25,
      }}
    >
      {'Good '}
      <em
        style={{
          fontStyle: 'italic',
          color: 'var(--color-gold-500, #c9910a)',
          fontWeight: 700,
        }}
      >
        {time}
      </em>
      {name ? `, ${name}` : ''}
      {'.'}
    </div>
  );
};
