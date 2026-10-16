import { useCallback, useEffect, useMemo, useState } from 'react';
import TopBar, { TABS } from './components/TopBar.jsx';
import StatsBar from './components/StatsBar.jsx';
import FloorView from './components/FloorView.jsx';
import BookingsView from './components/BookingsView.jsx';
import StationsView from './components/StationsView.jsx';
import BookingModal from './components/BookingModal.jsx';
import { getFloor, getStats, isReachable, onReachableChange } from './api.js';
import { formatTime } from './time.js';

const POLL_MS = 15000;
const RETRY_MS = 5000;

function tabFromHash() {
  const id = window.location.hash.replace('#', '');
  return TABS.some((t) => t.id === id) ? id : 'floor';
}

export default function App() {
  const [tab, setTab] = useState(tabFromHash);
  const [floor, setFloor] = useState(null);
  const [stats, setStats] = useState(null);
  const [floorError, setFloorError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [online, setOnline] = useState(isReachable);
  const [pollCount, setPollCount] = useState(0);
  const [booking, setBooking] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => onReachableChange(setOnline), []);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const selectTab = (id) => {
    setTab(id);
    if (window.location.hash !== `#${id}`) window.location.hash = id;
  };

  const loadFloor = useCallback(async () => {
    const [f, s] = await Promise.allSettled([getFloor(), getStats()]);
    if (f.status === 'fulfilled') {
      setFloor(f.value);
      setFloorError('');
      setUpdatedAt(new Date());
    } else {
      setFloorError(f.reason.message);
    }
    if (s.status === 'fulfilled') setStats(s.value);
  }, []);

  // Poll every 15 s, or every 5 s while the server is unreachable.
  useEffect(() => {
    let timer;
    let stopped = false;
    async function tick() {
      await loadFloor();
      if (stopped) return;
      setPollCount((n) => n + 1);
      timer = setTimeout(tick, isReachable() ? POLL_MS : RETRY_MS);
    }
    tick();
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadFloor();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadFloor]);

  useEffect(() => {
    if (!notice) return undefined;
    const id = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(id);
  }, [notice]);

  const notify = useCallback((text) => setNotice({ text, at: Date.now() }), []);

  const stations = useMemo(() => (floor ? floor.map((item) => item.station) : []), [floor]);

  function handleBooked(b) {
    setBooking(null);
    notify(`Booked ${b.station_code} for ${b.player_name}, ${formatTime(b.start_at)} to ${formatTime(b.end_at)}`);
    loadFloor();
    setPollCount((n) => n + 1);
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <TopBar tab={tab} onTab={selectTab} />
      <div className="offline-slot" role="status" aria-live="polite">
        {!online && (
          <div className="offline">
            <span className="offline-pulse" aria-hidden="true" />
            Can't reach the booking server. Retrying...
          </div>
        )}
      </div>
      <StatsBar stats={stats} />
      <main id="main" className="main" tabIndex={-1}>
        {tab === 'floor' && (
          <FloorView floor={floor} stats={stats} error={floorError} updatedAt={updatedAt} onBook={setBooking} />
        )}
        {tab === 'bookings' && (
          <BookingsView
            stations={stations}
            refreshKey={pollCount}
            onChanged={loadFloor}
            onNew={setBooking}
            notify={notify}
          />
        )}
        {tab === 'stations' && <StationsView online={online} onChanged={loadFloor} notify={notify} />}
      </main>
      {booking && (
        <BookingModal stations={stations} initial={booking} onClose={() => setBooking(null)} onBooked={handleBooked} />
      )}
      <div className="toast-slot" role="status" aria-live="polite">
        {notice && (
          <div className="toast" key={notice.at}>
            {notice.text}
          </div>
        )}
      </div>
    </>
  );
}
