'use client';

import { useActionState, useState } from 'react';
import {
  issueAccess, revokeAccess, redeemAccess, type ActionResult,
} from '@/app/[locale]/staff/access/actions';
import { ZONE_CODES, zoneWording, type BranchOption } from '@/lib/access-scope';
import styles from './AdminForm.module.css';
import access from './AccessForms.module.css';

const INITIAL: ActionResult = { ok: false, message: '' };

/**
 * Issue a code.
 *
 * The level decides which scope field appears, because the alternative — a
 * zone picker and a branch picker both on screen, one of them ignored — is how
 * a branch code gets issued with a zone attached and nobody notices until the
 * branch cannot see its own stations.
 */
export function IssueAccessForm({ branches }: { branches: BranchOption[] }) {
  const [state, formAction, pending] = useActionState(issueAccess, INITIAL);
  const [level, setLevel] = useState('branch');

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>What level</span>
          <select className={styles.select} name="role" value={level}
            onChange={(e) => setLevel(e.target.value)}>
            <option value="branch">Branch — its own stations only</option>
            <option value="zone">Zone — every branch under it</option>
            <option value="field_agent">Field agent — one branch</option>
            <option value="hq">HQ — the whole country</option>
          </select>
        </label>

        {level === 'zone' ? (
          <label className={styles.field}>
            <span className={styles.label}>Which zone</span>
            <select className={styles.select} name="zone_code" required defaultValue="">
              <option value="" disabled>Choose a zone</option>
              {ZONE_CODES.map((z) => (
                <option key={z} value={z}>{zoneWording(z)}</option>
              ))}
            </select>
          </label>
        ) : level === 'hq' ? (
          <div className={styles.field}>
            <span className={styles.label}>Scope</span>
            <p className={access.scopeNote}>
              Everything, every zone. Issue these sparingly — an HQ code can
              issue more HQ codes.
            </p>
          </div>
        ) : (
          <label className={styles.field}>
            <span className={styles.label}>Which branch</span>
            <select className={styles.select} name="branch_id" required defaultValue="">
              <option value="" disabled>Choose a branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>
        )}

        <label className={styles.field}>
          <span className={styles.label}>Who gets it</span>
          <input className={styles.input} name="holder_name" required
            placeholder="Asha Mwakalinga" />
          <span className={styles.help}>The person, not the office.</span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Their phone</span>
          <input className={styles.input} name="holder_phone" type="tel"
            placeholder="+255712345678" />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Label</span>
          <input className={styles.input} name="label" required
            placeholder="Dodoma branch — reporting" />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Good for</span>
          <select className={styles.select} name="expires_days" defaultValue="14">
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
            <option value="0">No expiry</option>
          </select>
          <span className={styles.help}>
            How long they have to use it. Once used, it does not expire — that
            is the account, not the invitation.
          </span>
        </label>

        <label className={`${styles.field} ${styles.gridWide}`}>
          <span className={styles.label}>Note</span>
          <input className={styles.input} name="note"
            placeholder="Anything worth remembering about why this was issued." />
        </label>
      </div>

      <div className={styles.formFoot}>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Issuing…' : 'Issue a code'}
        </button>
        <p className={state.ok ? styles.ok : styles.error} role="status" aria-live="polite">
          {state.message}
        </p>
      </div>

      {state.ok && state.code ? (
        <div className={access.issued} role="status">
          <p className={access.issuedLabel}>Read this out to them</p>
          <p className={access.issuedCode}>{state.code}</p>
          <p className={access.issuedHelp}>
            They enter it at <strong>/staff/join</strong> and choose their own
            passphrase. It stays in the list below, so it can be read again.
          </p>
        </div>
      ) : null}
    </form>
  );
}

export function RevokeAccess({ id, holder }: { id: string; holder: string }) {
  const [state, formAction, pending] = useActionState(revokeAccess, INITIAL);
  return (
    <form action={formAction} className={styles.inlineForm}>
      <input type="hidden" name="grant_id" value={id} />
      <button type="submit" className="btn btn--quiet btn--sm" disabled={pending}>
        {pending ? '…' : 'Revoke'}
      </button>
      <span className="visually-hidden">{holder}</span>
      {state.message ? (
        <span className={state.ok ? styles.ok : styles.error}>{state.message}</span>
      ) : null}
    </form>
  );
}

/**
 * Turn a code into an account.
 *
 * No scope field anywhere on this form. What the account can reach comes from
 * the grant HQ issued, and the person filling this in is the person being
 * granted access — asking them for their own level would be asking the fox.
 */
export function JoinForm({ locale }: { locale: string }) {
  const [state, formAction, pending] = useActionState(redeemAccess, INITIAL);

  if (state.ok) {
    return (
      <div className={access.done} role="status">
        <p className={access.doneTitle}>Your account is ready.</p>
        <p className={access.doneBody}>
          Sign in with <strong>{state.code}</strong> and the passphrase you just
          chose. Your code is your username from now on.
        </p>
        <a className="btn btn--primary" href={`/${locale}/staff/sign-in`}>
          Go to sign-in
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className={styles.form}>
      <label className={styles.field}>
        <span className={styles.label}>Your access code</span>
        <input className={styles.input} name="code" required
          autoComplete="off" spellCheck={false}
          placeholder="KNK-XXXX-XXXX" />
        <span className={styles.help}>The code HQ gave you. Case does not matter.</span>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Your name</span>
        <input className={styles.input} name="full_name" required
          autoComplete="name" placeholder="Asha Mwakalinga" />
        <span className={styles.help}>
          Every figure you file is recorded against this.
        </span>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Choose a passphrase</span>
        <input className={styles.input} name="passphrase" type="password" required
          minLength={10} autoComplete="new-password" />
        <span className={styles.help}>
          At least ten characters. Nobody at HQ can see it, and nobody can
          reset it by email — this account has no inbox.
        </span>
      </label>

      <div className={styles.formFoot}>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Setting up…' : 'Set up my access'}
        </button>
        <p className={state.ok ? styles.ok : styles.error} role="status" aria-live="polite">
          {state.message}
        </p>
      </div>
    </form>
  );
}
