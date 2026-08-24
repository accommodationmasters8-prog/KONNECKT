import Link from 'next/link';
import { KonektMark } from '../KonektMark';
import { CrdbLogo } from '../CrdbLogo';
import { nationalStats } from '@/lib/seed';
import type { Dictionary, Locale } from '@/i18n';
import styles from './Hero.module.css';

/**
 * Hero.
 *
 * Ink ground with one soft brand ramp behind the mark — no mesh, no glass, no
 * second motif. The CRDB parent brand sits at the top of the block rather than
 * in the footer: this is a bank's product and the bank's name is the reason a
 * 19-year-old trusts it with an account.
 *
 * No video ships. There is no encode that clears the §2.2 gate, and a hero
 * that only looks finished once a 1.2MB file lands is a hero that fails on 3G
 * in Mwanza. The mark assembly is the motion, at about 1KB of inline SVG.
 */
export function Hero({ locale, t }: { locale: Locale; t: Dictionary }) {
  const nf = new Intl.NumberFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ');

  const stats = [
    { value: nationalStats.branches, label: t.hero.statBranches },
    { value: nationalStats.institutions, label: t.hero.statCampuses },
    { value: nationalStats.zones, label: t.hero.statZones },
  ];

  return (
    <section className={`${styles.hero} on-ink`}>
      <div className={`shell ${styles.inner}`}>
        <div className={styles.parentBrand}>
          <CrdbLogo label="CRDB Bank Plc" tone="onInk" />
          <span className={styles.parentDivider} aria-hidden="true" />
          <span className={styles.parentTag}>{t.hero.eyebrow}</span>
        </div>

        <div className={styles.body}>
          <div className={styles.copy}>
            {/* The logo's own bilingual tagline is the brand voice, so the
                headline is the tagline — identical in both locales, because
                the code-switch is the point of it. */}
            <h1 className={`t-hero ${styles.headline}`}>
              <span className={styles.headlineLead}>{t.hero.headlineLead}</span>{' '}
              <span className={styles.headlineMark}>{t.hero.headlineMark}</span>{' '}
              <span className={styles.headlineTail}>{t.hero.headlineTail}</span>
            </h1>

            <p className={`t-lead ${styles.subline}`}>{t.hero.subline}</p>

            <div className={styles.actions}>
              <Link href={`/${locale}/events`} prefetch={false} className="btn btn--primary btn--lg">
                {t.hero.ctaPrimary}
              </Link>
              <Link href={`/${locale}/membership`} prefetch={false} className="btn btn--ghost btn--lg">
                {t.hero.ctaSecondary}
              </Link>
            </div>
          </div>

          <div className={styles.markWrap}>
            <span className={styles.markGlow} aria-hidden="true" />
            <KonektMark title={t.hero.markAlt} animate className={styles.mark} />
          </div>
        </div>

        <dl className={styles.stats}>
          {stats.map((s) => (
            <div key={s.label} className={styles.stat}>
              <dd className={`t-data ${styles.statValue}`}>{nf.format(s.value)}</dd>
              <dt className={styles.statLabel}>{s.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
