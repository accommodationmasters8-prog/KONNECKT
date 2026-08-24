import Link from 'next/link';
import type { Dictionary, Locale } from '@/i18n';
import styles from './EventCard.module.css';

export interface EventCardData {
  id: string;
  slug: string | null;
  title: string;
  venue: string;
  city: string;
  when: string;
  status: 'live' | 'upcoming';
  /** True when this is placeholder content, not a published event. */
  isSample: boolean;
  capacity?: number | null;
  registered?: number;
}

/**
 * One event.
 *
 * A sample card carries a visible marker in both languages and is not a link,
 * because there is nothing behind it to open. A real card routes to its own
 * page. The difference is structural rather than a style, so a placeholder can
 * never be mistaken for something registrable.
 */
export function EventCard({
  event,
  locale,
  t,
}: {
  event: EventCardData;
  locale: Locale;
  t: Dictionary;
}) {
  const isLive = event.status === 'live';
  const seatsLeft =
    event.capacity != null && event.registered != null
      ? Math.max(0, event.capacity - event.registered)
      : null;

  const body = (
    <>
      <div className={styles.top}>
        <span className={`badge ${isLive ? 'badge--live' : styles.badgeSoon}`}>
          {isLive ? <span className="tri pulse-live" aria-hidden="true" /> : null}
          {isLive ? t.events.liveBadge : t.events.soonBadge}
        </span>
        {event.isSample ? (
          <span className={styles.sampleTag}>{t.common.sample}</span>
        ) : (
          <span className={styles.freeTag}>{t.common.free}</span>
        )}
      </div>

      <h3 className={`t-h3 ${styles.title}`}>{event.title}</h3>

      <dl className={styles.meta}>
        <dt className="visually-hidden">{t.events.dateLabel}</dt>
        <dd className={styles.metaValue}>{event.when}</dd>
        <dt className="visually-hidden">{t.events.placeLabel}</dt>
        <dd className={styles.metaValue}>
          <span className="tri tri--place" aria-hidden="true" />
          <span>{event.venue}, {event.city}</span>
        </dd>
      </dl>

      {seatsLeft != null ? (
        <div className={styles.capacity}>
          <span
            className={styles.capacityBar}
            style={
              {
                '--fill': `${Math.min(100, ((event.registered ?? 0) / (event.capacity || 1)) * 100)}%`,
              } as React.CSSProperties
            }
            aria-hidden="true"
          />
          <span className={styles.capacityLabel}>
            {seatsLeft} {locale === 'sw' ? 'nafasi zimebaki' : 'seats left'}
          </span>
        </div>
      ) : null}
    </>
  );

  if (event.isSample || !event.slug) {
    return <li className={`card ${styles.card} ${styles.cardSample}`}>{body}</li>;
  }

  return (
    <li>
      <Link
        href={`/${locale}/events/${event.slug}`}
        prefetch={false}
        className={`card card-link ${styles.card}`}
      >
        {body}
      </Link>
    </li>
  );
}
