/**
 * Console icons.
 *
 * Same construction as the tab bar's: drawn on the brand's geometry, stroked
 * at 1.75, about 200 bytes each, no icon font and no icon package. A sidebar
 * of eight icons costs less than one request to a CDN would.
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

type P = { className?: string };

export function OverviewIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <rect x="3.2" y="3.2" width="7.4" height="8.6" rx="2.2" />
      <rect x="13.4" y="3.2" width="7.4" height="5.4" rx="2.2" />
      <rect x="3.2" y="14.4" width="7.4" height="6.4" rx="2.2" />
      <rect x="13.4" y="11.2" width="7.4" height="9.6" rx="2.2" />
    </svg>
  );
}

export function EventsIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <rect x="3.2" y="5" width="17.6" height="15.5" rx="3.5" />
      <path d="M3.2 9.6h17.6M8 3.5v3M16 3.5v3" />
      <path d="M12 12.4l2.4 3.8H9.6z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CheckinIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <rect x="3.2" y="4.4" width="17.6" height="15.2" rx="3.5" />
      <path d="M8 12.2l2.8 2.8 5.2-5.6" />
    </svg>
  );
}

export function AccountsIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <rect x="2.8" y="5.6" width="18.4" height="12.8" rx="3.2" />
      <path d="M2.8 10.2h18.4" />
      <path d="M6.6 14.6h3.6" />
    </svg>
  );
}

export function VerificationIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3.2l7.2 3v5.4c0 4.2-3 7.4-7.2 9.2-4.2-1.8-7.2-5-7.2-9.2V6.2z" />
      <path d="M9.2 12.2l2 2 3.6-3.8" />
    </svg>
  );
}

export function SponsorshipIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M12 20.4V9.6" />
      <path d="M12 9.6L6.4 4.2h11.2z" />
      <circle cx="12" cy="15.6" r="3.4" />
    </svg>
  );
}

export function MembersIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <circle cx="9.4" cy="8.6" r="3.6" />
      <path d="M3.4 20.2c0-3.4 2.7-5.8 6-5.8s6 2.4 6 5.8" />
      <path d="M16.2 5.6a3.4 3.4 0 0 1 0 6.4M17.6 14.8c1.9.7 3.2 2.4 3.2 4.6" />
    </svg>
  );
}

export function AuditIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M6 3.4h8.6L19 7.8v12.8H6z" />
      <path d="M14.2 3.6v4.4h4.4" />
      <path d="M9 12.6h6.2M9 16.2h4" />
    </svg>
  );
}

export function PartnersIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M3.4 12.2l4-4.4h4l2.6 2.4-2.6 2.4-1.8-1.6" />
      <path d="M11 9.8h5l4.6 4.4-3.8 4-2.2-2-2 1.8-2-1.8-2 1.6-3.4-3.4" />
    </svg>
  );
}

export function SettingsIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.6M12 18.6v2.6M4.5 4.5l1.9 1.9M17.6 17.6l1.9 1.9M2.8 12h2.6M18.6 12h2.6M4.5 19.5l1.9-1.9M17.6 6.4l1.9-1.9" />
    </svg>
  );
}

export function SignOutIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M14.6 4.4H6.8v15.2h7.8" />
      <path d="M11.4 12h9.4M17.6 8.6l3.4 3.4-3.4 3.4" />
    </svg>
  );
}

export function SearchIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <circle cx="11" cy="11" r="6.4" />
      <path d="M15.8 15.8l4.4 4.4" />
    </svg>
  );
}

export function CommunicationIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M4 5.6h16v10.2H9.6L5.4 19.4v-3.6H4z" />
      <path d="M8 9.4h8M8 12.4h5" />
    </svg>
  );
}

export function ProductsIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <rect x="3.2" y="6.4" width="17.6" height="12.4" rx="3" />
      <path d="M8.2 6.4V5a2 2 0 0 1 2-2h3.6a2 2 0 0 1 2 2v1.4" />
      <path d="M3.2 11.4h17.6M11 13.6h2" />
    </svg>
  );
}

export function FreelancersIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="7.6" r="3.4" />
      <path d="M5.6 20.4c0-3.5 2.9-6.2 6.4-6.2s6.4 2.7 6.4 6.2" />
      <path d="M16.8 3.6l1.4 2.2 2.4.4-1.8 1.7.5 2.5-2.1-1.2" fill="none" />
    </svg>
  );
}

export function CategoriesIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <rect x="3.4" y="3.4" width="7" height="7" rx="2.2" />
      <rect x="13.6" y="3.4" width="7" height="7" rx="2.2" />
      <rect x="3.4" y="13.6" width="7" height="7" rx="2.2" />
      <rect x="13.6" y="13.6" width="7" height="7" rx="2.2" />
    </svg>
  );
}

export function StationsIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M12 21.2s6.6-5.4 6.6-10.2a6.6 6.6 0 1 0-13.2 0C5.4 15.8 12 21.2 12 21.2z" />
      <circle cx="12" cy="10.6" r="2.6" />
    </svg>
  );
}

export function AccessIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <circle cx="8.4" cy="12" r="4" />
      <path d="M12.4 12h8.2v3.2M17.6 12v2.6" />
    </svg>
  );
}

/** Performance: three bars, one taller. A ranking, not a chart. */
export function NetworkIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M4.5 20.2V13.4" />
      <path d="M12 20.2V4.6" />
      <path d="M19.5 20.2V9.8" />
    </svg>
  );
}
