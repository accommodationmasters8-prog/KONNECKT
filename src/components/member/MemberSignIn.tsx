'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getBrowserClient } from '@/lib/supabase/browser';
import styles from './MemberSignIn.module.css';

type Step = 'phone' | 'code';

/**
 * Member sign-in, by phone.
 *
 * Phone is the identity in this platform — one verified phone, one member,
 * enforced by a unique constraint rather than by a screen. So the sign-in is
 * an OTP to that number, not an email and password a 19-year-old will have
 * forgotten by the next event.
 *
 * Delivery needs an SMS provider configured on the Supabase project. Until
 * there is one the request fails with the provider's own message, which is
 * shown as-is rather than hidden behind "something went wrong" — the person
 * waiting for a code deserves to know it was never sent.
 */
export function MemberSignIn({ locale }: { locale: string }) {
  const router = useRouter();
  const client = getBrowserClient();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!client) {
    return (
      <p className={styles.unconfigured}>
        No database is attached to this deployment, so there is no account to
        sign in to yet.
      </p>
    );
  }

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    const trimmed = phone.replace(/\s+/g, '');
    if (!/^\+[1-9][0-9]{7,14}$/.test(trimmed)) {
      setError('Enter your number in international form, like +255712345678.');
      return;
    }

    setBusy(true);
    const { error: sendError } = await client!.auth.signInWithOtp({ phone: trimmed });
    setBusy(false);

    if (sendError) {
      setError(sendError.message);
      return;
    }
    setPhone(trimmed);
    setStep('code');
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);

    const { error: verifyError } = await client!.auth.verifyOtp({
      phone,
      token: code.trim(),
      type: 'sms',
    });

    setBusy(false);

    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    router.replace(`/${locale}/me`);
    router.refresh();
  }

  return step === 'phone' ? (
    <form className={styles.form} onSubmit={sendCode} noValidate>
      <label className={styles.field}>
        <span className={styles.label}>Phone number</span>
        <input
          className={styles.input}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+255712345678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      </label>
      <p className={styles.error} role="status" aria-live="polite">{error}</p>
      <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>
        {busy ? 'Sending…' : 'Send me a code'}
      </button>
    </form>
  ) : (
    <form className={styles.form} onSubmit={verify} noValidate>
      <label className={styles.field}>
        <span className={styles.label}>The code sent to {phone}</span>
        <input
          className={styles.input}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
      </label>
      <p className={styles.error} role="status" aria-live="polite">{error}</p>
      <div className={styles.actions}>
        <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>
          {busy ? 'Checking…' : 'Sign in'}
        </button>
        <button
          type="button"
          className={styles.linkButton}
          onClick={() => { setStep('phone'); setCode(''); setError(''); }}
        >
          Use a different number
        </button>
      </div>
    </form>
  );
}
