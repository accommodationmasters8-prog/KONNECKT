import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { MetricCard } from '@/components/staff/MetricCard';
import {
  AddEventImage, EventForm, RemoveEventImage, type EventFields,
} from '@/components/staff/EventForms';
import { staffNav, STAFF_LABELS } from '@/lib/staff-nav';
import { getStaffSession } from '@/lib/staff-session';
import { getServerClient } from '@/lib/supabase/server';
import { count, getCategories, money } from '@/lib/tracker';
import { resolveLocale } from '@/lib/page';
import styles from '../../staff.module.css';

export const metadata: Metadata = {
  title: 'Event — Konekt tracker',
  robots: { index: false, follow: false },
};

interface EventRow extends EventFields {
  id: string;
  simbanking_activated?: number | null;
  cards_issued?: number | null;
  lipa_hapa_registered?: number | null;
  name: string;
  event_date: string;
  venue: string;
  zone_code: string | null;
  branch_id: string;
}

interface ImageRow {
  id: string;
  external_url: string | null;
  caption: string | null;
  created_at: string;
}

/**
 * One event, after the fact.
 *
 * Recording an event and finishing it are different moments: the name, date
 * and budget are known beforehand, and the turnout, the accounts opened and
 * the photographs only exist afterwards. So this is an edit screen, not a
 * read-only record — somebody comes back a week later and fills in what
 * actually happened.
 *
 * Ten images is the cap, enforced by a trigger rather than by this form, and
 * the album link carries the rest. That number is not arbitrary: it is what a
 * branch can attach over a 3G connection without giving up halfway.
 */
export default async function EventPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale } = await resolveLocale(params as Promise<{ locale: string }>);
  const { id } = await params;
  const session = await getStaffSession();
  const supabase = await getServerClient();
  const nav = staffNav(locale, STAFF_LABELS);

  if (!supabase || !session.signedIn) {
    return (
      <StaffShell
        locale={locale} role={session.role} active="events" nav={nav}
        title="Event" scopeLabel={session.scopeLabel} user={session.user}
      >
        <Panel title="Event">
          <PanelEmpty>Sign in to open an event.</PanelEmpty>
        </Panel>
      </StaffShell>
    );
  }

  const [eventRes, imagesRes, stationsRes, categories] = await Promise.all([
    supabase.from('tracked_events' as never)
      .select('id, name, event_date, end_date, venue, address, station_id, category_id, branch_id, zone_code, participants, budget_tzs, actual_spend_tzs, accounts_opened, simbanking_activated, cards_issued, lipa_hapa_registered, deposits_tzs, album_url, notes')
      .eq('id', id)
      .maybeSingle(),
    supabase.from('tracked_event_images' as never)
      .select('id, external_url, caption, created_at')
      .eq('event_id', id)
      .order('created_at', { ascending: true }),
    supabase.from('stations' as never)
      .select('id, name')
      .order('name', { ascending: true })
      .limit(1000),
    getCategories(),
  ]);

  const event = eventRes.data as unknown as EventRow | null;

  // Missing or out of reach — the console does not distinguish, because
  // saying "exists, but not yours" is itself a disclosure about another
  // branch's diary.
  if (!event) notFound();

  const images = (imagesRes.data as unknown as ImageRow[]) ?? [];
  const stations = (stationsRes.data as unknown as { id: string; name: string }[]) ?? [];

  const past = new Date(event.event_date) < new Date();
  const spend = Number(event.actual_spend_tzs ?? 0);
  const opened = Number(event.accounts_opened ?? 0);
  const budget = Number(event.budget_tzs ?? 0);
  const variance = budget > 0 && spend > 0
    ? Math.round(((spend - budget) / budget) * 1000) / 10
    : null;

  const day = new Intl.DateTimeFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <StaffShell
      locale={locale}
      role={session.role}
      active="events"
      nav={nav}
      title={event.name}
      scopeLabel={[
        day.format(new Date(event.event_date)),
        event.venue,
        past ? 'Past' : 'Upcoming',
      ].filter(Boolean).join(' · ')}
      user={session.user}
      actions={
        <>
          <a
            className="btn btn--quiet btn--sm"
            href={`/${locale}/staff/reports/print?kind=event&event=${event.id}`}
            target="_blank"
            rel="noreferrer"
          >
            Report with pictures
          </a>
          <Link href={`/${locale}/staff/events`} className={styles.link}>← All events</Link>
        </>
      }
    >
      <div className={styles.metrics}>
        <MetricCard
          tone="teal"
          label="Turnout"
          value={event.participants ? count(Number(event.participants), locale) : '—'}
          note={past ? 'as recorded afterwards' : 'expected'}
        />
        <MetricCard
          tone="green"
          label="Accounts opened"
          value={opened ? count(opened, locale) : '—'}
          note={
            event.participants && opened
              ? `${Math.round((opened / Number(event.participants)) * 1000) / 10}% of those who came`
              : 'Nothing recorded yet'
          }
        />
        <MetricCard
          tone="gold"
          label="SimBanking activated"
          value={
            event.simbanking_activated
              ? count(Number(event.simbanking_activated), locale)
              : '—'
          }
          note={
            event.cards_issued || event.lipa_hapa_registered
              ? `${count(Number(event.cards_issued ?? 0), locale)} cards · ${count(Number(event.lipa_hapa_registered ?? 0), locale)} Lipa Hapa`
              : 'Cards and Lipa Hapa not recorded'
          }
        />
        <MetricCard
          tone="ink"
          label="Deposits raised"
          value={event.deposits_tzs ? money(Number(event.deposits_tzs), locale, true) : '—'}
          note={
            variance === null
              ? budget ? `against ${money(budget, locale, true)} budgeted` : 'No budget set'
              : `spend ${variance >= 0 ? 'over' : 'under'} budget by ${Math.abs(variance)}%`
          }
        />
      </div>

      <Panel
        title="Pictures"
      >
        {images.length === 0 ? (
          <PanelEmpty>
            No pictures yet. Add them below — an event without any is hard to
            report on afterwards.
          </PanelEmpty>
        ) : (
          <ul className={styles.imageGrid}>
            {images.map((image) => (
              <li key={image.id} className={styles.imageItem}>
                {image.external_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element --
                     the host is whatever the branch pasted, so it cannot be in
                     next.config's allowlist and cannot be optimised. */
                  <img
                    src={image.external_url}
                    alt={image.caption ?? `Picture from ${event.name}`}
                    className={styles.imageThumb}
                    loading="lazy"
                  />
                ) : (
                  <div className={styles.imageMissing}>No link</div>
                )}
                <span className={styles.imageCaption}>{image.caption ?? '—'}</span>
                <RemoveEventImage id={image.id} />
              </li>
            ))}
          </ul>
        )}

        <div className={styles.formBelowTable}>
          <AddEventImage eventId={event.id} used={images.length} />
        </div>
      </Panel>

      <Panel
        title="What happened"
      >
        <EventForm
          event={event}
          stations={stations}
          categories={categories.map((c) => ({ id: c.id, name: c.name_en }))}
          branches={[]}
          needsBranch={false}
        />
      </Panel>

      {event.album_url ? (
        <Panel title="Full album">
          <p className={styles.plainNote}>
            <a href={event.album_url} className={styles.link} rel="noreferrer noopener" target="_blank">
              {event.album_url}
            </a>
          </p>
        </Panel>
      ) : null}
    </StaffShell>
  );
}
