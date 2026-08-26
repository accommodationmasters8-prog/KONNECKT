import type { Metadata } from 'next';
import { KonektLogo } from '@/components/KonektLogo';
import { PrintButton } from '@/components/staff/PrintButton';
import { getStaffSession } from '@/lib/staff-session';
import { buildReport } from '@/lib/report';
import { resolveLocale } from '@/lib/page';
import styles from './print.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Report — Konekt tracker',
  robots: { index: false, follow: false },
};

/**
 * The report, laid out for paper.
 *
 * A print stylesheet rather than a generated PDF. Every browser turns this
 * into a PDF through its own print dialogue, at the reader's own paper size,
 * with their own margins and selectable text — and it costs no PDF library, no
 * font embedding and no server-side rendering pass. A generated file would
 * look identical and be worse in every one of those respects.
 *
 * It runs the same `buildReport` as the CSV route, so the two can never
 * disagree about what a figure is.
 */
export default async function ReportPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await resolveLocale(params);
  const q = await searchParams;
  const session = await getStaffSession();

  if (!session.signedIn) {
    return (
      <main className={styles.page}>
        <p className={styles.empty}>Sign in to build a report.</p>
      </main>
    );
  }

  const report = await buildReport({
    kind: q.kind ?? 'reports',
    from: q.from,
    to: q.to,
    zone: q.zone,
    branch: q.branch,
    category: q.category,
  });

  const printed = new Intl.DateTimeFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', {
    dateStyle: 'long', timeStyle: 'short',
  }).format(new Date());

  return (
    <main className={styles.page}>
      <div className={styles.toolbar}>
        <PrintButton />
        <span className={styles.toolbarNote}>
          Print, then choose &ldquo;Save as PDF&rdquo; as the destination.
        </span>
      </div>

      <header className={styles.head}>
        <KonektLogo label="KONEKT Na CRDB" className={styles.logo} />
        <div>
          <h1 className={styles.title}>{report.title}</h1>
          <p className={styles.scope}>{report.scope}</p>
        </div>
      </header>

      <dl className={styles.meta}>
        <div><dt>Printed</dt><dd>{printed}</dd></div>
        <div><dt>By</dt><dd>{session.user?.name ?? 'Staff'}</dd></div>
        <div><dt>Scope</dt><dd>{session.scopeLabel}</dd></div>
        <div><dt>Rows</dt><dd>{report.rows.length.toLocaleString()}</dd></div>
      </dl>

      {report.summary.length > 0 ? (
        <section className={styles.totals}>
          {report.summary.map((item) => (
            <div key={item.label} className={styles.total}>
              <span className={styles.totalValue}>{item.value}</span>
              <span className={styles.totalLabel}>{item.label}</span>
            </div>
          ))}
        </section>
      ) : null}

      {report.rows.length === 0 ? (
        <p className={styles.empty}>
          Nothing matches those choices. That is a finding, not an error — try a
          wider range.
        </p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              {report.headers.map((h) => <th key={h} scope="col">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row, i) => (
              // The row index is the key: these are report lines with no id of
              // their own, and two identical lines are legitimately different
              // rows of the same report.
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className={typeof cell === 'number' ? styles.num : undefined}>
                    {cell === null || cell === undefined || cell === '' ? '—' : String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <footer className={styles.foot}>
        Konekt — internal tracker for CRDB Bank Plc. This report contains only
        what {session.user?.name ?? 'this account'} is permitted to see.
      </footer>
    </main>
  );
}
