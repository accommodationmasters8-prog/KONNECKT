import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { KonektLogo } from '@/components/KonektLogo';
import { SignInForm } from '@/components/staff/SignInForm';
import { getStaffSession } from '@/lib/staff-session';
import { localeParams, resolveLocale } from '@/lib/page';
import styles from './sign-in.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Staff sign-in — CRDB Konekt',
  robots: { index: false, follow: false },
};

/**
 * Sign-in.
 *
 * Its own page rather than a modal over the console: a sign-in that is a
 * dialogue cannot be linked to, cannot be bookmarked, and cannot be reached by
 * someone whose session expired on a page that then rendered empty.
 *
 * Two fields and one link. It had three paragraphs explaining access codes,
 * how scope is decided, and who to ask for an account — none of which helps
 * the person standing at it, who already has their credentials in hand and is
 * trying to get past this screen. The one sentence worth keeping is the link
 * for somebody holding a code they have not set up yet.
 */
export default async function StaffSignIn({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const session = await getStaffSession();

  // Already signed in — nobody needs to be asked twice.
  if (session.signedIn) redirect(`/${locale}/staff`);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <Link href={`/${locale}`} className={styles.brand}>
          <KonektLogo label="KONEKT Na CRDB" className={styles.logo} />
        </Link>

        <h1 className={styles.title}>Sign in</h1>

        <SignInForm locale={locale} />

        <p className={styles.foot}>
          <Link href={`/${locale}/staff/join`}>Have a code to set up?</Link>
        </p>
      </div>
    </main>
  );
}
