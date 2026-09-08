'use client';

import { useState } from 'react';
import { Panel, PanelEmpty, FoldPanel } from '@/components/staff/Panel';
import { EngagementForm, type EngagementDraft } from './EngagementForm';
import styles from '../staff.module.css';

export interface EngagementRow extends EngagementDraft {
  event_name: string | null;
}

/**
 * The visits list, and the form that writes to it.
 *
 * They are one component because correcting a visit needs both: the row you
 * pressed decides what the form is editing. Kept as the same two panels the
 * screen already had — recording a visit is still the fold at the top, the
 * table is still the table.
 */
export function EngagementsPanel({
  rows,
  branches,
  categories,
  events,
  fixedBranch,
  branchName,
  locale,
}: {
  rows: EngagementRow[];
  branches: { id: string; name: string }[];
  categories: { id: string; name_en: string }[];
  events: { id: string; name: string; event_date: string }[];
  fixedBranch: string | null;
  branchName: Record<string, string>;
  locale: string;
}) {
  const [editing, setEditing] = useState<EngagementDraft | null>(null);

  /* Formatted here rather than handed down: a function cannot cross the
     server/client boundary, and passing one is a runtime error rather than a
     type error. */
  const formatCount = (value: number) =>
    new Intl.NumberFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ').format(value ?? 0);

  const when = (value: string) =>
    new Intl.DateTimeFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', {
      day: 'numeric', month: 'short', year: 'numeric',
    }).format(new Date(value));

  return (
    <>
      <FoldPanel
        title={editing ? `Correcting ${editing.institution}` : 'Record a visit'}
        open={rows.length === 0 || editing !== null}
      >
        <EngagementForm
          branches={branches}
          categories={categories}
          events={events}
          fixedBranch={fixedBranch}
          editing={editing}
          onDone={() => setEditing(null)}
        />
      </FoldPanel>

      <Panel title="Visits">
        {rows.length === 0 ? (
          <PanelEmpty>None recorded.</PanelEmpty>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Institution</th>
                  <th scope="col">Event</th>
                  <th scope="col">Branch</th>
                  <th scope="col">Date</th>
                  <th scope="col" className={styles.num}>Expected</th>
                  <th scope="col" className={styles.num}>Got</th>
                  <th scope="col" className={styles.num}>Accounts</th>
                  <th scope="col" className={styles.num}>SimBanking</th>
                  <th scope="col" className={styles.num}>Lipa Hapa</th>
                  <th scope="col"><span className="visually-hidden">Correct</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <th scope="row">{r.institution}</th>
                    <td>{r.event_name ?? '—'}</td>
                    <td>{branchName[r.branch_id] ?? '—'}</td>
                    <td>{when(r.engaged_on)}</td>
                    <td className={styles.num}>{formatCount(r.leads_expected)}</td>
                    <td className={styles.num}>{formatCount(r.leads_got)}</td>
                    <td className={styles.num}>{formatCount(r.accounts_opened)}</td>
                    <td className={styles.num}>{formatCount(r.simbanking_activated)}</td>
                    <td className={styles.num}>{formatCount(r.lipa_hapa_registered)}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.link}
                        onClick={() => {
                          setEditing(r);
                          // The form is above the table; without this the
                          // fold opens off-screen and nothing appears to
                          // have happened.
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        Correct
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
