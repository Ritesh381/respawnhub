import { useEffect, useState } from 'react';
import Icon, { TYPE_ICON } from './Icon.jsx';
import ConfirmButton from './ConfirmButton.jsx';
import StationForm from './StationForm.jsx';
import { createStation, deleteStation, listStations, updateStation } from '../api.js';
import { formatRupees, sortStations, typeLabel } from '../format.js';

export default function StationsView({ online, onChanged, notify }) {
  const [stations, setStations] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let ignore = false;
    listStations()
      .then((list) => {
        if (ignore) return;
        setStations(sortStations(list));
        setLoadError('');
      })
      .catch((err) => {
        if (!ignore) setLoadError(err.message);
      });
    return () => {
      ignore = true;
    };
  }, [version, online]);

  const refresh = () => {
    setVersion((v) => v + 1);
    onChanged();
  };

  async function addStation(data) {
    const created = await createStation(data);
    setAdding(false);
    notify(`Added ${created.code}`);
    refresh();
  }

  async function saveStation(station, data) {
    const saved = await updateStation(station.id, data);
    setEditingId(null);
    notify(`Saved ${saved.code}`);
    refresh();
  }

  async function run(station, action, done) {
    setBusyId(station.id);
    setActionError('');
    try {
      await action();
      notify(done);
      refresh();
    } catch (err) {
      setActionError(`${station.code}: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  }

  const toggleMaintenance = (s) =>
    run(
      s,
      () => updateStation(s.id, { is_active: !s.is_active }),
      s.is_active ? `${s.code} marked under maintenance` : `${s.code} is back in service`,
    );
  const remove = (s) => run(s, () => deleteStation(s.id), `Deleted ${s.code}`);

  const inactive = stations ? stations.filter((s) => !s.is_active).length : 0;

  return (
    <section className="view">
      <div className="view-head">
        <div className="view-heading">
          <h1 className="view-title">Stations</h1>
          <p className="view-sub">
            {stations
              ? `${stations.length} stations${inactive ? `, ${inactive} under maintenance` : ''}`
              : 'Loading stations...'}
          </p>
        </div>
        {!adding && (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setAdding(true);
              setEditingId(null);
            }}
          >
            <Icon name="plus" size={16} />
            Add station
          </button>
        )}
      </div>

      {adding && (
        <div className="panel">
          <StationForm stations={stations || []} onSave={addStation} onCancel={() => setAdding(false)} />
        </div>
      )}

      {actionError && (
        <div className="notice notice--error" role="alert">
          <Icon name="alert" size={16} />
          <span>{actionError}</span>
          <button type="button" className="notice-close" onClick={() => setActionError('')} aria-label="Dismiss">
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {!stations && !loadError && <p className="loading">Loading stations...</p>}
      {!stations && loadError && <p className="notice notice--error">Could not load stations. {loadError}</p>}
      {stations && stations.length === 0 && <p className="empty">No stations yet. Add the first one above.</p>}

      {stations && stations.length > 0 && (
        <table className="table stations-table">
          <caption className="sr-only">All stations</caption>
          <thead>
            <tr>
              <th scope="col">Station</th>
              <th scope="col">Type</th>
              <th scope="col" className="num">
                Rate
              </th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {stations.map((s) => {
              if (editingId === s.id) {
                return (
                  <tr key={s.id} className="edit-row">
                    <td colSpan={5}>
                      <StationForm
                        station={s}
                        stations={stations}
                        onSave={(data) => saveStation(s, data)}
                        onCancel={() => setEditingId(null)}
                      />
                    </td>
                  </tr>
                );
              }
              const busy = busyId === s.id;
              return (
                <tr key={s.id} className={s.is_active ? undefined : 'is-maint'}>
                  <td className="c-station">
                    <span className="cell-main">
                      <span className="code">{s.code}</span>
                      {!s.is_active && <span className="chip chip--maint">Maintenance</span>}
                    </span>
                    <span className="cell-name">{s.name}</span>
                    {s.specs && <span className="cell-sub">{s.specs}</span>}
                  </td>
                  <td className="c-type">
                    <span className="type-tag">
                      <Icon name={TYPE_ICON[s.type] || 'pc'} size={15} />
                      {typeLabel(s.type)}
                    </span>
                  </td>
                  <td className="c-amount num">{formatRupees(s.hourly_rate)}/h</td>
                  <td className="c-state">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!s.is_active}
                      aria-label={`${s.code} under maintenance`}
                      className="switch"
                      onClick={() => toggleMaintenance(s)}
                      disabled={busy}
                    >
                      <span className="switch-track" aria-hidden="true">
                        <span className="switch-thumb" />
                      </span>
                      <span className="switch-label" aria-hidden="true">
                        {s.is_active ? 'In service' : 'Under maintenance'}
                      </span>
                    </button>
                  </td>
                  <td className="c-actions">
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() => {
                          setEditingId(s.id);
                          setAdding(false);
                        }}
                        disabled={busy}
                      >
                        <Icon name="edit" size={14} />
                        Edit
                      </button>
                      <ConfirmButton
                        label="Delete"
                        confirmLabel={`Delete ${s.code}`}
                        onConfirm={() => remove(s)}
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
