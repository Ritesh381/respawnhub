const TIMEOUT_MS = 10000;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Tracks whether the booking server answered the last request, so the app can
// show one banner instead of every view reporting its own network error.
let reachable = true;
const listeners = new Set();

function setReachable(value) {
  if (value === reachable) return;
  reachable = value;
  listeners.forEach((fn) => fn(value));
}

export function isReachable() {
  return reachable;
}

export function onReachableChange(fn) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function toQuery(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') q.set(key, String(value));
  });
  const text = q.toString();
  return text ? `?${text}` : '';
}

function errorMessage(data, status) {
  const detail = data && data.detail;
  if (typeof detail === 'string' && detail) return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0];
    const msg = typeof first === 'string' ? first : first && first.msg;
    if (msg) return String(msg).replace(/^Value error,\s*/i, '');
  }
  if (status === 404) return 'Not found';
  if (status >= 500) return "Can't reach the booking server";
  return `Request failed (${status})`;
}

async function request(path, { method = 'GET', body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? { Accept: 'application/json' } : { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    setReachable(false);
    throw new ApiError("Can't reach the booking server", 0);
  } finally {
    clearTimeout(timer);
  }

  // A proxy in front of a stopped backend answers 500/502/503/504.
  setReachable(res.status < 500);

  if (res.status === 204) return null;
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) throw new ApiError(errorMessage(data, res.status), res.status);
  return data;
}

export const getFloor = () => request('/floor');
export const getStats = () => request('/stats');

export const listStations = (params) => request(`/stations${toQuery(params)}`);
export const createStation = (data) => request('/stations', { method: 'POST', body: data });
export const updateStation = (id, data) => request(`/stations/${id}`, { method: 'PUT', body: data });
export const deleteStation = (id) => request(`/stations/${id}`, { method: 'DELETE' });

export const listBookings = (params) => request(`/bookings${toQuery(params)}`);
export const createBooking = (data) => request('/bookings', { method: 'POST', body: data });
export const updateBooking = (id, data) => request(`/bookings/${id}`, { method: 'PUT', body: data });
export const deleteBooking = (id) => request(`/bookings/${id}`, { method: 'DELETE' });
