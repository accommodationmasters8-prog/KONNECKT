import type { Dictionary } from '@/i18n';
import { partnerLogoUrl } from '@/lib/partners';
import styles from './PartnerStrip.module.css';

/**
 * Partner ecosystem strip, directly below the hero.
 *
 * These are the partners the membership framework names. Their logos are their
 * trademarks and this build has not been given any of them, so each renders as
 * a typographic plate rather than a drawn approximation — inventing another
 * company's mark is not a placeholder, it is a misrepresentation.
 *
 * The strip is also labelled indicative, because the framework says the
 * partnerships are pending Marketing and Legal sign-off. Showing them as
 * settled would be the platform's first false claim.
 *
 * Once Supabase is attached this reads konekt.brand_placements, where a logo
 * cannot go live without a named person recording that its use was cleared.
 */
export interface Placement {
  name: string;
  category: string;
  logoSvg?: string | null;
  /** Path inside the public partner-logos bucket, for an uploaded file. */
  logoPath?: string | null;
  websiteUrl?: string | null;
}

export function PartnerStrip({
  t,
  placements,
}: {
  t: Dictionary;
  placements: Placement[];
}) {
  if (placements.length === 0) return null;

  return (
    <section className={styles.strip} aria-labelledby="partners-title">
      <div className="shell">
        <div className={styles.head}>
          <h2 id="partners-title" className={styles.title}>
            {t.partners.title}
          </h2>
          <p className={styles.note}>
            <span className="tri tri--live" aria-hidden="true" />
            {t.partners.pending}
          </p>
        </div>

        <ul className={styles.row}>
          {placements.map((p) => (
            <li key={p.name} className={styles.plate}>
              {p.logoPath ? (
                /* An uploaded file: the partner's own artwork, cleared by a
                   named person before it could be published. Plain <img> at a
                   fixed height — next/image would add a wrapper and an
                   optimiser round trip for a 20KB logo that is already the
                   right size.
                   eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={partnerLogoUrl(p.logoPath)}
                  alt={p.name}
                  className={styles.plateLogo}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <>
                  <span className={styles.plateName}>{p.name}</span>
                  <span className={styles.plateCategory}>{p.category}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
