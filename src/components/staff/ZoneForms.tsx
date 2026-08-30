'use client';

import { useActionState } from 'react';
import { addZone, saveBranch, type ActionResult } from '@/app/[locale]/staff/settings/actions';
import styles from './AdminForm.module.css';

const INITIAL: ActionResult = { ok: false, message: '' };

/**
 * Add a zone, from the screen that lists zones.
 *
 * The code is not asked for. `zone_code` is an enum twelve tables reference,
 * and a person typing it twice types it two ways — so the name is the input
 * and the code is derived from it, once, on the server.
 */
export function AddZone() {
  const [state, formAction, pending] = useActionState(addZone, INITIAL);

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>Zone name</span>
          <input className={styles.input} name="name_en" required placeholder="Southern Highlands" />
          <span className={styles.help}>
            Its code is made from this name and never changes afterwards —
            every branch, station and access code filed against the zone is
            keyed on it.
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Name in Swahili</span>
          <input className={styles.input} name="name_sw" placeholder="Kanda ya Nyanda za Juu Kusini" />
          <span className={styles.help}>Optional. The English name is used if this is left empty.</span>
        </label>
      </div>

      <div className={styles.formFoot}>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Adding…' : 'Add zone'}
        </button>
        <p className={state.ok ? styles.ok : styles.error} role="status" aria-live="polite">
          {state.message}
        </p>
      </div>
    </form>
  );
}

/**
 * Add a branch, without leaving the zone you are looking at.
 *
 * The zone is carried in a hidden field because the answer is already known:
 * you are standing inside that zone's panel. Asking for it in a dropdown of
 * eight is a question with exactly one right answer, and the wrong answer is
 * a branch nobody's zone manager can see.
 *
 * A zone manager's own zone is applied on the server whatever this field
 * says, so the hidden value is a convenience and never the authorisation.
 */
export function AddBranchToZone({ zone, zoneLabel }: { zone: string; zoneLabel: string }) {
  const [state, formAction, pending] = useActionState(saveBranch, INITIAL);

  return (
    <form action={formAction} className={styles.inlineAdd}>
      <input type="hidden" name="zone_code" value={zone} />
      <label className={styles.inlineField}>
        <span className={styles.srOnly}>New branch in {zoneLabel}</span>
        <input
          className={styles.input}
          name="name"
          required
          placeholder={`New branch in ${zoneLabel}`}
          aria-label={`New branch in ${zoneLabel}`}
        />
      </label>
      <label className={styles.inlineField}>
        <span className={styles.srOnly}>Year established</span>
        <input
          className={styles.input}
          type="number"
          name="year_established"
          min="1960"
          max={new Date().getFullYear() + 1}
          placeholder="Year"
          aria-label={`Year ${zoneLabel} branch was established`}
        />
      </label>
      <button type="submit" className="btn btn--quiet btn--sm" disabled={pending}>
        {pending ? 'Adding…' : 'Add branch'}
      </button>
      {state.message ? (
        <span className={state.ok ? styles.ok : styles.error} role="status" aria-live="polite">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
