'use client';

import { useState } from 'react';
import styles from './AdminForm.module.css';
import builder from './ReportBuilder.module.css';

export interface Option { value: string; label: string }

const SUBJECTS = [
  {
    kind: 'reports',
    title: 'Monthly figures',
    body: 'One row per station per period — people, accounts, coverage, deposits and loans.',
    dated: true,
  },
  {
    kind: 'events',
    title: 'Events and KPIs',
    body: 'Turnout, budget, actual spend, accounts opened and cost per account.',
    dated: true,
  },
  {
    kind: 'engagements',
    title: 'Engagements and leads',
    body: 'Visits a branch booked — leads expected against leads got, and what was opened.',
    dated: true,
  },
  {
    kind: 'stations',
    title: 'Station register',
    body: 'What is being tracked, with category, branch, zone, district and contact.',
    dated: false,
  },
  {
    kind: 'branches',
    title: 'Branches and zones',
    body: 'The branch list and the zone each is assigned to.',
    dated: false,
  },
  {
    kind: 'event',
    title: 'One event, in full',
    body: 'Every figure for a single event, with its pictures laid out in the PDF.',
    dated: false,
  },
] as const;

/* The columns of the two figure reports, keyed exactly as lib/report.ts keys
   them. A report nobody has narrowed carries all of them. */
const COLUMNS: Record<string, { key: string; label: string }[]> = {
  reports: [
    { key: 'period', label: 'Period' },
    { key: 'covers', label: 'Covers' },
    { key: 'station', label: 'Station' },
    { key: 'category', label: 'Category' },
    { key: 'branch', label: 'Branch' },
    { key: 'zone', label: 'Zone' },
    { key: 'people', label: 'People' },
    { key: 'opened', label: 'Accounts opened' },
    { key: 'active', label: 'Active' },
    { key: 'dormant', label: 'Dormant' },
    { key: 'coverage', label: 'Coverage %' },
    { key: 'simbanking', label: 'SimBanking' },
    { key: 'cards', label: 'Cards' },
    { key: 'lipahapa', label: 'Lipa Hapa' },
    { key: 'deposits', label: 'Deposits' },
    { key: 'loans', label: 'Loans' },
    { key: 'loanvalue', label: 'Loan value' },
    { key: 'note', label: 'Note' },
  ],
  engagements: [
    { key: 'date', label: 'Date' },
    { key: 'institution', label: 'Institution' },
    { key: 'branch', label: 'Branch' },
    { key: 'zone', label: 'Zone' },
    { key: 'category', label: 'Category' },
    { key: 'expected', label: 'Leads expected' },
    { key: 'got', label: 'Leads got' },
    { key: 'conversion', label: 'Conversion %' },
    { key: 'opened', label: 'Accounts opened' },
    { key: 'activated', label: 'Accounts activated' },
    { key: 'simbanking', label: 'SimBanking' },
    { key: 'lipahapa', label: 'Lipa Hapa' },
    { key: 'deposits', label: 'Deposits' },
    { key: 'note', label: 'Note' },
  ],
};

const GROUPS: Record<string, { value: string; label: string }[]> = {
  reports: [
    { value: '', label: 'One row per station, per period' },
    { value: 'period', label: 'Total by period' },
    { value: 'branch', label: 'Total by branch' },
    { value: 'zone', label: 'Total by zone' },
    { value: 'category', label: 'Total by category' },
  ],
  engagements: [
    { value: '', label: 'One row per visit' },
    { value: 'branch', label: 'Total by branch' },
    { value: 'zone', label: 'Total by zone' },
    { value: 'category', label: 'Total by category' },
    { value: 'date', label: 'Total by date' },
  ],
};

/**
 * Choose a report, then take it away.
 *
 * A wizard rather than a row of fixed download links, because the useful
 * question is never "give me everything" — it is this category, this zone,
 * these three months. Nothing here is capped: leave the dates empty and the
 * whole history comes out.
 *
 * The choices live in the query string, so a built report can be sent to
 * somebody else and they open the same one. The two buttons at the end point
 * at the same parameters — one to the CSV route, one to a print view — which
 * is what stops the spreadsheet and the PDF from ever disagreeing.
 */
