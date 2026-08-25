'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import {
  createStation, updateStation, saveReport, deleteReport, type ActionResult,
} from '@/app/[locale]/staff/stations/actions';
import styles from './AdminForm.module.css';

const INITIAL: ActionResult = { ok: false, message: '' };

export interface CategoryOption { id: string; name: string }
export interface BranchOption { id: string; name: string }

export interface StationFields {
  id?: string;
  name?: string;
  short_name?: string | null;
  category_id?: string;
  address?: string | null;
  district_name?: string | null;
  contact_name?: string | null;
  contact_role?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  status?: string;
  notes?: string | null;
}

/**
 * Add or edit a station.
 *
 * The branch picker appears only for the roles that need it. A branch officer
 * has exactly one branch and the server takes it from their account, so the
 * field would be a decision they cannot make wrongly — and one more thing to
 * fill in on a form somebody uses forty times a month.
 */
export function StationForm({
  locale,
  categories,
  branches,
  needsBranch,
  station,
}: {
  locale: string;
  categories: CategoryOption[];
  branches: BranchOption[];
  needsBranch: boolean;
  station?: StationFields;
}) {
  const editing = Boolean(station?.id);
  const [state, formAction, pending] = useActionState(
    editing ? updateStation : createStation,
    INITIAL,
  );
  const router = useRouter();

  useEffect(() => {
    if (state.ok && state.id) router.push(`/${locale}/staff/stations/${state.id}`);
  }, [state, locale, router]);

  return (
    <form action={formAction} className={styles.form}>
      {station?.id ? <input type="hidden" name="id" value={station.id} /> : null}

      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>Name</span>
          <input className={styles.input} name="name" required
            defaultValue={station?.name ?? ''} placeholder="University of Dodoma" />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Short name</span>
          <input className={styles.input} name="short_name"
            defaultValue={station?.short_name ?? ''} placeholder="UDOM" />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Category</span>
          <select className={styles.select} name="category_id" required
            defaultValue={station?.category_id ?? ''}>
            <option value="" disabled>Choose a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        {needsBranch ? (
          <label className={styles.field}>
            <span className={styles.label}>Reporting branch</span>
            <select className={styles.select} name="branch_id" required defaultValue="">
              <option value="" disabled>Choose a branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <span className={styles.help}>
              The branch that reports on it, and the one it counts towards. A
              branch officer never sees this — theirs is taken from their
              account.
            </span>
          </label>
        ) : null}

        <label className={styles.field}>
          <span className={styles.label}>Status</span>
          <select className={styles.select} name="status" defaultValue={station?.status ?? 'active'}>
            <option value="prospect">Prospect — not yet signed</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="closed">Closed</option>
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>District</span>
          <input className={styles.input} name="district_name"
            defaultValue={station?.district_name ?? ''} />
        </label>

        <label className={`${styles.field} ${styles.gridWide}`}>
          <span className={styles.label}>Address</span>
          <input className={styles.input} name="address" defaultValue={station?.address ?? ''} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Contact person</span>
          <input className={styles.input} name="contact_name" defaultValue={station?.contact_name ?? ''} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Their role</span>
          <input className={styles.input} name="contact_role"
            defaultValue={station?.contact_role ?? ''} placeholder="Dean of students" />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Phone</span>
          <input className={styles.input} name="contact_phone" type="tel"
            placeholder="+255712345678" defaultValue={station?.contact_phone ?? ''} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Email</span>
          <input className={styles.input} name="contact_email" type="email"
            defaultValue={station?.contact_email ?? ''} />
        </label>

        {editing ? null : (
          <label className={styles.field}>
            <span className={styles.label}>People in it</span>
            <input className={styles.input} name="portfolio" type="number" min="0"
              placeholder="e.g. 32000" />
            <span className={styles.help}>
              Students, employees, members — whatever this category counts. It
              is the denominator for every coverage figure, and you can correct
              it in any month&rsquo;s record.
            </span>
          </label>
        )}

        <label className={`${styles.field} ${styles.gridWide}`}>
          <span className={styles.label}>Notes</span>
          <textarea className={styles.textarea} name="notes" rows={2}
            defaultValue={station?.notes ?? ''} />
        </label>
      </div>

      <div className={styles.formFoot}>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Saving…' : editing ? 'Save station' : 'Add station'}
        </button>
        <p className={state.ok ? styles.ok : styles.error} role="status" aria-live="polite">
          {state.message}
        </p>
      </div>
    </form>
  );
}

