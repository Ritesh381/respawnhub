import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import ConfirmButton from './ConfirmButton.jsx';
import { deleteBooking, listBookings, updateBooking } from '../api.js';
import { TYPES, formatPhone, formatRupees, sortStations, typeLabel } from '../format.js';
import { addDays, cafeToday, formatDayLabel, formatDuration, formatTime, minutesBetween } from '../time.js';

const STATE = {
  UPCOMING: { key: 'upcoming', label: 'Upcoming' },
  LIVE: { key: 'live', label: 'Live' },
  COMPLETED: { key: 'done', label: 'Completed' },
  CANCELLED: { key: 'cancelled', label: 'Cancelled' },
};

function StateChip({ state }) {
  const info = STATE[state] || STATE.UPCOMING;
  return (
    <span className={`chip chip--${info.key}`}>
      <span className="pill-dot" aria-hidden="true" />
      {info.label}
    </span>
  );
}

export default function BookingsView({ stations, refreshKey, onChanged, onNew, notify }) {
  const [date, setDate] = useState(() => cafeToday());
  const [stationId, setStationId] = useState('');
  const [result, setResult] = useState({ key: '', rows: null });
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [version, setVersion] = useState(0);

  const queryKey = `${date}|${stationId}`;

  useEffect(() => {
    let ignore = false;
    listBookings({ date, station_id: stationId || undefined })
      .then((rows) => {
        if (ignore) return;
        setResult({ key: `${date}|${stationId}`, rows });
        setLoadError('');
      })
      .catch((err) => {
        if (!ignore) setLoadError(err.message);
      });
    return () => {
      ignore = true;
    };
  }, [date, stationId, refreshKey, version]);

  const rows = result.key === queryKey ? result.rows : null;
  const sorted = useMemo(() => sortStations(stations), [stations]);
  const today = cafeToday();

  const summary = useMemo(() => {
    if (!rows) return '';
    const live = rows.filter((b) => b.status !== 'CANCELLED');
    const cancelled = rows.length - live.length;
    const total = live.reduce((sum, b) => sum + b.amount, 0);
    const parts = [`${live.length} ${live.length === 1 ? 'booking' : 'bookings'}`, formatRupees(total)];
    if (cancelled) parts.push(`${cancelled} cancelled`);
    return parts.join(', ');
  }, [rows]);

  async function run(booking, action, done) {
    setBusyId(booking.id);
    setActionError('');
    try {
      await action();
      notify(done);
      setVersion((v) => v + 1);
      onChanged();
    } catch (err) {
      setActionError(`${booking.station_code} at ${formatTime(booking.start_at)}: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  }

  const cancel = (b) =>
    run(b, () => updateBooking(b.id, { status: 'CANCELLED' }), `Cancelled ${b.station_code} for ${b.player_name}`);
  const restore = (b) =>
    run(b, () => updateBooking(b.id, { status: 'BOOKED' }), `Restored ${b.station_code} for ${b.player_name}`);
  const remove = (b) => run(b, () => deleteBooking(b.id), `Deleted booking for ${b.player_name}`);

  const selected = sorted.find((s) => String(s.id) === stationId);

  return (
    <section className="view">
      <div className="view-head">
        <div className="view-heading">
          <h1 className="view-title">Bookings</h1>
          <p className="view-sub">
            {formatDayLabel(date)}
            {date === today && ' (today)'}
            {summary && `, ${summary}`}
          </p>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => onNew({ date, stationId: selected ? selected.id : undefined })}
        >
          <Icon name="plus" size={16} />
          New booking
        </button>
      </div>

      <div className="toolbar">
        <div className="field field--inline">
          <label htmlFor="bf-date">Date</label>
          <div className="date-nav">
            <button type="button" className="icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
              <Icon name="chevronLeft" />
            </button>
            <input id="bf-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            <button type="button" className="icon-btn" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">
              <Icon name="chevronRight" />
            </button>
            {date !== today && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDate(today)}>
                Today
              </button>
            )}
          </div>
        </div>
        <div className="field field--inline">
          <label htmlFor="bf-station">Station</label>
          <select id="bf-station" value={stationId} onChange={(e) => setStationId(e.target.value)}>
            <option value="">All stations</option>
            {TYPES.map((type) => {
              const list = sorted.filter((s) => s.type === type);
              if (!list.length) return null;
              return (
                <optgroup key={type} label={typeLabel(type)}>
                  {list.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>
      </div>

      {actionError && (
        <div className="notice notice--error" role="alert">
          <Icon name="alert" size={16} />
          <span>{actionError}</span>
          <button type="button" className="notice-close" onClick={() => setActionError('')} aria-label="Dismiss">
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {!rows && !loadError && <p className="loading">Loading bookings...</p>}
      {!rows && loadError && <p className="notice notice--error">Could not load bookings. {loadError}</p>}

      {rows && rows.length === 0 && (
        <p className="empty">
          {selected ? `No bookings for ${selected.code} on this day` : 'No bookings for this day'}
        </p>
      )}

      {rows && rows.length > 0 && (
        <table className="table bookings-table">
          <caption className="sr-only">Bookings for {formatDayLabel(date)}</caption>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Station</th>
              <th scope="col">Player</th>
              <th scope="col" className="num">
                Amount
              </th>
              <th scope="col">State</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => {
              const busy = busyId === b.id;
              return (
                <tr key={b.id} className={b.state === 'CANCELLED' ? 'is-cancelled' : undefined}>
                  <td className="c-time">
                    <span className="cell-main num-font">
                      {formatTime(b.start_at)} to {formatTime(b.end_at)}
                    </span>
                    <span className="cell-sub">{formatDuration(minutesBetween(b.start_at, b.end_at))}</span>
                  </td>
                  <td className="c-station">
                    <span className="cell-main code">{b.station_code}</span>
                    <span className="cell-sub">
                      {typeLabel(b.station_type)}, {b.station_name}
                    </span>
                  </td>
                  <td className="c-player">
                    <span className="cell-main">{b.player_name}</span>
                    {b.player_phone && <span className="cell-sub">{formatPhone(b.player_phone)}</span>}
                  </td>
                  <td className="c-amount num">{formatRupees(b.amount)}</td>
                  <td className="c-state">
                    <StateChip state={b.state} />
                  </td>
                  <td className="c-actions">
                    <div className="row-actions">
                      {(b.state === 'UPCOMING' || b.state === 'LIVE') && (
                        <button type="button" className="btn btn--sm" onClick={() => cancel(b)} disabled={busy}>
                          <Icon name="ban" size={14} />
                          Cancel
                        </button>
                      )}
                      {b.state === 'CANCELLED' && (
                        <button type="button" className="btn btn--sm" onClick={() => restore(b)} disabled={busy}>
                          <Icon name="undo" size={14} />
                          Restore
                        </button>
                      )}
                      <ConfirmButton
                        label="Delete"
                        confirmLabel="Delete booking"
                        onConfirm={() => remove(b)}
                        disabled={busy}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