export function ReportBuilder({
  locale,
  zones,
  branches,
  categories,
  events,
}: {
  locale: string;
  zones: Option[];
  branches: Option[];
  categories: Option[];
  events: Option[];
}) {
  const [kind, setKind] = useState<string>('reports');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [zone, setZone] = useState('');
  const [branch, setBranch] = useState('');
  const [category, setCategory] = useState('');
  const [event, setEvent] = useState('');
  const [covers, setCovers] = useState('');
  const [group, setGroup] = useState('');
  /* Empty means every column. Narrowing is the exception, so the report does
     not start out already missing something the person did not ask to drop. */
  const [cols, setCols] = useState<string[]>([]);

  const subject = SUBJECTS.find((s) => s.kind === kind)!;

  const query = new URLSearchParams();
  if (subject.dated && from) query.set('from', from);
  if (subject.dated && to) query.set('to', to);
  if (zone) query.set('zone', zone);
  if (branch) query.set('branch', branch);
  if (category && kind === 'reports') query.set('category', category);
  if (kind === 'event' && event) query.set('event', event);
  if (kind === 'reports' && covers) query.set('covers', covers);
  if (group && GROUPS[kind]) query.set('group', group);
  if (COLUMNS[kind]) for (const c of cols) query.append('col', c);

  const qs = query.toString();
  const csvHref = `/api/reports/${kind}${qs ? `?${qs}` : ''}`;
  const printHref = `/${locale}/staff/reports/print?kind=${kind}${qs ? `&${qs}` : ''}`;

  const described = [
    subject.title,
    zone ? zones.find((z) => z.value === zone)?.label : null,
    branch ? branches.find((b) => b.value === branch)?.label : null,
    category && kind === 'reports'
      ? categories.find((c) => c.value === category)?.label : null,
    subject.dated && (from || to)
      ? `${from || 'the beginning'} to ${to || 'now'}`
      : subject.dated ? 'every period on record' : null,
    covers && kind === 'reports' ? `${covers} filings` : null,
    group ? GROUPS[kind]?.find((g) => g.value === group)?.label.toLowerCase() : null,
    cols.length ? `${cols.length} columns` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className={builder.wrap}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.label}>What goes in it</legend>
        <div className={builder.subjects}>
          {SUBJECTS.map((s) => (
            <label
              key={s.kind}
              className={s.kind === kind ? builder.subjectOn : builder.subject}
            >
              <input
                type="radio"
                name="kind"
                value={s.kind}
                checked={s.kind === kind}
                onChange={() => { setKind(s.kind); setGroup(''); setCols([]); }}
                className="visually-hidden"
              />
              <span className={builder.subjectTitle}>{s.title}</span>
              <span className={builder.subjectBody}>{s.body}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.grid}>
        {subject.dated ? (
          <>
            <label className={styles.field}>
              <span className={styles.label}>From</span>
              <input className={styles.input} type="date" value={from}
                onChange={(e) => setFrom(e.target.value)} />
              <span className={styles.help}>Leave empty for the earliest on record.</span>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>To</span>
              <input className={styles.input} type="date" value={to}
                onChange={(e) => setTo(e.target.value)} />
              <span className={styles.help}>
                Both ends are included. Leave empty for everything up to today.
              </span>
            </label>
          </>
        ) : null}

        <label className={styles.field}>
          <span className={styles.label}>Zone</span>
          <select className={styles.select} value={zone}
            onChange={(e) => { setZone(e.target.value); setBranch(''); }}>
            <option value="">Every zone you can reach</option>
            {zones.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Branch</span>
          <select className={styles.select} value={branch}
            onChange={(e) => setBranch(e.target.value)}>
            <option value="">Every branch</option>
            {branches.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </label>

        {kind === 'event' ? (
          <label className={`${styles.field} ${styles.gridWide}`}>
            <span className={styles.label}>Which event</span>
            <select className={styles.select} value={event}
              onChange={(e) => setEvent(e.target.value)}>
              <option value="">Choose an event</option>
              {events.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
            <span className={styles.help}>
              The PDF carries its pictures; the CSV carries its figures.
            </span>
          </label>
        ) : null}

        {kind === 'reports' || kind === 'engagements' ? (
          <label className={styles.field}>
            <span className={styles.label}>Category</span>
            <select className={styles.select} value={category}
              onChange={(e) => setCategory(e.target.value)}>
              <option value="">Every category</option>
              {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
        ) : null}

        {/* Filing period. A branch that files weekly and one that files
            monthly both land in the same table, so a report that mixes them
            double-counts unless you say which you meant. */}
        {kind === 'reports' ? (
          <label className={styles.field}>
            <span className={styles.label}>Filed as</span>
            <select className={styles.select} value={covers}
              onChange={(e) => setCovers(e.target.value)}>
              <option value="">Daily, weekly and monthly</option>
              <option value="daily">Daily only</option>
              <option value="weekly">Weekly only</option>
              <option value="monthly">Monthly only</option>
            </select>
          </label>
        ) : null}

        {GROUPS[kind] ? (
          <label className={styles.field}>
            <span className={styles.label}>Rows</span>
            <select className={styles.select} value={group}
              onChange={(e) => setGroup(e.target.value)}>
              {GROUPS[kind].map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
            <span className={styles.help}>
              Grouped rows add the figures up. Coverage is worked out again
              from the group&rsquo;s own totals, not averaged.
            </span>
          </label>
        ) : null}
      </div>

      {/* Columns. Ticking none of them means all of them, which is why the
          control opens closed and says so. */}
      {COLUMNS[kind] ? (
        <details className={builder.columns}>
          <summary className={builder.columnsHead}>
            <span>Columns</span>
            <span className={builder.columnsCount}>
              {cols.length === 0 ? 'all' : `${cols.length} of ${COLUMNS[kind].length}`}
            </span>
            <span className={builder.columnsHint}>Click to open</span>
          </summary>
          <div className={builder.columnsBody}>
            {COLUMNS[kind].map((c) => (
              <label key={c.key} className={builder.column}>
                <input
                  type="checkbox"
                  checked={cols.length === 0 || cols.includes(c.key)}
                  onChange={() => setCols((prev) => {
                    // First tick turns "all" into an explicit list minus this
                    // one, which is what unticking a box from "all" means.
                    const base = prev.length === 0
                      ? COLUMNS[kind].map((x) => x.key) : prev;
                    const next = base.includes(c.key)
                      ? base.filter((k) => k !== c.key)
                      : [...base, c.key];
                    // Back to every column? Say "all" rather than listing them.
                    return next.length === COLUMNS[kind].length ? [] : next;
                  })}
                />
                <span>{c.label}</span>
              </label>
            ))}
            <button type="button" className={builder.columnsReset}
              onClick={() => setCols([])}>
              Every column
            </button>
          </div>
        </details>
      ) : null}

      <p className={builder.summary}>
        <span className={builder.summaryLabel}>You will get</span>
        {described}
      </p>

      <div className={builder.actions}>
        <a
          className={kind === 'event' && !event ? 'btn btn--primary is-disabled' : 'btn btn--primary'}
          href={csvHref}
          download
          aria-disabled={kind === 'event' && !event}
        >
          Download CSV
        </a>
        <a className="btn btn--quiet" href={printHref} target="_blank" rel="noreferrer">
          Open PDF view
        </a>
        <span className={styles.help}>
          The PDF view opens laid out for print — your browser&rsquo;s print
          dialogue saves it as a PDF. Both buttons run the same query, so the
          spreadsheet and the document can never disagree.
        </span>
      </div>
    </div>
  );
}
