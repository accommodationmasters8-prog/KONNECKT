import { sampleEvents } from '@/lib/sample-events';
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
        <div className="reveal-head">
          <p className="t-eyebrow" style={{ color: 'var(--konekt-teal-deep)' }}>
            <span className="tri tri--live pulse-live" aria-hidden="true" />
            {t.events.eyebrow}
          </p>
          <h2 id="events-title" className="t-h2">{t.events.title}</h2>
          <p className={`t-lead t-muted ${styles.lead}`}>{t.events.lead}</p>
        </div>

        <p id="events-notice" className={styles.notice}>
          {t.events.seedNotice}
        </p>

        <ul className={styles.grid}>
          {sampleEvents.map((event) => {
            const isLive = event.status === 'live';
            return (
              <li key={event.id} className={`card ${styles.card}`}>
                <div className={styles.cardTop}>
                  <span className={`badge ${isLive ? 'badge--live' : styles.badgeSoon}`}>
                    {isLive ? (
                      <span className="tri pulse-live" aria-hidden="true" />
                    ) : null}
                    {isLive ? t.events.liveBadge : t.events.soonBadge}
                  </span>
                  <span className={styles.sampleTag}>
                    {locale === 'sw' ? 'Mfano' : 'Sample'}
                  </span>
                </div>

                <h3 className={`t-h3 ${styles.cardTitle}`}>{event.title[locale]}</h3>

                <dl className={styles.meta}>
                  <dt className="visually-hidden">{t.events.dateLabel}</dt>
                  <dd className={styles.metaValue}>{event.when[locale]}</dd>
                  <dt className="visually-hidden">{t.events.placeLabel}</dt>
                  <dd className={styles.metaValue}>
                    <span className="tri tri--place" aria-hidden="true" />
                    {event.venue}, {event.city}
                  </dd>
                </dl>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
