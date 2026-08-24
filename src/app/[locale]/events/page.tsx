import type { Metadata } from 'next';
import { AppShell } from '@/components/shell/AppShell';
import { SiteFooter } from '@/components/SiteFooter';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { EventCard } from '@/components/ui/EventCard';
import { sampleEvents } from '@/lib/sample-events';
import { getServerClient } from '@/lib/supabase/server';
import type { EventRow } from '@/lib/supabase/types';
import { localeParams, resolveLocale } from '@/lib/page';
import { getDictionary, isLocale } from '@/i18n';
import styles from './events.module.css';

export function generateStaticParams() {
  return localeParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return { title: `${t.pages.events.title} — CRDB Konekt`, description: t.pages.events.lead };
}

/**
 * The events page.
 *
 * Reads published events from Supabase when a project is attached. With none
 * attached it falls back to the marked placeholder programme and says so,
 * rather than rendering an empty page that looks broken or inventing listings
 * that look real.
 */
export default async function EventsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale, t } = await resolveLocale(params);
  const supabase = await getServerClient();

  // Typed explicitly rather than inferred: the `no client` branch would
  // otherwise narrow the union to never and every field access would fail.
  type PublishedEvent = Pick<
    EventRow,
    'id' | 'slug' | 'title_en' | 'title_sw' | 'venue_name'
      | 'starts_at' | 'status' | 'capacity' | 'registered_count'
  >;

  let live: PublishedEvent[] = [];
  if (supabase) {
    const { data } = await supabase
      .from('events')
      .select(
        'id, slug, title_en, title_sw, venue_name, starts_at, status, capacity, registered_count',
      )
      .in('status', ['published', 'live'])
      .gte('ends_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(48);
    live = (data as PublishedEvent[] | null) ?? [];
  }

  const formatter = new Intl.DateTimeFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  const events = live.length
    ? live.map((e) => ({
        id: e.id,
        slug: e.slug,
        title: locale === 'sw' ? e.title_sw : e.title_en,
        venue: e.venue_name,
        city: '',
        when: formatter.format(new Date(e.starts_at)),
        status: (e.status === 'live' ? 'live' : 'upcoming') as 'live' | 'upcoming',
        isSample: false,
        capacity: e.capacity,
        registered: e.registered_count,
      }))
    : sampleEvents.map((e) => ({
        id: e.id,
        slug: null,
        title: e.title[locale],
        venue: e.venue,
        city: e.city,
        when: e.when[locale],
        status: e.status,
        isSample: true,
      }));

  const usingFallback = live.length === 0;

  return (
    <AppShell locale={locale} t={t} active="events">
      <PageHeader
        eyebrow={t.events.eyebrow}
        title={t.pages.events.title}
        lead={t.pages.events.lead}
        marker={<span className="tri tri--live pulse-live" aria-hidden="true" />}
      />

      <div className={`section ${styles.body}`}>
        <div className="shell">
          {usingFallback ? (
            <p className={styles.notice}>
              <span className="tri tri--live" aria-hidden="true" />
              {supabase ? t.pages.events.emptyBody : t.events.seedNotice}
            </p>
          ) : null}

          {events.length === 0 ? (
            <EmptyState title={t.pages.events.empty} body={t.pages.events.emptyBody} />
          ) : (
            <>
              {/* The cards are h3s under the page h1, so the list needs its own
                  h2 or the heading order skips a level. It carries no visual
                  weight the page head does not already have, so it is hidden
                  visually and present for anyone navigating by heading. */}
              <h2 className="visually-hidden">{t.events.eyebrow}</h2>
              <ul className={styles.grid}>
              {events.map((event) => (
                <EventCard key={event.id} event={event} locale={locale} t={t} />
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <SiteFooter locale={locale} t={t} />
    </AppShell>
  );
}
