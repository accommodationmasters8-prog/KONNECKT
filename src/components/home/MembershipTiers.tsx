import Link from 'next/link';
import { SectionHead } from './SectionHead';
import type { Dictionary, Locale, TierKey } from '@/i18n';
import styles from './MembershipTiers.module.css';

/**
 * Membership tiers — Silver, Gold, Platinum.
 *
 * Restrained by design: this is aspiration, not a pricing table. No prices, no
 * ticks-in-a-matrix, no "most popular" flag. The criteria shown are the real
 * ones from the membership framework, including the fact that turning up to
 * Konekt events is part of how a tier is earned.
 *
 * Nothing here calculates a tier. Tier standing is computed in core banking
 * and consumed as a value; the platform never touches the transaction data
 * behind it.
 */
const TIER_ORDER: TierKey[] = ['silver', 'gold', 'platinum'];

export function MembershipTiers({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <section
      id="membership"
      className={`section chev-edge-top ${styles.section}`}
      aria-labelledby="membership-title"
    >
      <div className="shell">
        <SectionHead
          id="membership-title"
          eyebrow={t.membership.eyebrow}
          accent="teal"
          title={t.membership.title}
          lead={t.membership.lead}
          action={{ href: `/${locale}/membership`, label: t.common.seeAll }}
        />
        <p className={`t-caption ${styles.ageNote}`}>{t.membership.ageNote}</p>

        <ol className={styles.grid}>
          {TIER_ORDER.map((key, index) => {
            const tier = t.membership.tiers[key];
            return (
              <li key={key} className={`card ${styles.tier} ${styles[key]}`}>
                <span className={styles.rung} aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className={`t-h3 ${styles.tierName}`}>{tier.name}</h3>
                <p className={`t-caption ${styles.tierBlurb}`}>{tier.blurb}</p>
                <ul className={styles.points}>
                  {tier.points.map((point) => (
                    <li key={point} className={styles.point}>
                      <span className="tri" aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>

        <div className={styles.footNotes}>
          <div className={styles.stepDown}>
            <h3 className={`t-h3 ${styles.stepDownTitle}`}>
              {t.membership.stepDownTitle}
            </h3>
            <p className="t-caption">{t.membership.stepDownBody}</p>
          </div>
          <p className={`t-caption ${styles.pending}`}>
            <span className="tri tri--live" aria-hidden="true" />
            {t.membership.benefitsNote}
          </p>
        </div>
      </div>
    </section>
  );
}
