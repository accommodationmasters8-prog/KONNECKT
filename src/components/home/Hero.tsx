import Link from 'next/link';
import { KonektLogo } from '../KonektLogo';
import { nationalStats } from '@/lib/seed';
import type { Dictionary, Locale } from '@/i18n';
import styles from './Hero.module.css';

/**
 * Hero.
 *
 * White, and almost empty. What sits on this page is the mark, one line about
 * what Konekt is, a way in, and the three figures that say how wide the
 * network runs — nothing else, because everything else lives behind the sign
 * in and the people who need it already know where they are going.
 *
 * It was an ink block with a glow behind it. That reads as a campaign; this
 * reads as a place of work, which is what it is.
 */
export function Hero({ locale, t }: { locale: Locale; t: Dictionary }) {
  const nf = new Intl.NumberFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ');

  const stats = [
    { value: nationalStats.branches, label: t.hero.statBranches },
    { value: nationalStats.institutions, label: t.hero.statCampuses },
    { value: nationalStats.zones, label: t.hero.statZones },
  ];

  return (
    <section className={styles.hero}>
      <div className={`shell ${styles.inner}`}>
        <span className={styles.eyebrow}>{t.hero.eyebrow}</span>

        {/* The lockup, at size, once. Decorative here: the wordmark is read
            out by the headline underneath it. */}
        <KonektLogo label="" className={styles.mark} />

        <h1 className={styles.headline}>{t.hero.headline}</h1>
        <p className={styles.subline}>{t.hero.subline}</p>

        <div className={styles.actions}>
          <Link href={`/${locale}/staff/sign-in`} prefetch={false} className="btn btn--primary btn--lg">
            {t.hero.ctaPrimary}
          </Link>
          <Link href={`/${locale}/map`} prefetch={false} className="btn btn--ghost btn--lg">
            {t.hero.ctaSecondary}
          </Link>
        </div>

        <dl className={styles.stats}>
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
