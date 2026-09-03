import type { Dictionary, Locale } from '@/i18n';
import styles from './HowItWorks.module.css';

/**
 * What the tool actually does, in three steps.
 *
 * The landing page had a mark, a claim and a way in — which is enough for
 * somebody who already knows what Konekt is and nothing at all for the branch
 * officer being told to start using it on Monday. Three steps in the order
 * they happen, in the words the console itself uses, so the screens are
 * already familiar by the time they sign in.
 *
 * No icons. Three numbered blocks read as a sequence on their own, and an icon
 * per step would be three more shapes competing with the mark above.
 */
export function HowItWorks({ t }: { locale: Locale; t: Dictionary }) {
  const steps = [
    { n: '01', title: t.how.step1Title, body: t.how.step1Body },
    { n: '02', title: t.how.step2Title, body: t.how.step2Body },
    { n: '03', title: t.how.step3Title, body: t.how.step3Body },
  ];

  return (
    <section className={`section ${styles.section}`} aria-labelledby="how-title">
      <div className={`shell ${styles.inner}`}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>{t.how.eyebrow}</p>
          <h2 id="how-title" className={styles.title}>{t.how.title}</h2>
          {t.how.lead ? <p className={styles.lead}>{t.how.lead}</p> : null}
        </div>

        <ol className={styles.steps}>
          {steps.map((step) => (
            <li key={step.n} className={styles.step}>
              <span className={styles.stepNumber} aria-hidden="true">{step.n}</span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepBody}>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
