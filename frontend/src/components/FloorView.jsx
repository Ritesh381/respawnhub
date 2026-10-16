import { useLayoutEffect, useRef, useState } from 'react';
import Icon, { TYPE_ICON } from './Icon.jsx';
import { useNow } from '../useNow.js';
import { TYPES, formatRupees, typeLabel } from '../format.js';
import { countdown, formatTime, formatWhen } from '../time.js';

const STATUS = {
  FREE: { key: 'free', label: 'Free', legend: 'Free' },
  LIVE: { key: 'live', label: 'Live', legend: 'Live' },
  RESERVED_SOON: { key: 'soon', label: 'Reserved', legend: 'Reserved soon' },
  MAINTENANCE: { key: 'maint', label: 'Maintenance', legend: 'Maintenance' },
};

function statusInfo(status) {
  return STATUS[status] || STATUS.FREE;
}

function TileDetail({ item, now }) {
  const { status, current_end: end, next_start: next, current_player: player } = item;
  if (status === 'LIVE') {
    return (
      <>
        <span className="tile-player">{player || 'Walk-in'}</span>
        <span className="tile-line">
          ends {formatTime(end)}
          <span className="tile-count">{countdown(end, now, 'free in')}</span>
        </span>
      </>
    );
  }
  if (status === 'RESERVED_SOON') {
    return (
      <span className="tile-line">
        booked from {formatTime(next)}
        <span className="tile-count">{countdown(next, now, 'starts in')}</span>
      </span>
    );
  }
  if (status === 'MAINTENANCE') {
    return <span className="tile-line">{next ? `next booking ${formatWhen(next, now)}` : 'not bookable'}</span>;
  }
  return <span className="tile-line">{next ? `free until ${formatWhen(next, now)}` : 'nothing booked'}</span>;
}

function StationTile({ item, now, onBook }) {
  const { station, status } = item;
  const info = statusInfo(status);
  const bookable = status === 'FREE' || status === 'RESERVED_SOON';

  const body = (
    <>
      <span className={`pill pill--${info.key}`}>
        <span className="pill-dot" aria-hidden="true" />
        {info.label}
      </span>
      <span className="tile-top">
        <span className="tile-code">{station.code}</span>
        <span className="tile-rate">{formatRupees(station.hourly_rate)}/h</span>
      </span>
      <span className="tile-name" title={station.name}>
        {station.name}
      </span>
      <span className="tile-detail">
        <TileDetail item={item} now={now} />
      </span>
      {bookable && (
        <span className="tile-cta">
          <Icon name="plus" size={14} />
          Book
        </span>
      )}
    </>
  );

  if (bookable) {
    return (
      <button type="button" className={`tile tile--${info.key}`} onClick={() => onBook({ stationId: station.id })}>
        {body}
      </button>
    );
  }
  return <div className={`tile tile--${info.key}`}>{body}</div>;
}

// Pick a column count that splits tiles into even rows (8 tiles: 8, 4x2 or 2x4)
// instead of leaving a single tile stranded on the last row.
function useBalancedColumns(count) {
  const ref = useRef(null);
  const [cols, setCols] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => {
      const style = getComputedStyle(el);
      const min = parseFloat(style.getPropertyValue('--tile-min')) || 158;
      const gap = parseFloat(style.columnGap) || 10;
      const fit = Math.max(1, Math.floor((el.clientWidth + gap) / (min + gap)));
      const rows = Math.ceil(count / fit);
      setCols(Math.ceil(count / rows));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [count]);
  return [ref, cols];
}

function Zone({ type, items, typeStats, now, onBook }) {
  const [tilesRef, cols] = useBalancedColumns(items.length);
  const free = items.filter((i) => i.status === 'FREE').length;
  const id = `zone-${type}`;
  return (
    <section className="zone" style={{ '--n': items.length }} aria-labelledby={id}>
      <header className="zone-head">
        <h2 className="zone-title" id={id}>
          <Icon name={TYPE_ICON[type] || 'pc'} size={16} />
          {typeLabel(type)}
        </h2>
        <p className="zone-meta">
          {free}/{items.length} free
          {typeStats && (
            <>
              <span className="sep" aria-hidden="true" />
              {typeStats.bookings} today, {formatRupees(typeStats.revenue)}
            </>
          )}
        </p>
      </header>
      <div
        className="tiles"
        ref={tilesRef}
        style={cols ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } : undefined}
      >
        {items.map((item) => (
          <StationTile key={item.station.id} item={item} now={now} onBook={onBook} />
        ))}
      </div>
    </section>
  );
}

function FloorSkeleton() {
  return (
    <div className="floor-plan" aria-hidden="true">
      {[8, 3, 2, 1].map((n, z) => (
        <section className="zone" style={{ '--n': n }} key={z}>
          <header className="zone-head">
            <span className="skeleton skeleton--label" />
          </header>
          <div className="tiles">
            {Array.from({ length: n }, (_, i) => (
              <div className="tile tile--skeleton" key={i} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function FloorView({ floor, stats, error, updatedAt, onBook }) {
  const now = useNow(20000);

  const head = (meta) => (
    <div className="view-head">
      <div className="view-heading">
        <h1 className="view-title">Floor Cafe</h1>
        <p className="view-sub">{meta}</p>
      </div>
      {floor && (
        <ul className="legend" aria-label="Stations by status">
          {Object.entries(STATUS).map(([status, info]) => (
            <li key={status} className={`legend-item legend-item--${info.key}`}>
              <span className="legend-swatch" aria-hidden="true" />
              {info.legend}
              <strong>{floor.filter((i) => i.status === status).length}</strong>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn btn--primary" onClick={() => onBook({})}>
        <Icon name="plus" size={16} />
        New booking
      </button>
    </div>
  );

  if (!floor) {
    return (
      <section className="view">
        {head(error ? 'Floor data unavailable' : 'Loading floor...')}
        {error && !error.startsWith("Can't reach") && <p className="notice notice--error">{error}</p>}
        <FloorSkeleton />
      </section>
    );
  }

  const types = [...TYPES, ...new Set(floor.map((i) => i.station.type).filter((t) => !TYPES.includes(t)))];
  const zones = types
    .map((type) => ({ type, items: floor.filter((i) => i.station.type === type) }))
    .filter((z) => z.items.length);
  const byType = Object.fromEntries((stats?.by_type || []).map((t) => [t.type, t]));

  return (
    <section className="view">
      {head(`${floor.length} stations, updated ${formatTime(updatedAt)}`)}
      {error && (
        <p className="notice notice--warn">
          Showing the floor as of {formatTime(updatedAt)}. {error.startsWith("Can't reach") ? '' : error}
        </p>
      )}
      {zones.length === 0 ? (
        <p className="empty">No stations set up yet. Add them from the Stations tab.</p>
      ) : (
        <div className="floor-plan">
          {zones.map((z) => (
            <Zone key={z.type} type={z.type} items={z.items} typeStats={byType[z.type]} now={now} onBook={onBook} />
          ))}
        </div>
      )}
    </section>
  );
}
