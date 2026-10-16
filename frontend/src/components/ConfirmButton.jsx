import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

// Two step delete: first click arms it, second click confirms.
export default function ConfirmButton({ label, confirmLabel, onConfirm, disabled }) {
  const [armed, setArmed] = useState(false);
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!armed) return undefined;
    confirmRef.current?.focus();
    const id = setTimeout(() => setArmed(false), 6000);
    return () => clearTimeout(id);
  }, [armed]);

  if (!armed) {
    return (
      <button type="button" className="btn btn--sm btn--quiet-danger" onClick={() => setArmed(true)} disabled={disabled}>
        <Icon name="trash" size={14} />
        {label}
      </button>
    );
  }

  return (
    <span className="confirm">
      <button
        ref={confirmRef}
        type="button"
        className="btn btn--sm btn--danger"
        onClick={() => {
          setArmed(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>
      <button type="button" className="btn btn--sm btn--ghost" onClick={() => setArmed(false)}>
        Keep
      </button>
    </span>
  );
}
