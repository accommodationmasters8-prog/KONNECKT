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
 * Staff sign-in.
 *
 * Its own page rather than a modal over the console: a sign-in that is a
 * dialogue cannot be linked to, cannot be bookmarked, and cannot be reached by
 * someone whose session expired on a page that then rendered empty.
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

        <h1 className={styles.title}>Staff console</h1>
        <p className={styles.lead}>
          For CRDB staff and field agents. What you can see after signing in is
          decided by your role in the database, not by this page.
        </p>

        <SignInForm locale={locale} />

        <p className={styles.foot}>
          No account? Staff access is provisioned by HQ — ask your zone manager
          to raise it. <Link href={`/${locale}`}>Back to the site</Link>
        </p>
      </div>
    </main>
  );
}
