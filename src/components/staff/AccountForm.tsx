'use client';

import { useActionState, useState } from 'react';
import { recordAccount, type ActionResult } from '@/app/[locale]/staff/accounts/actions';
import styles from './AdminForm.module.css';

const INITIAL: ActionResult = { ok: false, message: '' };

const SOURCES = [
  { value: 'event', label: 'Event' },
  { value: 'branch_walk_in', label: 'Branch walk-in' },
  { value: 'field_agent', label: 'Field agent' },
  { value: 'referral', label: 'Member referral' },
  { value: 'campus_activation', label: 'Campus activation' },
  { value: 'digital', label: 'Digital' },
  { value: 'other', label: 'Other' },
];

/**
 * Record an account opened.
 *
 * The event field appears only when the source is an event, because that is
 * exactly when the database requires it — `event_sourced_accounts_name_the_event`
 * refuses the row otherwise. Showing it always would invite someone to fill it
 * in for a walk-in and wonder why the number moved in the wrong report.
 */
export function AccountForm({
  products,
  events,
  freelancers,
  needsBranch,
  branches,
}: {
  products: { code: string; label_en: string }[];
  events: { id: string; title_en: string }[];
  freelancers: { id: string; full_name: string }[];
  /** True for HQ and zone users, who have no branch of their own. */
  needsBranch: boolean;
  branches: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(recordAccount, INITIAL);
  const [source, setSource] = useState('');

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>Account number</span>
          <input className={styles.input} name="account_number" required
            autoComplete="off" inputMode="numeric" />
          <span className={styles.help}>Unique across the platform. A duplicate is refused by the database.</span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Product</span>
          <select className={styles.select} name="product_code" required defaultValue="">
            <option value="" disabled>Choose a product</option>
            {products.map((product) => (
              <option key={product.code} value={product.code}>{product.label_en}</option>
            ))}
          </select>
          <span className={styles.help}>
            From the account types HQ maintains, so every branch records the
            same product under the same name.
          </span>
        </label>

        {needsBranch ? (
          <label className={styles.field}>
            <span className={styles.label}>Branch</span>
            <select className={styles.select} name="branch_id" required defaultValue="">
              <option value="" disabled>Choose a branch</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
            <span className={styles.help}>
              A branch officer does not see this — their own branch is taken
              from their account.
            </span>
          </label>
        ) : null}

        <label className={styles.field}>
          <span className={styles.label}>Opened on</span>
          <input className={styles.input} type="date" name="opened_on"
            defaultValue={new Date().toISOString().slice(0, 10)} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Source</span>
          <select
            className={styles.select}
            name="source"
            required
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="" disabled>Choose a source</option>
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <span className={styles.help}>
            Never optional. It is what lets an analyst trace this account back
            to what produced it.
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Source reference</span>
          <input className={styles.input} name="source_reference" required
            placeholder="Registration ID, agent code, referral code" />
        </label>

        {source === 'event' ? (
          <label className={styles.field}>
            <span className={styles.label}>Which event</span>
            <select className={styles.select} name="event_id" required defaultValue="">
              <option value="" disabled>Choose an event</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>{event.title_en}</option>
              ))}
            </select>
            <span className={styles.help}>Required for an event-sourced account, and what puts this account into that event&rsquo;s cost per account.</span>
          </label>
        ) : null}

        <label className={styles.field}>
          <span className={styles.label}>Freelancer</span>
          <select className={styles.select} name="freelancer_id" defaultValue="">
            <option value="">Nobody</option>
            {freelancers.map((freelancer) => (
              <option key={freelancer.id} value={freelancer.id}>{freelancer.full_name}</option>
            ))}
          </select>
          <span className={styles.help}>
            Name them here and this account counts towards their commission.
            Attribution added later leaves an audit entry, so it is worth
            getting right at the counter.
          </span>
        </label>
      </div>

      <div className={styles.formFoot}>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Recording…' : 'Record account'}
        </button>
        <p className={state.ok ? styles.ok : styles.error} role="status" aria-live="polite">
          {state.message}
        </p>
      </div>
    </form>
  );
}
