const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatRupees(amount) {
  return rupees.format(amount ?? 0);
}

export const TYPES = ['PC', 'PS5', 'XBOX', 'VR'];

export const TYPE_LABEL = { PC: 'PC', PS5: 'PS5', XBOX: 'Xbox', VR: 'VR' };

export function typeLabel(type) {
  return TYPE_LABEL[type] || type;
}

function typeRank(type) {
  const i = TYPES.indexOf(type);
  return i === -1 ? TYPES.length : i;
}

export function sortStations(list) {
  return [...list].sort(
    (a, b) => typeRank(a.type) - typeRank(b.type) || a.code.localeCompare(b.code, 'en', { numeric: true }),
  );
}

// Same rule as the server: rupees per hour pro rata, rounded half up.
export function priceFor(hourlyRate, minutes) {
  return Math.floor((hourlyRate * minutes + 30) / 60);
}

export function formatPhone(phone) {
  if (!phone) return '';
  return phone.length === 10 ? `${phone.slice(0, 5)} ${phone.slice(5)}` : phone;
}
