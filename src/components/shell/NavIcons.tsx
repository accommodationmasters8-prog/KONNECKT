/**
 * Tab bar icons.
 *
 * Drawn on the brand's own geometry rather than pulled from an icon set: each
 * one is built from the chevron angle or a triangle, so the tab bar reads as
 * part of the same system as the mark. Stroked at 1.75 so they hold up at
 * 22px on a mid-range screen. About 200 bytes each, inline, no icon font.
 */
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: 'false' as const,
};

export function HomeIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      {/* A roof at the chevron angle rather than the usual 45deg. */}
      <path d="M4 11.2 12 4l8 7.2" />
      <path d="M6 10.4V20h12v-9.6" />
    </svg>
  );
}

export function EventsIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <rect x="3.2" y="5" width="17.6" height="15.5" rx="3.5" />
      <path d="M3.2 9.6h17.6M8 3.5v3M16 3.5v3" />
      <path d="M12 12.4l2.4 3.8H9.6z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function MapIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M9 4.2 3.4 6.6v13.2L9 17.4l6 2.4 5.6-2.4V4.2L15 6.6z" />
      <path d="M9 4.2v13.2M15 6.6v13.2" />
    </svg>
  );
}

export function MembershipIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      {/* Three stacked rungs — the tier ladder, not a generic star. */}
      <path d="M4.5 17.5h15M6.5 13h11M8.5 8.5h7" />
      <path d="M12 2.6l2.2 3.5H9.8z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function MeIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="8.4" r="3.9" />
      <path d="M4.8 20.2a7.4 7.4 0 0 1 14.4 0" />
    </svg>
  );
}

export function BlogIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M5 4.5h9.5L19 9v10.5H5z" />
      <path d="M14.5 4.5V9H19M8 12.5h8M8 16h5" />
    </svg>
  );
}

export function OpportunitiesIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <rect x="3.2" y="7.4" width="17.6" height="12.6" rx="3" />
      <path d="M8.8 7.4V5.6a2 2 0 0 1 2-2h2.4a2 2 0 0 1 2 2v1.8" />
      <path d="M3.2 12.6h17.6" />
    </svg>
  );
}
