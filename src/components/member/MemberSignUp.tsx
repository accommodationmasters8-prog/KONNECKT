'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { registerMember, type SignUpResult } from '@/app/[locale]/me/sign-up/actions';
import { getBrowserClient } from '@/lib/supabase/browser';
import styles from './MemberSignIn.module.css';

const INITIAL: SignUpResult = { ok: false, message: '' };

/**
 * Join Konekt.
 *
 * Two steps that look like one: a server action creates the account, then this
 * signs in with the password just chosen so the person lands inside rather
 * than back at a login screen. The password is held in component state only
 * long enough to do that, and never leaves the browser except in the two
 * requests that need it.
 *
 * Marketing is a separate, unticked box. That is not a style choice — the
 * database rejects a marketing consent that claims to have come from accepting
 * terms, so bundling them would fail on the way in.
 */
export function MemberSignUp({ locale }: { locale: string }) {
  const router = useRouter();
  const client = getBrowserClient();
  const [state, formAction, pending] = useActionState(registerMember, INITIAL);
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState('');

  // The account exists; finish the job by signing in with it.
  useEffect(() => {
    if (!state.ok || !state.email || !client) return;

    let cancelled = false;
    setSigningIn(true);

    client.auth
      .signInWithPassword({ email: state.email, password })
      .then(({ error }) => {
        if (cancelled) return;
        if (error) {
          setSignInError(
            'Your account was created, but signing in failed. Try signing in with your email and password.',
          );
          setSigningIn(false);
          return;
        }
        router.replace(`/${locale}/me`);
        router.refresh();
      });

    return () => { cancelled = true; };
  }, [state, password, client, locale, router]);

  if (!client) {
    return (
      <p className={styles.unconfigured}>
        No database is attached to this deployment yet, so accounts cannot be
        created.
      </p>
    );
  }

  const sw = locale === 'sw';
  const busy = pending || signingIn;

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="locale" value={locale} />

      <label className={styles.field}>
        <span className={styles.label}>{sw ? 'Jina kamili' : 'Full name'}</span>
        <input className={styles.input} name="full_name" autoComplete="name" required />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{sw ? 'Namba ya simu' : 'Phone number'}</span>
        <input
          className={styles.input}
          name="phone_e164"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+255712345678"
          required
        />
        <span className={styles.hint}>
          {sw
            ? 'Namba moja, mwanachama mmoja. Ndiyo utambulisho wako Konekt.'
            : 'One phone, one member. This is your identity on Konekt.'}
        </span>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{sw ? 'Barua pepe' : 'Email'}</span>
        <input className={styles.input} name="email" type="email" autoComplete="email" required />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{sw ? 'Nenosiri' : 'Password'}</span>
        <input
          className={styles.input}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <span className={styles.hint}>{sw ? 'Angalau herufi 8.' : 'At least 8 characters.'}</span>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>
          {sw ? 'Tarehe ya kuzaliwa' : 'Date of birth'}{' '}
          <span className={styles.optional}>{sw ? '(si lazima)' : '(optional)'}</span>
        </span>
        <input className={styles.input} name="date_of_birth" type="date" />
        <span className={styles.hint}>
          {sw
            ? 'Hutumika kupanga matukio yanayokufaa na kulinda walio chini ya miaka 18.'
            : 'Used to show you what you qualify for, and to protect under-18s. Nothing else.'}
        </span>
      </label>

      <label className={styles.check}>
        <input type="checkbox" name="accepts_terms" required />
        <span>
          {sw ? 'Nakubali ' : 'I accept the '}
          <Link href={`/${locale}/terms`} target="_blank">{sw ? 'masharti ya matumizi' : 'terms of use'}</Link>
          {sw ? ' na nimesoma ' : ' and have read the '}
          <Link href={`/${locale}/privacy`} target="_blank">{sw ? 'taarifa ya faragha' : 'privacy notice'}</Link>.
        </span>
      </label>

      <label className={styles.check}>
        <input type="checkbox" name="accepts_marketing" />
        <span>
          {sw
            ? 'Nitumie matangazo na habari za Konekt kwa SMS. Ni hiari, na kukataa hakubadilishi kitu kingine.'
            : 'Send me Konekt offers and news by SMS. Optional, and saying no changes nothing else.'}
        </span>
      </label>

      <p className={styles.error} role="status" aria-live="polite">
        {signInError || (state.ok ? '' : state.message)}
      </p>

      <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>
        {signingIn
          ? (sw ? 'Inakuingiza…' : 'Signing you in…')
          : pending
            ? (sw ? 'Inatengeneza…' : 'Creating your account…')
            : (sw ? 'Fungua akaunti' : 'Create my account')}
      </button>

      <p className={styles.alt}>
        {sw ? 'Una akaunti tayari? ' : 'Already have an account? '}
        <Link href={`/${locale}/me/sign-in`}>{sw ? 'Ingia' : 'Sign in'}</Link>
      </p>
    </form>
  );
}
