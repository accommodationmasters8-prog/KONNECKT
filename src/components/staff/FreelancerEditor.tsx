'use client';

import { useActionState } from 'react';
import { saveFreelancer, type ActionResult } from '@/app/[locale]/staff/freelancers/actions';
import styles from './AdminForm.module.css';

const INITIAL: ActionResult = { ok: false, message: '' };

export interface FreelancerRow {
  id: string;
  full_name: string;
  phone_e164: string;
  email: string | null;
  branch_id: string;
  zone_code: string | null;
  status: string;
  commission_tzs_per_account: number | null;
  notes: string | null;
}

/**
 * Register a freelancer, or change one.
 *
 * The branch is chosen once, at registration. Moving someone between branches
 * would move their production with them and rewrite what each branch reported,
 * so it is not an edit made in passing — a freelancer who changes branch is
 * ended here and registered there.
 */
export function FreelancerEditor({
  branches,
  freelancer,
}: {
  branches: { id: string; name: string }[];
  freelancer?: FreelancerRow;
}) {
  const [state, formAction, pending] = useActionState(saveFreelancer, INITIAL);
  const editing = Boolean(freelancer);

  return (
    <form action={formAction} className={styles.form}>
      {freelancer ? <input type="hidden" name="id" value={freelancer.id} /> : null}

      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>Full name</span>
          <input className={styles.input} name="full_name" required
            defaultValue={freelancer?.full_name ?? ''} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Phone</span>
          <input className={styles.input} name="phone_e164" required
            placeholder="+255712345678" defaultValue={freelancer?.phone_e164 ?? ''} />
          <span className={styles.help}>International form. This identifies them; the database refuses anything else.</span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Email</span>
          <input className={styles.input} type="email" name="email"
            defaultValue={freelancer?.email ?? ''} />
          <span className={styles.help}>Optional, and how they sign in to their own dashboard if they need one.</span>
        </label>

        {editing ? null : (
          <label className={styles.field}>
            <span className={styles.label}>Branch</span>
            <select className={styles.select} name="branch_id" required defaultValue="">
              <option value="" disabled>Choose a branch</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
            <span className={styles.help}>
              The branch answers for them, and their production reports through
              it. Set once — a freelancer who moves is ended here and registered
              at the new branch.
            </span>
          </label>
        )}

        <label className={styles.field}>
          <span className={styles.label}>Status</span>
          <select className={styles.select} name="status" defaultValue={freelancer?.status ?? 'pending'}>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="ended">Ended</option>
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Commission per account (TZS)</span>
          <input className={styles.input} type="number" min="0" step="100"
            name="commission_tzs_per_account"
            defaultValue={freelancer?.commission_tzs_per_account ?? ''} />
          <span className={styles.help}>
            What they earn per account they source. Held per freelancer so a
            rate change does not restate what was already earned.
          </span>
        </label>

        <label className={`${styles.field} ${styles.gridWide}`}>
          <span className={styles.label}>Notes</span>
          <textarea className={styles.textarea} name="notes" rows={2}
            defaultValue={freelancer?.notes ?? ''} />
        </label>
      </div>

      <div className={styles.formFoot}>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Saving…' : editing ? 'Save freelancer' : 'Register freelancer'}
        </button>
        <p className={state.ok ? styles.ok : styles.error} role="status" aria-live="polite">
          {state.message}
        </p>
      </div>
    </form>
  );
}
