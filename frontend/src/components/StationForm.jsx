import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { TYPES, typeLabel } from '../format.js';

const CODE_RE = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;

function nextCode(type, stations) {
  const prefix = `${type}-`;
  const numbers = stations
    .filter((s) => s.code.startsWith(prefix))
    .map((s) => Number.parseInt(s.code.slice(prefix.length), 10))
    .filter(Number.isFinite);
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return `${prefix}${String(next).padStart(2, '0')}`;
}

function initialValues(station) {
  if (!station) return { code: '', name: '', type: 'PC', hourly_rate: '', specs: '', maintenance: false };
  return {
    code: station.code,
    name: station.name,
    type: station.type,
    hourly_rate: String(station.hourly_rate),
    specs: station.specs || '',
    maintenance: !station.is_active,
  };
}

export default function StationForm({ station, stations, onSave, onCancel }) {
  const editing = Boolean(station);
  const idp = editing ? `sf-${station.id}` : 'sf-new';
  const [values, setValues] = useState(() => initialValues(station));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    rootRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    rootRef.current?.querySelector('input')?.focus({ preventScroll: true });
  }, []);

  const suggested = nextCode(values.type, stations);
  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setValues((v) => ({ ...v, [field]: value }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    const code = values.code.trim().toUpperCase();
    const rate = Number(values.hourly_rate);
    const found = {};
    if (!code) found.code = 'Enter a code, for example ' + suggested;
    else if (!CODE_RE.test(code) || code.length > 20) found.code = 'Use capital letters, digits and hyphens, like PC-09';
    if (!values.name.trim()) found.name = 'Enter a name';
    if (!Number.isInteger(rate) || rate <= 0) found.hourly_rate = 'Rate must be a whole number of rupees above 0';
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      rootRef.current?.querySelector(`#${idp}-${first}`)?.focus();
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      await onSave({
        code,
        name: values.name.trim(),
        type: values.type,
        hourly_rate: rate,
        is_active: !values.maintenance,
        specs: values.specs.trim(),
      });
    } catch (err) {
      setFormError(err.message);
      setSaving(false);
    }
  }

  const describe = (field) => (errors[field] ? `${idp}-${field}-err` : undefined);

  return (
    <form ref={rootRef} className="station-form" onSubmit={handleSubmit} noValidate>
      <h2 className="panel-title">{editing ? `Edit ${station.code}` : 'Add station'}</h2>
      <div className="form-grid">
        <div className="field field--third">
          <label htmlFor={`${idp}-code`}>Code</label>
          <input
            id={`${idp}-code`}
            type="text"
            autoComplete="off"
            spellCheck="false"
            maxLength={20}
            placeholder={suggested}
            value={values.code}
            onChange={(e) => setValues((v) => ({ ...v, code: e.target.value.toUpperCase().replace(/\s+/g, '-') }))}
            aria-invalid={errors.code ? 'true' : undefined}
            aria-describedby={describe('code')}
          />
          {errors.code && (
            <p className="field-error" id={`${idp}-code-err`}>
              {errors.code}
            </p>
          )}
        </div>
        <div className="field field--third">
          <label htmlFor={`${idp}-type`}>Type</label>
          <select id={`${idp}-type`} value={values.type} onChange={set('type')}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {typeLabel(t)}
              </option>
            ))}
          </select>
        </div>
        <div className="field field--third">
          <label htmlFor={`${idp}-hourly_rate`}>Rate per hour (₹)</label>
          <input
            id={`${idp}-hourly_rate`}
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={values.hourly_rate}
            onChange={set('hourly_rate')}
            aria-invalid={errors.hourly_rate ? 'true' : undefined}
            aria-describedby={describe('hourly_rate')}
          />
          {errors.hourly_rate && (
            <p className="field-error" id={`${idp}-hourly_rate-err`}>
              {errors.hourly_rate}
            </p>
          )}
        </div>
        <div className="field field--full">
          <label htmlFor={`${idp}-name`}>Name</label>
          <input
            id={`${idp}-name`}
            type="text"
            autoComplete="off"
            maxLength={80}
            value={values.name}
            onChange={set('name')}
            aria-invalid={errors.name ? 'true' : undefined}
            aria-describedby={describe('name')}
          />
          {errors.name && (
            <p className="field-error" id={`${idp}-name-err`}>
              {errors.name}
            </p>
          )}
        </div>
        <div className="field field--full">
          <label htmlFor={`${idp}-specs`}>
            Specs <span className="optional">optional</span>
          </label>
          <textarea id={`${idp}-specs`} rows={2} value={values.specs} onChange={set('specs')} />
        </div>
        <label className="check field--full">
          <input type="checkbox" checked={values.maintenance} onChange={set('maintenance')} />
          Under maintenance (cannot be booked)
        </label>
      </div>

      {formError && (
        <p className="notice notice--error" role="alert">
          <Icon name="alert" size={16} />
          {formError}
        </p>
      )}

      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving...' : editing ? 'Save changes' : 'Add station'}
        </button>
      </div>
    </form>
  );
}
