// The cafe runs on India time (UTC+05:30, no daylight saving), whatever the
// browser timezone is. Display goes through Intl with the cafe timezone and
// anything sent to the API carries an explicit +05:30 offset.

export const CAFE_TZ = 'Asia/Kolkata';
export const CAFE_OFFSET = '+05:30';

const OFFSET_MS = 330 * 60 * 1000;
const SLOT_MS = 30 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const timeFmt = new Intl.DateTimeFormat('en-IN', {
  timeZone: CAFE_TZ,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const clockFmt = new Intl.DateTimeFormat('en-IN', {
  timeZone: CAFE_TZ,
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
});

const dayFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: CAFE_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Plain calendar dates are formatted in UTC so the label never shifts.
const dayLabelFmt = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

// ICU versions differ: "7:30 pm", "7:30 PM", "7:30 p.m.". Normalise to "7:30 pm".
function tidyAmPm(text) {
  return text
    .replace(/[  ]/g, ' ')
    .replace(/\s*([ap])\.?\s?m\.?/i, (_, p) => ` ${p.toLowerCase()}m`);
}

export function formatTime(value) {
  if (value == null) return '';
  return tidyAmPm(timeFmt.format(toDate(value)));
}

export function formatClock(value) {
  return tidyAmPm(clockFmt.format(toDate(value)));
}

// Today's date in the cafe as YYYY-MM-DD.
export function cafeToday(now = new Date()) {
  const parts = Object.fromEntries(
    dayFmt.formatToParts(toDate(now)).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function cafeDateOf(value) {
  return cafeToday(toDate(value));
}

export function formatDayLabel(dateStr) {
  return dayLabelFmt.format(new Date(`${dateStr}T00:00:00Z`)).replace(',', '');
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// "7:30 pm" today, "tomorrow 1:00 am", otherwise "Sat 17 Oct 7:30 pm".
export function formatWhen(value, now = new Date()) {
  const day = cafeDateOf(value);
  const today = cafeToday(now);
  if (day === today) return formatTime(value);
  if (day === addDays(today, 1)) return `tomorrow ${formatTime(value)}`;
  return `${formatDayLabel(day)} ${formatTime(value)}`;
}

export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}

export function minutesBetween(start, end) {
  return Math.round((toDate(end) - toDate(start)) / 60000);
}

// countdown(end, now, 'free in') -> "free in 25 min"
export function countdown(value, now = new Date(), lead = 'in') {
  const mins = Math.ceil((toDate(value) - toDate(now)) / 60000);
  if (mins <= 0) return `${lead} under a minute`;
  return `${lead} ${formatDuration(mins)}`;
}

// ISO string for a cafe-local date and "HH:MM" time.
export function buildIso(dateStr, hhmm) {
  return `${dateStr}T${hhmm}:00${CAFE_OFFSET}`;
}

// ISO string with the cafe offset for an epoch millisecond value.
export function toCafeIso(ms) {
  return new Date(ms + OFFSET_MS).toISOString().slice(0, 19) + CAFE_OFFSET;
}

function wallClock(ms) {
  return new Date(ms + OFFSET_MS).toISOString().slice(11, 16);
}

// 30 minute start options for a cafe date. For today the list begins at the
// current half hour, which is the earliest start the server accepts.
export function startOptions(dateStr, now = new Date()) {
  const today = cafeToday(now);
  if (dateStr < today) return [];
  const dayStart = Date.parse(`${dateStr}T00:00:00${CAFE_OFFSET}`);
  let first = dayStart;
  if (dateStr === today) {
    // IST is offset by a whole number of half hours, so UTC slots line up.
    first = Math.floor(toDate(now).getTime() / SLOT_MS) * SLOT_MS;
  }
  const options = [];
  for (let ms = first; ms < dayStart + DAY_MS; ms += SLOT_MS) {
    options.push({ value: wallClock(ms), label: formatTime(ms), ms });
  }
  return options;
}
