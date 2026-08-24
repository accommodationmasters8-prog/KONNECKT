import { sampleEvents } from '@/lib/sample-events';
import { SectionHead } from './SectionHead';
import { EventCard } from '../ui/EventCard';
import type { Dictionary, Locale } from '@/i18n';
import styles from './EventsPreview.module.css';

/**
 * Live now / next up.
 *
 * Phase 1 has no events table, so this renders the placeholder programme from
 * `sample-events.ts`. Each card carries a visible marker in both locales and
 * the section is described by a notice explaining that the calendar is not
 * open yet. Nothing is registrable and nothing claims to be.
 */
export function EventsPreview({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <section
      id="events"
      className={`section chev-edge-top ${styles.section}`}
      aria-labelledby="events-title"
      aria-describedby="events-notice"
    >
      <div className="shell">
        <SectionHead
          id="events-title"
          eyebrow={t.events.eyebrow}
          accent="teal"
          title={t.events.title}
          lead={t.events.lead}
          action={{ href: `/${locale}/events`, label: t.common.seeAll }}
          marker={<span className="tri tri--live pulse-live" aria-hidden="true" />}
        />

        <p id="events-notice" className={styles.notice}>
          {t.events.seedNotice}
        </p>

        <ul className="rail bleed">
          {sampleEvents.map((event) => (
            <EventCard
              key={event.id}
              locale={locale}
              t={t}
              event={{
                id: event.id,
                slug: null,
                title: event.title[locale],
                venue: event.venue,
                city: event.city,
                when: event.when[locale],
                status: event.status,
                isSample: true,
              }}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
