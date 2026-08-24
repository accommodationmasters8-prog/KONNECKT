import { KonektMark } from './KonektMark';
import { nationalStats } from '@/lib/seed';
import type { Dictionary, Locale } from '@/i18n';
import styles from './Hero.module.css';

/**
 * Hero — dark ink canvas so teal, yellow and pink read almost like neon.
 *
 * No video ships in Phase 1. There is no encode that clears the §2.2 gate yet,
 * and a hero that only looks finished once a 1.2MB file lands is a hero that
 * fails on 3G in Mwanza. The mark assembly is the motion; it is 1KB of SVG.
 * When a clip exists, it drops in behind this composition with the current
 * layout as its poster state — nothing here has to move.
 */
export function Hero({ locale, t }: { locale: Locale; t: Dictionary }) {
  const stats = [
    { value: nationalStats.zones, label: t.hero.statZones },
    { value: nationalStats.branches, label: t.hero.statBranches },
    { value: nationalStats.institutions, label: t.hero.statCampuses },
  ];

  return (
    <section className={`${styles.hero} on-ink`}>
      <div className={`shell ${styles.inner}`}>
        <div className={styles.copy}>
          <p className={`t-eyebrow ${styles.eyebrow}`}>
            <span className="tri tri--live" aria-hidden="true" />
            {t.hero.eyebrow}
          </p>

          {/* The bilingual code-switch in the logo's own tagline is the brand
              voice, so the headline is the tagline — identical in both
              locales, because that is the point of it. */}
          {/* The spans stack visually, but a screen reader reads the
              accessible name as one string — without these separators it
              announces "let'sKONEKTNa CRDB". */}
          <h1 className={`t-hero ${styles.headline}`}>
            <span className={styles.headlineLead}>{t.hero.headlineLead}</span>{' '}
            <span className={styles.headlineMark}>{t.hero.headlineMark}</span>{' '}
            <span className={styles.headlineTail}>{t.hero.headlineTail}</span>
          </h1>

          <p className={`t-lead ${styles.subline}`}>{t.hero.subline}</p>

          <div className={styles.actions}>
            <a href="#events" className="btn btn--primary">
              {t.hero.ctaPrimary}
            </a>
            <a href="#membership" className="btn btn--ghost">
              {t.hero.ctaSecondary}
            </a>
          </div>

          <dl className={styles.stats}>
            {stats.map((s) => (
              <div key={s.label} className={styles.stat}>
                <dt className={styles.statLabel}>{s.label}</dt>
                <dd className={`t-data ${styles.statValue}`}>
                  {s.value.toLocaleString(locale === 'sw' ? 'sw-TZ' : 'en-TZ')}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className={styles.markWrap}>
          <KonektMark title={t.hero.markAlt} animate className={styles.mark} />
        </div>
      </div>
    </section>
  );
}
