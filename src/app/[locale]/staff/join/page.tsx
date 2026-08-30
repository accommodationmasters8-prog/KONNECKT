import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthAside } from '@/components/staff/AuthAside';
import { JoinForm } from '@/components/staff/AccessForms';
import { localeParams, resolveLocale } from '@/lib/page';
import styles from '../sign-in/sign-in.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Redeem your access code — Konekt tracker',
  robots: { index: false, follow: false },
};

/**
 * Turn a code into an account.
 *
 * Its own page rather than a step on the sign-in form: the person here has
 * never signed in and never will with an email, and asking them to find the
 * right tab on a form built for people who already have an account is how a
 * branch officer gives up and phones HQ.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);

  return (
    <main className={styles.page}>
      <AuthAside
        locale={locale}
        title="One code, once. Then it is your account."
        body="HQ issued you a code. Redeeming it creates your account at exactly the level the code carries — you do not choose your own scope, and there is nothing to confirm in an inbox."
        points={[
          'The code becomes your username.',
          'You choose the passphrase, and only you know it.',
          'A code works once. After that it is spent.',
        ]}
      />

      <div className={styles.panel}>
        <div className={styles.card}>
          <h1 className={`${styles.title} ${styles.a1}`}>Set up your access</h1>
          <p className={`${styles.lead} ${styles.a1}`}>
            Enter the code exactly as HQ gave it to you, with or without the
            dashes.
          </p>

          <div className={styles.a2}>
            <JoinForm locale={locale} />
          </div>

          <p className={`${styles.foot} ${styles.a3}`}>
            Already set up? <Link href={`/${locale}/staff/sign-in`}>Sign in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
