'use client';

import { useActionState, useState } from 'react';
import { Finder } from '@/components/staff/Finder';
import { recordEngagement, type EngagementResult } from './actions';
import styles from './engagements.module.css';

/** The visit form. Nine boxes, no prose. */
export function EngagementForm({
  branches,
  categories,
  fixedBranch,
}: {
  branches: { id: string; name: string }[];
  categories: { id: string; name_en: string }[];
  fixedBranch: string | null;
}) {
  const [state, action, pending] = useActionState<EngagementResult | null, FormData>(
    recordEngagement,
    null,
  );

  const today = new Date().toISOString().slice(0, 10);

  /* Picking an institution fills in what the register already knows about it.
     Typing a school's name and then being asked which category it is, when the
     register has said so since it was loaded, is the console making somebody
     do its work. Both stay editable: the register is not always right, and a
     visit can be to somewhere not on it at all. */
  const [categoryId, setCategoryId] = useState('');
  const [branchId, setBranchId] = useState('');

  return (
    <form action={action} className={styles.form}>
      <div className={styles.row}>
        <div className={styles.field} style={{ gridColumn: 'span 2' }}>
          <Finder
            name="station_id"
            textName="institution"
            label="Institution"
            placeholder="Type a name — or a place that is not on the register yet"
            onPick={(station) => {
              setCategoryId(station?.category_id ?? '');
              if (!fixedBranch) setBranchId(station?.branch_id ?? '');
            }}
          />
        </div>

        <label className={styles.field}>
          <span>Date</span>
          <input type="date" name="engaged_on" required defaultValue={today} />
        </label>

        {fixedBranch ? (
          <input type="hidden" name="branch_id" value={fixedBranch} />
        ) : (
          <label className={styles.field}>
            <span>Branch</span>
            <select
              name="branch_id"
              required
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="" disabled>Pick one</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>
        )}

        <label className={styles.field}>
          <span>Category</span>
          <select
            name="category_id"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name_en}</option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.row}>
        <label className={styles.field}>
          <span>Leads expected</span>
          <input type="number" name="leads_expected" min={0} inputMode="numeric" defaultValue={0} />
        </label>
        <label className={styles.field}>
          <span>Leads got</span>
          <input type="number" name="leads_got" min={0} inputMode="numeric" defaultValue={0} />
        </label>
        <label className={styles.field}>
          <span>Accounts opened</span>
          <input type="number" name="accounts_opened" min={0} inputMode="numeric" defaultValue={0} />
        </label>
        <label className={styles.field}>
          <span>Accounts activated</span>
          <input type="number" name="accounts_activated" min={0} inputMode="numeric" defaultValue={0} />
        </label>
        <label className={styles.field}>
          <span>SimBanking</span>
          <input type="number" name="simbanking_activated" min={0} inputMode="numeric" defaultValue={0} />
        </label>
        <label className={styles.field}>
          <span>Lipa Hapa</span>
          <input type="number" name="lipa_hapa_registered" min={0} inputMode="numeric" defaultValue={0} />
        </label>
        <label className={styles.field}>
          <span>Deposits (TSh)</span>
          <input type="number" name="deposits_tzs" min={0} step="0.01" inputMode="decimal" defaultValue={0} />
        </label>
      </div>

      <label className={styles.field}>
        <span>Notes</span>
        <input name="notes" maxLength={500} autoComplete="off" />
      </label>

      <div className={styles.actions}>
        <button type="submit" className="btn btn--primary btn--sm" disabled={pending}>
          {pending ? 'Saving…' : 'Record visit'}
        </button>
        {state ? (
          <p className={state.ok ? styles.ok : styles.bad} role="status">{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}
