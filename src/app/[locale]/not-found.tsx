import Link from 'next/link';
import { KonektMark } from '@/components/KonektMark';

export default function NotFound() {
  return (
    <main
      className="on-ink"
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--surface-inverse)',
        color: 'var(--text-on-inverse)',
        padding: 'var(--gutter)',
        textAlign: 'center',
      }}
    >
      <div style={{ display: 'grid', gap: 'var(--space-md)', justifyItems: 'center' }}>
        <div style={{ inlineSize: 64 }}>
          <KonektMark />
        </div>
        <h1 className="t-h1" style={{ color: 'var(--text-on-inverse)' }}>
          404
        </h1>
        <p className="t-muted">
          This page does not exist. / Ukurasa huu haupo.
        </p>
        <Link href="/en" prefetch={false} className="btn btn--primary">
          Back to Konekt / Rudi Konekt
        </Link>
      </div>
    </main>
  );
}
