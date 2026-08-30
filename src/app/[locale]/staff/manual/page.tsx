import type { Metadata } from 'next';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { PrintButton } from '@/components/staff/PrintButton';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { manualFor, MANUAL_SUBTITLE, type ManualRole } from '@/lib/manual';
import { resolveLocale } from '@/lib/page';
import styles from './manual.module.css';

export const metadata: Metadata = {
  title: 'Manual — Konekt tracker',
  robots: { index: false, follow: false },
};

/**
 * The operating manual, scoped to whoever is reading it.
 *
 * One document, three readings. A branch officer opening a manual that spends
 * four chapters on issuing access codes and creating zones learns that most of
 * this system is not for them, which is the opposite of what a manual is for.
 * So the chapters carry their audience and this page filters.
 *
 * The filtering is relevance, not secrecy — nothing here is a credential, and
 * row level security decides what anybody can actually touch. It only spares a
 * reader a chapter about buttons they do not have.
 *
 * Printing is the download: the browser's own dialogue produces a PDF on every
 * platform this runs on, which is a smaller promise than shipping a PDF
 * library and a truer one than a button that generates a file nobody checked.
 */
export default async function ManualPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const session = await getStaffSession();
  const nav = staffNav(locale, STAFF_LABELS);

  if (!session.signedIn) {
    return (
      <StaffShell
        locale={locale} role={session.role} active="manual" nav={nav}
        title="Manual" scopeLabel={session.scopeLabel} user={session.user}
      >
        <Panel title="Operating manual">
          <PanelEmpty>
            Sign in to read the manual for your level. What it covers depends on
            what your account can do.
          </PanelEmpty>
        </Panel>
      </StaffShell>
    );
  }

  const role = (['hq', 'zone', 'branch'] as const)
    .find((r) => r === session.role) ?? 'branch';
  const sections = manualFor(role);

  const roleWord: Record<ManualRole, string> = {
    hq: 'HQ edition',
    zone: 'Zone edition',
    branch: 'Branch edition',
  };

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="manual"
      nav={nav}
      title="Operating manual"
      scopeLabel={`${roleWord[role]} · ${sections.length} chapters`}
      user={session.user}
      actions={<PrintButton />}
    >
      <div className={styles.doc}>
        <header className={styles.masthead}>
          <p className={styles.edition}>{roleWord[role]}</p>
          <h1 className={styles.title}>How Konekt is run</h1>
          <p className={styles.standfirst}>{MANUAL_SUBTITLE[role]}</p>
        </header>

        <div className={styles.body}>
          <nav className={styles.toc} aria-label="Chapters">
            <p className={styles.tocHead}>Contents</p>
            <ol className={styles.tocList}>
              {sections.map((section, i) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className={styles.tocLink}>
                    <span className={styles.tocNum}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className={styles.chapters}>
            {sections.map((section, i) => (
              /* A native <details>, not a scripted accordion. People already
                 know this control — the chevron, the click target, the way it
                 behaves with a keyboard — and reimplementing it would be a
                 worse copy of something the browser does correctly. It also
                 opens on print and can be linked to.

                 The first chapter starts open so the page never loads as a
                 wall of closed bars with nothing to read. They are deliberately
                 not an exclusive group: `name` would shut one chapter to open
                 another, which is wrong for a reference somebody reads with two
                 sections side by side — and on paper it would print exactly one
                 of them. */
              <details
                key={section.id}
                id={section.id}
                className={styles.chapter}
                open={i === 0}
              >
                <summary className={styles.summary}>
                  <span className={styles.chapterNum}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h2 className={styles.chapterTitle}>{section.title}</h2>
                  <span className={styles.chevron} aria-hidden="true">
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.75"
                        strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </summary>

                <div className={styles.chapterBody}>
                {section.lead ? <p className={styles.lead}>{section.lead}</p> : null}

                {section.blocks.map((block, b) => {
                  const key = `${section.id}-${b}`;

                  if (block.kind === 'p') {
                    return <p key={key} className={styles.para}>{block.text}</p>;
                  }

                  if (block.kind === 'tree') {
                    return (
                      <div key={key} className={styles.tree}>
                        {block.items?.map((line, d) => (
                          <div key={line} className={styles.treeLine}>
                            <span className={styles.treeArm}>
                              {d === 0 ? '' : `${' '.repeat((d - 1) * 4)}└── `}
                            </span>
                            {line}
                          </div>
                        ))}
                      </div>
                    );
                  }

                  if (block.kind === 'list') {
                    return (
                      <ul key={key} className={styles.list}>
                        {block.items?.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    );
                  }

                  if (block.kind === 'steps') {
                    return (
                      <ol key={key} className={styles.steps}>
                        {block.steps?.map((step) => (
                          <li key={step.what}>
                            <p className={styles.stepWhat}>{step.what}</p>
                            <p className={styles.stepHow}>{step.how}</p>
                          </li>
                        ))}
                      </ol>
                    );
                  }

                  if (block.kind === 'table' && block.table) {
                    return (
                      <div key={key} className={styles.tableWrap}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              {block.table.head.map((h) => (
                                <th key={h} scope="col">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {block.table.rows.map((row) => (
                              <tr key={row[0]}>
                                <th scope="row">{row[0]}</th>
                                {row.slice(1).map((cell, c) => (
                                  <td key={`${row[0]}-${c}`}
                                    className={cell === '—' ? styles.cellNo : undefined}>
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  }

                  return (
                    <aside
                      key={key}
                      className={block.kind === 'warn' ? styles.warn : styles.note}
                    >
                      {block.heading ? (
                        <p className={styles.noteHead}>{block.heading}</p>
                      ) : null}
                      <p className={styles.noteText}>{block.text}</p>
                    </aside>
                  );
                })}
                </div>
              </details>
            ))}
          </div>
        </div>

        <footer className={styles.colophon}>
          Konekt is an internal tracking and analytics tool for CRDB Bank Plc,
          Tanzania. Access is issued by HQ. This is the {roleWord[role].toLowerCase()};
          other levels see the chapters written for them.
        </footer>
      </div>
    </StaffShell>
  );
}
