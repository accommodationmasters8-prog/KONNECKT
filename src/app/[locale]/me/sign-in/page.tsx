import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { SiteFooter } from '@/components/SiteFooter';
import { PageHeader } from '@/components/ui/PageHeader';
import { MemberSignIn } from '@/components/member/MemberSignIn';
import { getServerClient } from '@/lib/supabase/server';
import { localeParams, resolveLocale } from '@/lib/page';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Sign in — CRDB Konekt',
  robots: { index: false, follow: false },
};

export default async function MemberSignInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale, t } = await resolveLocale(params);
  const supabase = await getServerClient();

  if (supabase) {
    const { data } = await supabase.auth.getUser();
    if (data?.user) redirect(`/${locale}/me`);
  }

  return (
    <AppShell locale={locale} t={t} active="me">
      <PageHeader
        eyebrow={t.pages.me.title}
        title={t.pages.me.signIn}
        lead={
          locale === 'sw'
            ? 'Namba yako ya simu ndiyo utambulisho wako. Tutakutumia namba ya siri ya mara moja.'
            : 'Your phone number is your identity here. We send a one-time code to it — no password to forget.'
        }
      />
      <div className="section">
        <div className="shell" style={{ maxInlineSize: '30rem' }}>
          <MemberSignIn locale={locale} />
        </div>
      </div>
      <SiteFooter locale={locale} t={t} />
    </AppShell>
  );
}
