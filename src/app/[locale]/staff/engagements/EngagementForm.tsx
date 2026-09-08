'use client';

import { useActionState, useState } from 'react';
import { Finder } from '@/components/staff/Finder';
import {
  recordEngagement, updateEngagement, type EngagementResult,
} from './actions';
import styles from './engagements.module.css';

/** A visit as the form holds it, for correcting one that already exists. */
export interface EngagementDraft {
  id: string;
  institution: string;
  station_id: string | null;
  branch_id: string;
  category_id: string | null;
  event_id: string | null;
  engaged_on: string;
  notes: string | null;
  leads_expected: number;
  leads_got: number;
  accounts_opened: number;
  accounts_activated: number;
  simbanking_activated: number;
  lipa_hapa_registered: number;
  deposits_tzs: number;
}

/**
 * The visit form. Nine boxes, no prose.
 *
 * One form for recording and for correcting: same fields, same validation,
 * same action shape. Passing an existing visit switches it to updating that
 * row rather than writing a new one — which is what stops a correction being
 * recorded as a second visit, counting the leads twice.
 */
export function EngagementForm({
  branches,
  categories,
  events,
  fixedBranch,
  editing,
  doneHref,
}: {
  branches: { id: string; name: string }[];
  categories: { id: string; name_en: string }[];
  /** Events a visit can be attached to, most recent first. */
  events: { id: string; name: string; event_date: string }[];
  fixedBranch: string | null;
  /** When set, the form corrects this visit instead of recording a new one. */
  editing?: EngagementDraft | null;
  /** Where "Done" goes — a link, so the table stays on the server. */
  doneHref?: string;
}) {
  const [state, action, pending] = useActionState<EngagementResult | null, FormData>(
    editing ? updateEngagement : recordEngagement,
    null,
  );

  const today = new Date().toISOString().slice(0, 10);

  /* Picking an institution fills in what the register already knows about it.
     Typing a school's name and then being asked which category it is, when the
     register has said so since it was loaded, is the console making somebody
     do its work. Both stay editable: the register is not always right, and a
     visit can be to somewhere not on it at all. */
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? '');
  const [branchId, setBranchId] = useState(editing?.branch_id ?? fixedBranch ?? '');

  return (
    <form action={action} className={styles.form} key={editing?.id ?? 'new'}>
      {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
      <div className={styles.row}>
        <div className={styles.field} style={{ gridColumn: 'span 2' }}>
          <Finder
            name="station_id"
            textName="institution"
            label="Institution"
            placeholder="Type a name — or a place that is not on the register yet"
            initial={
              editing?.station_id
                ? { id: editing.station_id, name: editing.institution }
                : null
            }
            onPick={(station) => {
              setCategoryId(station?.category_id ?? '');
              if (!fixedBranch) setBranchId(station?.branch_id ?? '');
            }}
          />
        </div>

        <label className={styles.field}>
          <span>Date</span>
          <input
            type="date"
            name="engaged_on"
            required
            defaultValue={editing?.engaged_on?.slice(0, 10) ?? today}
          />
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
          <span>Part of which event</span>
          <select name="event_id" defaultValue={editing?.event_id ?? ''}>
            <option value="">Not part of an event</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {e.event_date.slice(0, 10)}
              </option>
            ))}
          </select>
        </label>

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
          <input type="number" name="leads_expected" min={0} inputMode="numeric"
            defaultValue={editing?.leads_expected ?? 0} />
        </label>
        <label className={styles.field}>
          <span>Leads got</span>
          <input type="number" name="leads_got" min={0} inputMode="numeric"
            defaultValue={editing?.leads_got ?? 0} />
        </label>
        <label className={styles.field}>
          <span>Accounts opened</span>
          <input type="number" name="accounts_opened" min={0} inputMode="numeric"
            defaultValue={editing?.accounts_opened ?? 0} />
        </label>
        <label className={styles.field}>
          <span>Accounts activated</span>
          <input type="number" name="accounts_activated" min={0} inputMode="numeric"
            defaultValue={editing?.accounts_activated ?? 0} />
        </label>
        <label className={styles.field}>
          <span>SimBanking</span>
          <input type="number" name="simbanking_activated" min={0} inputMode="numeric"
            defaultValue={editing?.simbanking_activated ?? 0} />
        </label>
        <label className={styles.field}>
          <span>Lipa Hapa</span>
          <input type="number" name="lipa_hapa_registered" min={0} inputMode="numeric"
            defaultValue={editing?.lipa_hapa_registered ?? 0} />
        </label>
        <label className={styles.field}>
          <span>Deposits (TSh)</span>
          <input type="number" name="deposits_tzs" min={0} step="0.01" inputMode="decimal"
            defaultValue={editing?.deposits_tzs ?? 0} />
        </label>
      </div>

      <label className={styles.field}>
        <span>Notes</span>
        <input name="notes" maxLength={500} autoComplete="off"
          defaultValue={editing?.notes ?? ''} />
      </label>

      <div className={styles.actions}>
        <button type="submit" className="btn btn--primary btn--sm" disabled={pending}>
          {pending ? 'Saving…' : editing ? 'Save changes' : 'Record visit'}
        </button>
        {editing && doneHref ? (
          <a href={doneHref} className="btn btn--quiet btn--sm">Done</a>
        ) : null}
        {state ? (
          <p className={state.ok ? styles.ok : styles.bad} role="status">{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}
