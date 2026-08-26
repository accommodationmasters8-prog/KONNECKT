'use client';

import { useActionState, useState } from 'react';
import {
  saveBranch, clearDemoData, type ActionResult,
} from '@/app/[locale]/staff/settings/actions';
import { ZONE_CODES, zoneWording } from '@/lib/access-scope';
import styles from './AdminForm.module.css';

const INITIAL: ActionResult = { ok: false, message: '' };

export interface BranchFields {
  id?: string;
  name?: string;
  zone_code?: string | null;
  year_established?: number | null;
  year_refurbished?: number | null;
  is_active?: boolean;
  notes?: string | null;
}

/**
 * Add a branch, or correct one.
 *
 * The register gave a name and two years. The zone is the field that matters
 * most and the one it never carried: without it a branch is invisible to its
 * zone manager, and so is every station reporting through it.
 */
export function BranchForm({ branch }: { branch?: BranchFields }) {
  const [state, formAction, pending] = useActionState(saveBranch, INITIAL);
  const editing = Boolean(branch?.id);

  return (
    <form action={formAction} className={styles.form}>
      {branch?.id ? <input type="hidden" name="branch_id" value={branch.id} /> : null}

      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>Branch name</span>
          <input className={styles.input} name="name" required
            defaultValue={branch?.name ?? ''} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Zone</span>
          <select className={styles.select} name="zone_code"
            defaultValue={branch?.zone_code ?? ''}>
            <option value="">Not assigned</option>
            {ZONE_CODES.map((z) => (
              <option key={z} value={z}>{zoneWording(z)}</option>
            ))}
          </select>
          <span className={styles.help}>
            Unassigned means no zone manager can see it, or anything reporting
            through it.
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Year established</span>
          <input className={styles.input} type="number" name="year_established"
            min="1960" max={new Date().getFullYear() + 1}
            defaultValue={branch?.year_established ?? ''} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Year refurbished or relocated</span>
          <input className={styles.input} type="number" name="year_refurbished"
            min="1960" max={new Date().getFullYear() + 1}
            defaultValue={branch?.year_refurbished ?? ''} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Open</span>
          <select className={styles.select} name="is_active"
            defaultValue={branch?.is_active === false ? 'false' : 'true'}>
            <option value="true">Open</option>
            <option value="false">Closed</option>
          </select>
        </label>

        <label className={`${styles.field} ${styles.gridWide}`}>
          <span className={styles.label}>Notes</span>
          <input className={styles.input} name="notes" defaultValue={branch?.notes ?? ''} />
        </label>
      </div>

      <div className={styles.formFoot}>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Saving…' : editing ? 'Save branch' : 'Add branch'}
        </button>
        <p className={state.ok ? styles.ok : styles.error} role="status" aria-live="polite">
          {state.message}
        </p>
      </div>
    </form>
  );
}

/**
 * Clear the sample data.
 *
 * Two-step, because the button is one click away from a dashboard somebody is
 * presenting from. The word has to be typed, and the message afterwards says
 * exactly how many rows went, so nobody has to guess whether it worked.
 */
export function ClearDemoData({ sampleReports }: { sampleReports: number }) {
  const [state, formAction, pending] = useActionState(clearDemoData, INITIAL);
  const [typed, setTyped] = useState('');
  const armed = typed.trim().toUpperCase() === 'CLEAR';

  return (
    <form action={formAction} className={styles.form}>
      <label className={styles.field}>
        <span className={styles.label}>
          {sampleReports === 0
            ? 'No sample figures are in the database'
            : `${sampleReports} sample figures are in the database`}
        </span>
        <input
          className={styles.input}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          placeholder="CLEAR"
          disabled={sampleReports === 0}
        />
        <span className={styles.help}>
          Type CLEAR to remove every figure seeded for the walkthrough. The
          stations loaded from the CRDB register stay — they are real — and are
          left with nothing filed against them, which is the honest starting
          point for going live.
        </span>
      </label>

      <div className={styles.formFoot}>
        <button type="submit" className="btn btn--quiet"
          disabled={pending || !armed || sampleReports === 0}>
          {pending ? 'Clearing…' : 'Clear sample data'}
        </button>
        <p className={state.ok ? styles.ok : styles.error} role="status" aria-live="polite">
          {state.message}
        </p>
      </div>
    </form>
  );
}
