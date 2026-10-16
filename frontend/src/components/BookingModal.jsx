import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { createBooking, listBookings } from '../api.js';
import { TYPES, formatRupees, priceFor, sortStations, typeLabel } from '../format.js';
import { buildIso, cafeToday, formatDayLabel, formatDuration, formatTime, startOptions, toCafeIso } from '../time.js';
import { useNow } from '../useNow.js';

const MAX_MINUTES = 480;
const DURATIONS = Array.from({ length: MAX_MINUTES / 30 }, (_, i) => (i + 1) * 30);

export default function BookingModal({ stations, initial, onClose, onBooked }) {
  const dialogRef = useRef(null);
  const now = useNow(30000);
  const today = cafeToday(now);

  const active = useMemo(() => sortStations(stations.filter((s) => s.is_active)), [stations]);

  const [stationId, setStationId] = useState(() => {
    const pre = active.find((s) => s.id === initial.stationId);
    return String(pre ? pre.id : active[0]?.id ?? '');
  });
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState(() => {
    const t = cafeToday();
    return initial.date && initial.date > t ? initial.date : t;
  });
  const [start, setStart] = useState('');
  const [duration, setDuration] = useState(60);
  const [taken, setTaken] = useState({ key: '', list: [] });
  const [takenVersion, setTakenVersion] = useState(0);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    if (dialog && !dialog.open) dialog.showModal();
    dialog?.querySelector('[data-autofocus]')?.focus();
    return () => {
      if (dialog?.open) dialog.close();
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, []);

  // Existing bookings for the chosen station and day, used to grey out taken slots.
  const takenKey = `${stationId}|${date}`;
  useEffect(() => {
    if (!stationId) return undefined;
    let ignore = false;
    listBookings({ date, station_id: stationId, status: 'BOOKED' })
      .then((list) => {
        if (ignore) return;
        setTaken({
          key: `${stationId}|${date}`,
          list: list.map((b) => ({ start: Date.parse(b.start_at), end: Date.parse(b.end_at) })),
        });
      })
      .catch(() => {
        if (!ignore) setTaken({ key: `${stationId}|${date}`, list: [] });
      });
    return () => {
      ignore = true;
    };
  }, [stationId, date, takenVersion]);

  const busy = taken.key === takenKey ? taken.list : [];
  const station = active.find((s) => String(s.id) === stationId);

  const options = useMemo(
    () =>
      startOptions(date, now).map((o) => ({
        ...o,
        blocked: busy.some((b) => b.start <= o.ms && o.ms < b.end),
      })),
    [date, now, busy],
  );
  const chosen = options.find((o) => o.value === start && !o.blocked) || options.find((o) => !o.blocked) || null;

  const nextBusyStart = chosen
    ? busy.filter((b) => b.start > chosen.ms).reduce((min, b) => Math.min(min, b.start), Infinity)
    : Infinity;
  const maxMinutes = Math.min(MAX_MINUTES, Math.floor((nextBusyStart - (chosen?.ms ?? 0)) / 60000 / 30) * 30);
  const minutes = Math.max(30, duration <= maxMinutes ? duration : maxMinutes);
  const endMs = chosen ? chosen.ms + minutes * 60000 : null;
  const amount = station ? priceFor(station.hourly_rate, minutes) : 0;

  const upcomingTaken = busy.filter((b) => b.end > now.getTime());

  function focusField(id) {
    dialogRef.current?.querySelector(`#${id}`)?.focus();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const found = {};
    if (!station) found.station = 'Pick a station';
    if (!name.trim()) found.name = 'Enter the player name';
    if (phone && !/^\d{10}$/.test(phone)) found.phone = 'Phone number must be 10 digits';
    if (!chosen) found.start = 'No start times left on this day';
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      focusField(`bk-${first}`);
      return;
    }

    setSaving(true);
    setSubmitError('');
    try {
      const booking = await createBooking({
        station_id: station.id,
        player_name: name.trim(),
        player_phone: phone || null,
        start_at: buildIso(date, chosen.value),
        end_at: toCafeIso(endMs),
      });
      onBooked(booking);
    } catch (err) {
      setSubmitError(err.message);
      setSaving(false);
      setTakenVersion((v) => v + 1);
    }
  }

  const grouped = TYPES.map((type) => ({ type, list: active.filter((s) => s.type === type) }))
    .concat([{ type: 'Other', list: active.filter((s) => !TYPES.includes(s.type)) }])
    .filter((g) => g.list.length);

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby="booking-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <form className="modal-body" onSubmit={handleSubmit} noValidate>
        <header className="modal-head">
          <h2 id="booking-title">New booking</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>

        {active.length === 0 ? (
          <p className="notice notice--warn">
            {stations.length === 0
              ? 'Station list has not loaded yet. Try again in a moment.'
              : 'Every station is under maintenance right now.'}
          </p>
        ) : (
          <div className="form-grid">
            <div className="field field--full">
              <label htmlFor="bk-station">Station</label>
              <select
                id="bk-station"
                value={stationId}
                onChange={(e) => {
                  setSubmitError('');
                  setStationId(e.target.value);
                }}
                aria-invalid={errors.station ? 'true' : undefined}
                {...(initial.stationId ? {} : { 'data-autofocus': true })}
              >
                {grouped.map((g) => (
                  <optgroup key={g.type} label={typeLabel(g.type)}>
                    {g.list.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code}, {s.name} ({formatRupees(s.hourly_rate)}/h)
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {upcomingTaken.length > 0 && (
                <p className="hint">
                  Already booked {date === today ? 'today' : `on ${formatDayLabel(date)}`}:{' '}
                  {upcomingTaken.map((b) => `${formatTime(b.start)} to ${formatTime(b.end)}`).join(', ')}
                </p>
              )}
            </div>

            <div className="field">
              <label htmlFor="bk-name">Player name</label>
              <input
                id="bk-name"
                type="text"
                autoComplete="off"
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={errors.name ? 'true' : undefined}
                aria-describedby={errors.name ? 'bk-name-err' : undefined}
                {...(initial.stationId ? { 'data-autofocus': true } : {})}
              />
              {errors.name && (
                <p className="field-error" id="bk-name-err">
                  {errors.name}
                </p>
              )}
            </div>

            <div className="field">
              <label htmlFor="bk-phone">
                Phone <span className="optional">optional</span>
              </label>
              <input
                id="bk-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="off"
                maxLength={10}
                placeholder="10 digits"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                aria-invalid={errors.phone ? 'true' : undefined}
                aria-describedby={errors.phone ? 'bk-phone-err' : undefined}
              />
              {errors.phone && (
                <p className="field-error" id="bk-phone-err">
                  {errors.phone}
                </p>
              )}
            </div>

            <div className="field field--third">
              <label htmlFor="bk-date">Date</label>
              <input
                id="bk-date"
                type="date"
                min={today}
                value={date}
                onChange={(e) => {
                  if (!e.target.value) return;
                  setSubmitError('');
                  setDate(e.target.value);
                }}
              />
            </div>

            <div className="field field--third">
              <label htmlFor="bk-start">Start</label>
              <select
                id="bk-start"
                value={chosen?.value ?? ''}
                onChange={(e) => {
                  setSubmitError('');
                  setStart(e.target.value);
                }}
                disabled={!chosen}
                aria-invalid={errors.start ? 'true' : undefined}
                aria-describedby={errors.start ? 'bk-start-err' : undefined}
              >
                {!chosen && <option value="">No times left</option>}
                {options.map((o) => (
                  <option key={o.value} value={o.value} disabled={o.blocked}>
                    {o.label}
                    {o.blocked ? ' (booked)' : ''}
                  </option>
                ))}
              </select>
              {errors.start && (
                <p className="field-error" id="bk-start-err">
                  {errors.start}
                </p>
              )}
            </div>

            <div className="field field--third">
              <label htmlFor="bk-duration">Duration</label>
              <select id="bk-duration" value={minutes} onChange={(e) => {
                  setSubmitError('');
                  setDuration(Number(e.target.value));
                }} disabled={!chosen}>
                {DURATIONS.map((m) => (
                  <option key={m} value={m} disabled={m > maxMinutes}>
                    {formatDuration(m)}
                  </option>
                ))}
              </select>
            </div>

            {chosen && maxMinutes < MAX_MINUTES && (
              <p className="hint field--full">
                Next booking on this station starts at {formatTime(nextBusyStart)}, so the longest slot is{' '}
                {formatDuration(maxMinutes)}.
              </p>
            )}

            <div className="quote field--full" aria-live="polite">
              <div className="quote-slot">
                <span className="quote-code">{station?.code ?? 'No station'}</span>
                <span>
                  {chosen ? `${formatTime(chosen.ms)} to ${formatTime(endMs)}` : 'Pick another day'}
                  {date !== today && <> on {formatDayLabel(date)}</>}
                </span>
                <span className="quote-sub">
                  {formatDuration(minutes)}
                  {station && <> at {formatRupees(station.hourly_rate)}/h</>}
                </span>
              </div>
              <div className="quote-amount">{formatRupees(amount)}</div>
            </div>
          </div>
        )}

        {submitError && (
          <p className="notice notice--error" role="alert">
            <Icon name="alert" size={16} />
            {submitError}
          </p>
        )}

        <footer className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving || active.length === 0}>
            {saving ? 'Booking...' : 'Confirm booking'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
