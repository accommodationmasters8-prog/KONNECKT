'use client';

import { useActionState, useState } from 'react';
import { setBranchZone, type ActionResult } from '@/app/[locale]/staff/settings/actions';
import { ZONE_CODES, zoneWording } from '@/lib/access-scope';
import styles from './AdminForm.module.css';
import list from './ProductLists.module.css';

const INITIAL: ActionResult = { ok: false, message: '' };

export interface BranchRow {
  id: string;
  name: string;
  zone_code: string | null;
}

/** One branch's zone. Saves on change — there is only one field. */
function ZonePicker({ branch }: { branch: BranchRow }) {
  const [state, formAction, pending] = useActionState(setBranchZone, INITIAL);

  return (
    <form action={formAction} className={styles.inlineForm}>
      <input type="hidden" name="branch_id" value={branch.id} />
      <select
        className={styles.select}
        name="zone_code"
        defaultValue={branch.zone_code ?? ''}
        aria-label={`Zone for ${branch.name}`}
      >
        <option value="">Not assigned</option>
        {ZONE_CODES.map((z) => (
          <option key={z} value={z}>{zoneWording(z)}</option>
        ))}
      </select>
      <button type="submit" className="btn btn--quiet btn--sm" disabled={pending}>
        {pending ? '…' : 'Save'}
      </button>
      {state.message ? (
        <span className={state.ok ? styles.ok : styles.error}>{state.message}</span>
      ) : null}
    </form>
  );
}

/**
 * Every branch, and the zone it belongs to.
 *
 * Unzoned branches come first because they are the work: a branch with no zone
 * is one its zone manager cannot see, and so is every station reporting
 * through it. The filter is client-side over a list of 252 — small enough that
 * a round trip per keystroke would be the slower design.
 */
export function BranchZones({ branches }: { branches: BranchRow[] }) {
  const [query, setQuery] = useState('');
  const [onlyUnzoned, setOnlyUnzoned] = useState(true);

  const needle = query.trim().toLowerCase();
  const shown = branches.filter((b) => {
    if (onlyUnzoned && b.zone_code) return false;
    return !needle || b.name.toLowerCase().includes(needle);
  });

  const unzoned = branches.filter((b) => !b.zone_code).length;

  return (
    <>
      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>Find a branch</span>
          <input
            className={styles.input}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Mwanza"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Show</span>
          <select
            className={styles.select}
            value={onlyUnzoned ? 'unzoned' : 'all'}
            onChange={(e) => setOnlyUnzoned(e.target.value === 'unzoned')}
          >
            <option value="unzoned">Only branches with no zone ({unzoned})</option>
            <option value="all">All {branches.length} branches</option>
          </select>
        </label>
      </div>

      <div className={list.wrap}>
        <table className={list.table}>
          <thead>
            <tr>
              <th scope="col">Branch</th>
              <th scope="col">Zone</th>
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, 60).map((branch) => (
              <tr key={branch.id}>
                <th scope="row">{branch.name}</th>
                <td><ZonePicker branch={branch} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {shown.length > 60 ? (
        <p className={styles.help}>
          Showing the first 60 of {shown.length}. Narrow it with the search
          above.
        </p>
      ) : null}

      {shown.length === 0 ? (
        <p className={styles.help}>
          {unzoned === 0
            ? 'Every branch has a zone.'
            : 'No branch matches that.'}
        </p>
      ) : null}
    </>
  );
}
