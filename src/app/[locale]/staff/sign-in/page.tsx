import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthAside } from '@/components/staff/AuthAside';
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
 * Two fields and one link. The form had three paragraphs of explanation before
 * it — about access codes, how scope is decided, who to ask — none of which
 * helps the person standing here, who has their credentials in hand and is
 * trying to get past this screen. That context now sits in the panel beside
 * the form, where it is read by someone waiting rather than someone typing.
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
      <AuthAside
        locale={locale}
        title="Every station CRDB tracks, in one place."
        body="Portfolios, accounts, deposits, channels and loans — recorded station by station, rolled up from branch to zone to HQ."
        points={[
          'Your account decides what you see. Nothing else does.',
          'File daily, weekly or monthly — whatever suits the station.',
          'Take any of it away as a PDF or a spreadsheet.',
        ]}
      />

      <div className={styles.panel}>
        <div className={styles.card}>
          <h1 className={`${styles.title} ${styles.a1}`}>Sign in</h1>
          <p className={`${styles.lead} ${styles.a1}`}>
            Use your work email, or the access code HQ issued you.
          </p>

          <div className={styles.a2}>
            <SignInForm locale={locale} />
          </div>

          <p className={`${styles.foot} ${styles.a3}`}>
            <Link href={`/${locale}/staff/join`}>Have a code to set up?</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
