import type { Metadata } from 'next';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { SiteFooter } from '@/components/SiteFooter';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { getServerClient } from '@/lib/supabase/server';
import type { PostRow } from '@/lib/supabase/types';
import { localeParams, resolveLocale } from '@/lib/page';
import { getDictionary, isLocale } from '@/i18n';
import styles from './blog.module.css';

export function generateStaticParams() {
  return localeParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return { title: `${t.pages.blog.title} — CRDB Konekt`, description: t.pages.blog.lead };
}

/**
 * Stories.
 *
 * The database refuses to publish a post with either language empty, so a
 * post that appears here appears in both. Nothing is written to fill the page;
 * until the editorial team publishes, this is an empty state that says so.
 */
export default async function BlogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale, t } = await resolveLocale(params);
  const supabase = await getServerClient();

  let posts: PostRow[] = [];
  if (supabase) {
    const { data } = await supabase
      .from('posts')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(24);
    posts = (data as PostRow[] | null) ?? [];
  }

  const featured = posts.find((p) => p.is_featured) ?? posts[0];
  const rest = posts.filter((p) => p.id !== featured?.id);

  const df = new Intl.DateTimeFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const title = (p: PostRow) => (locale === 'sw' ? p.title_sw : p.title_en);
  const excerpt = (p: PostRow) => (locale === 'sw' ? p.excerpt_sw : p.excerpt_en);

  return (
    <AppShell locale={locale} t={t} active="blog">
      <PageHeader
        eyebrow={t.nav.blog}
        accent="yellow"
        title={t.pages.blog.title}
        lead={t.pages.blog.lead}
      />

      <div className={`section ${styles.body}`}>
        <div className="shell">
          {posts.length === 0 ? (
            <EmptyState title={t.pages.blog.empty} body={t.pages.blog.emptyBody} />
          ) : (
            <>
              {featured ? (
                <Link
                  href={`/${locale}/blog/${featured.slug}`}
                  prefetch={false}
                  className={`card card-link ${styles.featured}`}
                >
                  <span className={styles.featuredTag}>{t.pages.blog.featured}</span>
                  <h2 className={`t-h2 ${styles.featuredTitle}`}>{title(featured)}</h2>
                  <p className={styles.featuredExcerpt}>{excerpt(featured)}</p>
                  <p className={styles.meta}>
                    {featured.published_at ? df.format(new Date(featured.published_at)) : null}
                    {featured.reading_minutes
                      ? ` · ${featured.reading_minutes} ${t.common.minuteRead}`
                      : null}
                  </p>
                </Link>
              ) : null}

              {rest.length ? (
                <>
                  <h2 className={`t-eyebrow ${styles.sectionLabel}`}>{t.pages.blog.latest}</h2>
                  <ul className={styles.grid}>
                    {rest.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/${locale}/blog/${p.slug}`}
                          prefetch={false}
                          className={`card card-link ${styles.item}`}
                        >
                          <h3 className={`t-h3 ${styles.itemTitle}`}>{title(p)}</h3>
                          <p className={styles.itemExcerpt}>{excerpt(p)}</p>
                          <p className={styles.meta}>
                            {p.published_at ? df.format(new Date(p.published_at)) : null}
                            {p.reading_minutes
                              ? ` · ${p.reading_minutes} ${t.common.minuteRead}`
                              : null}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      <SiteFooter locale={locale} t={t} />
    </AppShell>
  );
}
