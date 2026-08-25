import type { Metadata } from 'next';
import Link from 'next/link';
import { KonektLogo } from '@/components/KonektLogo';
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
      <div className={styles.card}>
        <Link href={`/${locale}`} className={styles.brand}>
          <KonektLogo label="KONEKT Na CRDB" className={styles.logo} />
        </Link>

        <h1 className={styles.title}>Set up your access</h1>
        <p className={styles.lead}>
          HQ has given you a code. It becomes your username — there is no work
          email in this, and nothing to confirm in an inbox. Choose a
          passphrase and you are in.
        </p>

        <JoinForm locale={locale} />

        <p className={styles.foot}>
          Already set up? <Link href={`/${locale}/staff/sign-in`}>Sign in</Link>
        </p>
      </div>
    </main>
  );
}