export interface ReportFields {
  period_month?: string;
  portfolio?: number;
  accounts_opened?: number;
  active_accounts?: number;
  dormant_accounts?: number;
  deposits_tzs?: number;
  loans_count?: number;
  loans_value_tzs?: number;
  note?: string | null;
}

/**
 * File a month, or correct one already filed.
 *
 * One form for both, because the write is an upsert on (station, month): a
 * branch that meant 4,000 and typed 400 fixes that month rather than filing a
 * second one, and what it said before stays in the audit log.
 */
export function ReportForm({
  stationId,
  defaults,
  months,
}: {
  stationId: string;
  defaults?: ReportFields;
  /** Months already filed, so the picker can say which are being corrected. */
  months: string[];
}) {
  const [state, formAction, pending] = useActionState(saveReport, INITIAL);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const selected = defaults?.period_month?.slice(0, 7) ?? thisMonth;

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="station_id" value={stationId} />

      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>Month</span>
          <input className={styles.input} type="month" name="period_month"
            defaultValue={selected} max={thisMonth} required />
          <span className={styles.help}>
            {months.includes(selected)
              ? 'This month is already on record — saving corrects it.'
              : 'One record per month. Saving the same month again corrects it.'}
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>People in it</span>
          <input className={styles.input} type="number" min="0" name="portfolio"
            defaultValue={defaults?.portfolio ?? ''} required />
          <span className={styles.help}>The denominator for coverage.</span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Accounts opened</span>
          <input className={styles.input} type="number" min="0" name="accounts_opened"
            defaultValue={defaults?.accounts_opened ?? ''} />
          <span className={styles.help}>Total ever opened here, not just this month.</span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Active accounts</span>
          <input className={styles.input} type="number" min="0" name="active_accounts"
            defaultValue={defaults?.active_accounts ?? ''} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Dormant accounts</span>
          <input className={styles.input} type="number" min="0" name="dormant_accounts"
            defaultValue={defaults?.dormant_accounts ?? ''} />
          <span className={styles.help}>Active plus dormant cannot exceed accounts opened.</span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Deposits mobilised (TZS)</span>
          <input className={styles.input} type="number" min="0" step="1000" name="deposits_tzs"
            defaultValue={defaults?.deposits_tzs ?? ''} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Loans — how many</span>
          <input className={styles.input} type="number" min="0" name="loans_count"
            defaultValue={defaults?.loans_count ?? ''} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Loans — value (TZS)</span>
          <input className={styles.input} type="number" min="0" step="1000" name="loans_value_tzs"
            defaultValue={defaults?.loans_value_tzs ?? ''} />
        </label>

        <label className={`${styles.field} ${styles.gridWide}`}>
          <span className={styles.label}>Note</span>
          <textarea className={styles.textarea} name="note" rows={2}
            defaultValue={defaults?.note ?? ''}
            placeholder="Anything that explains the figures — a drive that month, a campus closure." />
        </label>
      </div>

      <div className={styles.formFoot}>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save this month'}
        </button>
        <p className={state.ok ? styles.ok : styles.error} role="status" aria-live="polite">
          {state.message}
        </p>
      </div>
    </form>
  );
}

export function DeleteReport({ id, month }: { id: string; month: string }) {
  const [state, formAction, pending] = useActionState(deleteReport, INITIAL);
  return (
    <form action={formAction} className={styles.inlineForm}>
      <input type="hidden" name="report_id" value={id} />
      <button type="submit" className="btn btn--quiet btn--sm" disabled={pending}>
        {pending ? 'Removing…' : 'Remove'}
      </button>
      <span className="visually-hidden">{month}</span>
      {state.message ? (
        <span className={state.ok ? styles.ok : styles.error}>{state.message}</span>
      ) : null}
    </form>
  );
}
