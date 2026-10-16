const PATHS = {
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  chevronLeft: <path d="M14.5 6l-6 6 6 6" />,
  chevronRight: <path d="M9.5 6l6 6-6 6" />,
  edit: (
    <>
      <path d="M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  undo: <path d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 010 11H11" />,
  ban: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 6l12 12" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.5L2.5 20h19L12 3.5z" />
      <path d="M12 10v4.5M12 17.2v.3" />
    </>
  ),
  pc: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M8.5 20h7M12 16v4" />
    </>
  ),
  console: (
    <>
      <path d="M7.5 7.5h9a4.5 4.5 0 014.5 4.5v.5a3.5 3.5 0 01-6.2 2.2l-.8-1h-4l-.8 1A3.5 3.5 0 013 12.5V12a4.5 4.5 0 014.5-4.5z" />
      <path d="M8 10.2v3.2M6.4 11.8h3.2M15.5 11h.01M17.5 12.6h.01" />
    </>
  ),
  vr: (
    <>
      <path d="M4.5 7.5h15A1.5 1.5 0 0121 9v5.5a2 2 0 01-2 2h-3.6l-1.9-2.4h-3l-1.9 2.4H5a2 2 0 01-2-2V9a1.5 1.5 0 011.5-1.5z" />
      <path d="M8 4.5h8" />
    </>
  ),
};

export const TYPE_ICON = { PC: 'pc', PS5: 'console', XBOX: 'console', VR: 'vr' };

export default function Icon({ name, size = 18, className }) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

export function LogoMark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" className="logo-mark">
      <rect x="1.5" y="1.5" width="29" height="29" rx="7" fill="#0f1422" stroke="#2de2f5" strokeOpacity=".55" />
      <g fill="none" stroke="#2de2f5" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M25 16a9 9 0 1 1-9-9c2.5 0 4.9 1 6.7 2.7L25 12" />
        <path d="M25 7v5h-5" />
      </g>
      <path d="M13.5 12.2v7.6l6.2-3.8z" fill="#ff4fd8" />
    </svg>
  );
}
