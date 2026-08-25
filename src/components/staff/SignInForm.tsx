'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getBrowserClient } from '@/lib/supabase/browser';
import styles from './SignInForm.module.css';

type Status =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'error'; message: string }
  | { kind: 'sent'; message: string };

/**
 * Staff sign-in.
 *
 * Password first, because staff accounts are provisioned by HQ rather than
 * self-registered, and a reset link second for the case that actually happens
 * — someone at a branch who has forgotten it.
 *
 * The client library writes the session cookies, and the middleware refreshes
 * them from then on. Nothing here decides what the user may see: the role is
 * read back from `konekt.staff_users` on the server, under row level security.
 *
 * Errors are shown as the auth server words them, with one exception —
 * "Invalid login credentials" is reworded, because it is the one message a
 * tired person reads as "the system is broken" rather than "check the
 * password".
 */
export function SignInForm({
  locale,
  redirectTo = 'staff',
  audience = 'staff account',
}: {
  locale: string;
  /** Path under the locale to land on once signed in. */
  redirectTo?: string;
  /** What kind of account this form is for, used in the failure message. */
  audience?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const client = getBrowserClient();

  if (!client) {
    return (
      <p className={styles.unconfigured}>
        No database is attached to this deployment, so there is nothing to sign
        in to yet. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
        <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, and this form starts
        working — see <code>docs/DATABASE.md</code>.
      </p>
    );
  }

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setStatus({ kind: 'working' });

    const { error } = await client!.auth.signInWithPassword({ email, password });

    if (error) {
      setStatus({
        kind: 'error',
        message:
          error.message === 'Invalid login credentials'
            ? `That email and password do not match a ${audience}.`
            : error.message,
      });
      return;
    }

    // refresh() rather than push(): the console is a server component, and it
    // has to be re-rendered with the new cookies before it knows who this is.
    router.replace(`/${locale}/${redirectTo}`);
    router.refresh();
  }

  async function sendReset() {
    if (!email) {
      setStatus({ kind: 'error', message: 'Enter your work email first.' });
      return;
    }
    setStatus({ kind: 'working' });
    const { error } = await client!.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/${locale}/${redirectTo}`,
    });
    setStatus(
      error
        ? { kind: 'error', message: error.message }
        : {
            kind: 'sent',
            message: `If ${email} is a staff account, a reset link is on its way.`,
          },
    );
  }

  const busy = status.kind === 'working';

  return (
    <form className={styles.form} onSubmit={signIn} noValidate>
      <label className={styles.field}>
        <span className={styles.label}>Work email</span>
        <input
          className={styles.input}
          type="email"
          name="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Password</span>
        <input
          className={styles.input}
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      {/* aria-live so the result reaches a screen reader without moving focus
          away from the field someone is about to correct. */}
      <p className={styles.status} role="status" aria-live="polite">
        {status.kind === 'error' ? (
          <span className={styles.error}>{status.message}</span>
        ) : status.kind === 'sent' ? (
          <span className={styles.sent}>{status.message}</span>
        ) : null}
      </p>

      <div className={styles.actions}>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <button type="button" className={styles.linkButton} onClick={sendReset} disabled={busy}>
          Email me a reset link
        </button>
      </div>
    </form>
  );
}
