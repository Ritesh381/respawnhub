import { formatRupees } from '../format.js';

function Stat({ label, tone, children, meter }) {
  return (
    <div className={tone ? `stat stat--${tone}` : 'stat'}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{children}</span>
      {meter != null && (
        <span className="stat-meter" aria-hidden="true">
          <span style={{ width: `${Math.min(100, Math.max(0, meter))}%` }} />
        </span>
      )}
    </div>
  );
}

export default function StatsBar({ stats }) {
  if (!stats) {
    return (
      <section className="statsbar" aria-label="Today" aria-busy="true">
        <div className="statsbar-inner">
          {['Live now', 'Occupancy', 'Bookings today', 'Revenue today'].map((label) => (
            <div className="stat" key={label}>
              <span className="stat-label">{label}</span>
              <span className="stat-value">
                <span className="skeleton skeleton--value" />
              </span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const occupancy = Math.round(stats.occupancy_percent ?? 0);
  return (
    <section className="statsbar" aria-label="Today">
      <div className="statsbar-inner">
        <Stat label="Live now" tone="live">
          {stats.live_now}
          <small> of {stats.active_stations} stations</small>
        </Stat>
        <Stat label="Occupancy" tone="cyan" meter={occupancy}>
          {occupancy}
          <small>%</small>
        </Stat>
        <Stat label="Bookings today">{stats.bookings_today}</Stat>
        <Stat label="Revenue today">{formatRupees(stats.revenue_today)}</Stat>
      </div>
    </section>
  );
}
