import type { Metadata } from 'next';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { SiteFooter } from '@/components/SiteFooter';
import { TanzaniaMap } from '@/components/map/TanzaniaMap';
import { zoneFigures } from '@/lib/zone-data';
import { regionCentre } from '@/lib/tanzania-map';
import { getPublicMapData, getStaffMapRegions, money } from '@/lib/tracker';
import { getStaffSession } from '@/lib/staff-session';
import { resolveLocale } from '@/lib/page';
import { getDictionary, isLocale } from '@/i18n';
import styles from './map.module.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return { title: `${t.pages.map.title} — CRDB Konekt`, description: t.pages.map.lead };
}

/**
 * The coverage map.
 *
 * One page at two depths. Anyone may open it and see where CRDB reaches —
 * regions, districts, zones, counts. That is a fact about CRDB and costs
 * nothing to publish, which is what makes it useful to a staff member on a
 * phone with no password.
 *
 * Signing in adds the three things the public tier deliberately withholds:
 * what kind of place each station is, how much has been opened there, and how
 * many have actually filed. Two separate pages would have guaranteed that one
 * eventually disagreed with the other about the national total; one page with
 * two depths cannot.
 *
 * What is never here at either depth is a station's own name. A named list of
 * the places CRDB is working is its plan for the segment, and the view this
 * reads from does not carry the column.
 *
 * The selected region lives in the URL rather than in component state, so a
 * zone manager can send "look at Mwanza" to HQ and HQ opens the same screen.
 */
