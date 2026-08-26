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
] as const;

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
}: {
  locale: string;
  zones: Option[];
  branches: Option[];
  categories: Option[];
}) {
  const [kind, setKind] = useState<string>('reports');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [zone, setZone] = useState('');
  const [branch, setBranch] = useState('');
  const [category, setCategory] = useState('');

  const subject = SUBJECTS.find((s) => s.kind === kind)!;

  const query = new URLSearchParams();
  if (subject.dated && from) query.set('from', from);
  if (subject.dated && to) query.set('to', to);
  if (zone) query.set('zone', zone);
  if (branch) query.set('branch', branch);
  if (category && kind === 'reports') query.set('category', category);

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
                onChange={() => setKind(s.kind)}
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

        {kind === 'reports' ? (
          <label className={styles.field}>
            <span className={styles.label}>Category</span>
            <select className={styles.select} value={category}
              onChange={(e) => setCategory(e.target.value)}>
              <option value="">Every category</option>
              {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
        ) : null}
      </div>

      <p className={builder.summary}>
        <span className={builder.summaryLabel}>You will get</span>
        {described}
      </p>

      <div className={builder.actions}>
        <a className="btn btn--primary" href={csvHref} download>
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
