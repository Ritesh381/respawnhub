import { LogoMark } from './Icon.jsx';
import { useNow } from '../useNow.js';
import { cafeToday, formatClock, formatDayLabel } from '../time.js';

export const TABS = [
  { id: 'floor', label: 'Floor' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'stations', label: 'Stations' },
];

function Clock() {
  const now = useNow(1000);
  return (
    <div className="clock">
      <span className="sr-only">Cafe time </span>
      <time className="clock-time" dateTime={now.toISOString()}>
        {formatClock(now)}
      </time>
      <span className="clock-day">{formatDayLabel(cafeToday(now))} IST</span>
    </div>
  );
}

export default function TopBar({ tab, onTab }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <LogoMark />
          <span className="brand-name">
            Respawn<span>Hub</span>
          </span>
        </div>
        <nav className="tabs" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="tab"
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => onTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <Clock />
      </div>
    </header>
  );
}