export default async function MapPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ region?: string; zone?: string }>;
}) {
  const { locale, t } = await resolveLocale(params);
  const { region: regionParam, zone: zoneParam } = await searchParams;
  const nf = new Intl.NumberFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ');

  const session = await getStaffSession();

  // The public tier always loads: it is what the page is. The deeper tier is
  // fetched only for somebody who has signed in, and comes back scoped by row
  // level security rather than by anything decided here.
  const [pub, staffRegions] = await Promise.all([
    getPublicMapData(),
    session.signedIn ? getStaffMapRegions() : Promise.resolve([]),
  ]);

  const staffByRegion = new Map(staffRegions.map((r) => [r.region, r]));

  const zoneWord = (code: string) =>
    code === 'UNASSIGNED'
      ? 'No zone recorded'
      : code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  // Filtering narrows what is listed and shaded. It never narrows what may be
  // read — the public tier is public and the staff tier was already scoped.
  const zone = zoneParam && pub.zones.some((z) => z.zone === zoneParam) ? zoneParam : null;
  const shown = zone ? pub.regions.filter((r) => r.zone === zone) : pub.regions;

  const selected = regionParam && shown.some((r) => r.region === regionParam)
    ? shown.find((r) => r.region === regionParam)!
    : null;

  const href = (next: { region?: string | null; zone?: string | null }) => {
    const q = new URLSearchParams();
    const z = next.zone === undefined ? zone : next.zone;
    const r = next.region === undefined ? selected?.region ?? null : next.region;
    if (z) q.set('zone', z);
    if (r) q.set('region', r);
    const s = q.toString();
    return `/${locale}/map${s ? `?${s}` : ''}`;
  };

  const covered = new Set(shown.filter((r) => r.onMap).map((r) => r.region));
  const shownStations = shown.reduce((a, r) => a + r.stations, 0);
  const shownDistricts = new Set(shown.flatMap((r) => r.districts)).size;

  const pins = shown
    .map((row) => {
      const centre = row.onMap ? regionCentre(row.region) : null;
      if (!centre) return null;
      return {
        id: row.region,
        x: centre.x,
        y: centre.y,
        label: row.region,
        count: row.stations,
        href: href({ region: selected?.region === row.region ? null : row.region }),
        selected: selected?.region === row.region,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const detail = selected ? staffByRegion.get(selected.region) ?? null : null;

  // Shade by what is actually recorded, not by the committed register.
  //
  // The two used to disagree on the same screen: the shading came from a file
  // and the pins from the database, so a zone could be dark with no pin in it.
  // The register is kept only as the fallback for a render with no database
  // attached, where every zone at zero would flatten the map to one colour and
  // read as a measurement rather than as an absent connection.
  const liveByZone = new Map(pub.zones.map((z) => [z.zone, z.stations]));
  const shading = zoneFigures.map((z) => ({
    zone: z.key,
    label: z.label,
    campuses: pub.stations > 0 ? (liveByZone.get(z.key) ?? 0) : z.campuses,
    regions: z.regions.length,
  }));

  const summary = [
    { value: nf.format(shownStations), label: t.map.totalStations },
    { value: nf.format(covered.size), label: 'regions reached' },
    { value: nf.format(shownDistricts), label: 'districts reached' },
    {
      value: zone ? '1' : nf.format(pub.zones.length),
      label: zone ? 'zone in view' : t.map.totalZones,
    },
  ];

  return (
    <AppShell locale={locale} t={t} active="map">
      <div className={`on-ink ${styles.hero}`}>
        <div className="shell">
          <div className="page-head">
            <p className="t-eyebrow" style={{ color: 'var(--konekt-pink)' }}>
              <span className="tri tri--place" aria-hidden="true" />
              {t.map.eyebrow}
            </p>
            <h1 className="t-h1" style={{ color: 'var(--text-on-inverse)' }}>
              {t.pages.map.title}
            </h1>
            <p className="t-lead" style={{ color: 'var(--text-muted-on-inverse)' }}>
              {t.pages.map.lead}
            </p>
          </div>

          {/* Zone filter. Links rather than a select, so the choice is in the
              URL and the page works with JavaScript off. */}
          <nav className={styles.filters} aria-label="Filter by zone">
            <Link
              href={href({ zone: null, region: null })}
              className={zone ? styles.chip : styles.chipOn}
              aria-current={zone ? undefined : 'true'}
            >
              Whole country
            </Link>
            {pub.zones.map((z) => (
              <Link
                key={z.zone}
                href={href({ zone: z.zone, region: null })}
                className={zone === z.zone ? styles.chipOn : styles.chip}
                aria-current={zone === z.zone ? 'true' : undefined}
              >
                {zoneWord(z.zone)}
                <span className={styles.chipCount}>{nf.format(z.stations)}</span>
              </Link>
            ))}
          </nav>

          <TanzaniaMap
            data={shading}
            title={t.pages.map.densityNote}
            pins={pins}
            selectedRegion={selected?.region ?? null}
            regionHref={(name) =>
              covered.has(name)
                ? href({ region: selected?.region === name ? null : name })
                : null
            }
            className={styles.map}
          />

          <p className={styles.legend}>
            {covered.size > 0
              ? 'Click a pin or a shaded region to open it. Regions with no station are not clickable.'
              : t.pages.map.legend}
          </p>

          <dl className={styles.totals}>
            {summary.map((item) => (
              <div key={item.label} className={styles.total}>
                <dd className={`t-data ${styles.totalValue}`}>{item.value}</dd>
                <dt className={styles.totalLabel}>{item.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className={`section ${styles.detail}`}>
        <div className="shell">
          {/* The region panel. It is the reason the map is clickable at all —
              a shaded shape you cannot open is a picture. */}
          {selected ? (
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <div>
                  <p className={styles.panelEyebrow}>Region</p>
                  <h2 className="t-h3">{selected.region}</h2>
                  <p className={styles.panelSub}>
                    {nf.format(selected.stations)} stations ·{' '}
                    {selected.districts.length > 0
                      ? selected.districts.join(', ')
                      : 'districts not recorded'}
                    {selected.zone ? ` · ${zoneWord(selected.zone)} zone` : ''}
                  </p>
                </div>
                <Link href={href({ region: null })} className={styles.panelClose}>
                  Close ×
                </Link>
              </div>

              {detail ? (
                <>
                  <dl className={styles.panelStats}>
                    <div className={styles.panelStat}>
                      <dd className="t-data">{nf.format(detail.accountsOpened)}</dd>
                      <dt>accounts opened</dt>
                    </div>
                    <div className={styles.panelStat}>
                      <dd className="t-data">{money(detail.deposits, locale, true)}</dd>
                      <dt>deposits mobilised</dt>
                    </div>
                    <div className={styles.panelStat}>
                      <dd className="t-data">
                        {nf.format(detail.reporting)}/{nf.format(detail.stations)}
                      </dd>
                      <dt>have filed</dt>
                    </div>
                  </dl>

                  <p className={styles.panelSub}>
                    {detail.categories
                      .map((c) => `${c.name} (${nf.format(c.stations)})`)
                      .join(' · ')}
                  </p>

                  <Link href={`/${locale}/staff/network`} className="btn btn--primary btn--sm">
                    Open this in the tracker
                  </Link>
                </>
              ) : (
                <p className={styles.panelSub}>
                  {session.signedIn
                    ? 'Nothing has been filed against this region yet.'
                    : 'Sign in to see what each station here is, what has been opened and how much has been filed. This page shows where CRDB reaches; the figures live in the tracker.'}
                </p>
              )}

              {!session.signedIn ? (
                <Link href={`/${locale}/staff/sign-in`} className="btn btn--primary btn--sm">
                  Sign in to the tracker
                </Link>
              ) : null}
            </div>
          ) : null}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className={styles.caption}>
                {zone ? `${zoneWord(zone)} zone, by region` : t.pages.map.liveCaption}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{t.pages.map.colRegion}</th>
                  <th scope="col" className={styles.num}>{t.pages.map.colStations}</th>
                  <th scope="col">Districts</th>
                  {session.signedIn ? (
                    <th scope="col" className={styles.num}>Filed</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => {
                  const d = staffByRegion.get(row.region);
                  return (
                    <tr key={row.region}>
                      <th scope="row">
                        <Link href={href({ region: row.region })} className={styles.rowLink}>
                          {row.region}
                        </Link>
                        <span className={styles.rowHint}>
                          {row.sources.length > 0
                            ? `${row.sources.join(', ')} · click to open`
                            : 'click to open'}
                        </span>
                      </th>
                      <td className={styles.num}>{nf.format(row.stations)}</td>
                      <td className={styles.regionList}>
                        {row.districts.length > 0 ? row.districts.join(', ') : '—'}
                      </td>
                      {session.signedIn ? (
                        <td className={styles.num}>
                          {d ? `${nf.format(d.reporting)}/${nf.format(d.stations)}` : '—'}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {shown.length === 0 ? (
            <p className={`t-caption ${styles.note}`}>
              No stations are recorded in this zone yet.
            </p>
          ) : null}

          {/* The one call to action on a public page. Everything above is
              geography; the numbers behind it are one sign-in away, and a
              staff member arriving here from a phone should not have to guess
              where that is. */}
          <div className={styles.cta}>
            <p className="t-h3">
              {session.signedIn
                ? 'The figures behind this map are in the tracker.'
                : 'Staff sign in for the figures behind this map.'}
            </p>
            <p className={styles.panelSub}>
              This page shows where CRDB reaches. What each station has opened,
              activated and lent is recorded in Konekt, branch by branch, and
              rolled up to the zone and to HQ.
            </p>
            <Link
              href={session.signedIn ? `/${locale}/staff` : `/${locale}/staff/sign-in`}
              className="btn btn--primary"
            >
              {session.signedIn ? 'Open the tracker' : 'Sign in'}
            </Link>
          </div>

          <div className={styles.notes}>
            <p className={`t-caption ${styles.note}`}>{t.pages.map.densityNote}</p>
            <p className={`t-caption ${styles.note}`}>
              Stations are pinned to the centre of the region recorded for them.
              No individual station is named on this page.
            </p>
            <p className={`t-caption ${styles.note}`}>{t.map.sourceNote}</p>
          </div>
        </div>
      </div>

      <SiteFooter locale={locale} t={t} />
    </AppShell>
  );
}
