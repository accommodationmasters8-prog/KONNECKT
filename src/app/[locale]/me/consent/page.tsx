import type { Metadata } from 'next';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { SiteFooter } from '@/components/SiteFooter';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConsentSwitch } from '@/components/member/ConsentSwitch';
import { CONSENT_WORDING } from '@/lib/consent-wording';
import { getServerClient } from '@/lib/supabase/server';
import { localeParams, resolveLocale } from '@/lib/page';
import styles from './consent.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Consent centre — CRDB Konekt',
  robots: { index: false, follow: false },
};

interface ConsentRow {
  purpose: string;
  channel: string | null;
  granted: boolean;
  captured_at: string;
}

/**
 * The consent centre.
 *
 * Every switch here writes a new immutable row rather than editing an old one,
 * so the history of what someone agreed to — and when, and in which language,
 * and in what words — survives them changing their mind. Absence of a record
 * is refusal, not permission: a switch with nothing behind it reads off, and
 * `konekt.may_contact` treats it that way on every send.
 */
export default async function ConsentCentre({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale, t } = await resolveLocale(params);
  const supabase = await getServerClient();

  const latest = new Map<string, ConsentRow>();
  let signedIn = false;

  if (supabase) {
    const { data: auth } = await supabase.auth.getUser();
    signedIn = Boolean(auth?.user);

    if (signedIn) {
      const { data } = await supabase
        .from('consent_records' as never)
        .select('purpose, channel, granted, captured_at')
        .order('captured_at', { ascending: false })
        .limit(200);

      // Newest first, so the first row seen for a key is the current position.
      for (const row of (data as unknown as ConsentRow[]) ?? []) {
        const key = row.channel ? `${row.purpose}:${row.channel}` : row.purpose;
        if (!latest.has(key)) latest.set(key, row);
      }
    }
  }

  return (
    <AppShell locale={locale} t={t} active="me">
      <PageHeader
        eyebrow={t.pages.me.title}
        title={t.pages.me.consentCentre}
        lead={t.pages.me.consentBody}
      />

      <div className={`section ${styles.body}`}>
        <div className="shell">
          {!signedIn ? (
            <EmptyState
              title={supabase ? t.pages.me.signedOut : t.common.notConnected}
              body={supabase ? t.pages.me.signedOutBody : t.common.notConnectedBody}
              action={
                supabase ? (
                  <Link href={`/${locale}/me/sign-in`} prefetch={false} className="btn btn--primary">
                    {t.pages.me.signIn}
                  </Link>
                ) : null
              }
            />
          ) : (
            <div className={styles.list}>
              {Object.entries(CONSENT_WORDING).map(([key, wording]) => {
                const record = latest.get(key);
                return (
                  <ConsentSwitch
                    key={key}
                    consentKey={key}
                    locale={locale}
                    label={wording[locale]}
                    granted={record?.granted ?? false}
                    capturedAt={record?.captured_at ?? null}
                  />
                );
              })}

              <p className={styles.note}>
                {locale === 'sw'
                  ? 'Kila uamuzi huhifadhiwa pamoja na maneno uliyoyasoma na tarehe. Rekodi za awali hazifutwi — ndizo ushahidi wa ulichokubali.'
                  : 'Each decision is stored with the words you read and the date. Earlier records are never deleted — they are the evidence of what you agreed to.'}
              </p>
            </div>
          )}
        </div>
      </div>

      <SiteFooter locale={locale} t={t} />
    </AppShell>
  );
}
