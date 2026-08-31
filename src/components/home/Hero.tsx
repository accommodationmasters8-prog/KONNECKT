import Link from 'next/link';
import { HeroVideo } from './HeroVideo';
import { getPublicMapData } from '@/lib/tracker';
import { nationalStats } from '@/lib/seed';
import type { Dictionary, Locale } from '@/i18n';
import styles from './Hero.module.css';

/**
 * The front door.
 *
 * One sentence about what this is, a way in, and the figures that say how wide
 * the network runs. Nothing is sold here — everyone arriving already works for
 * the bank — so the job is to look like somewhere serious and get them signed
 * in, in as little height as that takes.
 *
 * No lockup over the footage. The clip carries the brand already, and a second
 * mark laid on top of it is the same logo twice on one screen.
 *
 * The reveal is a single staggered sequence on load rather than effects
 * scattered through the page: one orchestrated moment reads as craft, six
 * separate ones read as a template. It is pure CSS, so it plays before any
 * JavaScript arrives and is switched off entirely under reduced motion.
 *
 * The station figure is live where a database is attached and falls back to
 * the committed register where one is not — a zero on the front door would
 * read as a measurement rather than as an absent connection.
 */
export async function Hero({ locale, t }: { locale: Locale; t: Dictionary }) {
  const nf = new Intl.NumberFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ');
  const map = await getPublicMapData();

  // Regions come only from the database, so unlike the other three there is no
  // committed figure to fall back to. A zero on the front door reads as a
  // measurement — "we reach nowhere" — rather than as an absent connection, so
  // the tile is dropped instead of printed at nought.
  const regions = map.regions.filter((r) => r.onMap).length;

  const stats = [
    { value: nationalStats.zones, label: t.hero.statZones },
    { value: nationalStats.branches, label: t.hero.statBranches },
    { value: map.stations || nationalStats.stations, label: t.hero.statStations },
    ...(regions > 0 ? [{ value: regions, label: 'regions reached' }] : []),
  ];

  return (
    /* `on-ink` switches the shared button and link styles to their inverse
       variants. The ghost button in particular is a dark outline on white and
       becomes invisible here without it. */
    <section className={`on-ink ${styles.hero}`}>
      {/* The video is the ground, not an element on it.
          `muted` + `playsInline` are what let it autoplay at all — every
          browser blocks a hero that could make noise, and iOS blocks one that
          would go full screen. `aria-hidden` because it carries no
          information: everything it says is said again in the headline.
          The container is painted with the brand ink underneath, so the first
          frame, a slow connection and a browser that will not decode it all
          land on a designed ground rather than on black. */}
      <div className={styles.stage} aria-hidden="true">
        <HeroVideo className={styles.video} src="/media/konekt-hero.mp4" startAt={7} />
        <span className={styles.scrim} />
      </div>

      <div className={`shell ${styles.inner}`}>
        <span className={`${styles.badge} ${styles.r1}`}>
          <span className={styles.dot} aria-hidden="true" />
          {t.hero.eyebrow}
        </span>

        <h1 className={`${styles.headline} ${styles.r3}`}>{t.hero.headline}</h1>
        <p className={`${styles.subline} ${styles.r4}`}>{t.hero.subline}</p>

        <div className={`${styles.actions} ${styles.r5}`}>
          <Link
            href={`/${locale}/staff/sign-in`}
            prefetch={false}
            className={`btn btn--primary btn--lg ${styles.cta}`}
          >
            {t.hero.ctaPrimary}
          </Link>
          <Link
            href={`/${locale}/map`}
            prefetch={false}
            className={`btn btn--ghost btn--lg ${styles.cta}`}
          >
            {t.hero.ctaSecondary}
          </Link>
        </div>

        <dl className={`${styles.stats} ${styles.r6}`}>
          {stats.map((s) => (
            <div key={s.label} className={styles.stat}>
              <dd className={styles.statValue}>{nf.format(s.value)}</dd>
              <dt className={styles.statLabel}>{s.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
