import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { KonektLogo } from '@/components/KonektLogo';
import { SignInForm } from '@/components/staff/SignInForm';
import { getFreelancerSession } from '@/lib/freelancer-session';
import { localeParams, resolveLocale } from '@/lib/page';
import styles from '../../staff/sign-in/sign-in.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Freelancer sign-in — CRDB Konekt',
  robots: { index: false, follow: false },
};

export default async function FreelancerSignIn({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const session = await getFreelancerSession();
  if (session.freelancer) redirect(`/${locale}/freelancer`);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <Link href={`/${locale}`} className={styles.brand}>
          <KonektLogo label="KONEKT Na CRDB" className={styles.logo} />
        </Link>

        <h1 className={styles.title}>Freelancer sign-in</h1>
        <p className={styles.lead}>
          For registered freelancers. You see your own production and nothing
          else — not member records, not another freelancer&rsquo;s accounts.
        </p>

        <SignInForm locale={locale} redirectTo="freelancer" audience="registered freelancer" />

        <p className={styles.foot}>
          Not registered yet? A CRDB branch registers freelancers and activates
          them. <Link href={`/${locale}`}>Back to the site</Link>
        </p>
      </div>
    </main>
  );
}
