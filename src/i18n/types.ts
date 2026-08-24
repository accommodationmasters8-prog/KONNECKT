export type TierKey = 'silver' | 'gold' | 'platinum';

/**
 * Swahili and English both inflect these nouns, and both do it irregularly:
 * campus/campuses, chuo/vyuo, mkoa/mikoa. Rendering "1 regions" or "vyuo 1"
 * in front of CRDB is not a rounding error, it is a translation that was
 * never read. Every counted noun carries both forms.
 */
export interface PluralUnit {
  one: string;
  other: string;
}

export interface TierCopy {
  name: string;
  blurb: string;
  points: string[];
}

export interface Dictionary {
  meta: {
    title: string;
    description: string;
    ogAlt: string;
  };
  nav: {
    skipToContent: string;
    brandHome: string;
    events: string;
    map: string;
    membership: string;
    opportunities: string;
    primaryLabel: string;
    languageLabel: string;
    switchTo: string;
  };
  hero: {
    eyebrow: string;
    headlineLead: string;
    headlineMark: string;
    headlineTail: string;
    subline: string;
    ctaPrimary: string;
    ctaSecondary: string;
    markAlt: string;
    statZones: string;
    statBranches: string;
    statCampuses: string;
    scrollHint: string;
  };
  events: {
    eyebrow: string;
    title: string;
    lead: string;
    liveBadge: string;
    soonBadge: string;
    seedNotice: string;
    ctaAll: string;
    dateLabel: string;
    placeLabel: string;
  };
  map: {
    eyebrow: string;
    title: string;
    lead: string;
    zoneColumn: string;
    institutionsColumn: string;
    regionsColumn: string;
    institutionsUnit: PluralUnit;
    regionsUnit: PluralUnit;
    totalBranches: string;
    totalInstitutions: string;
    totalBarracks: string;
    totalZones: string;
    sourceNote: string;
    pendingNote: string;
    ctaMap: string;
  };
  membership: {
    eyebrow: string;
    title: string;
    lead: string;
    ageNote: string;
    tiers: Record<TierKey, TierCopy>;
    stepDownTitle: string;
    stepDownBody: string;
    benefitsNote: string;
    ctaMembership: string;
  };
  opportunities: {
    eyebrow: string;
    title: string;
    lead: string;
    emptyTitle: string;
    emptyBody: string;
    emptyCta: string;
    filtersLabel: string;
    filterAge: string;
    filterRegion: string;
    filterField: string;
    filterEducation: string;
  };
  footer: {
    tagline: string;
    attribution: string;
    regulator: string;
    navLabel: string;
    columnsExplore: string;
    columnsLegal: string;
    columnsConnect: string;
    privacy: string;
    terms: string;
    accessibility: string;
    contact: string;
    findBranch: string;
    builtBy: string;
    rights: string;
  };
  install: {
    prompt: string;
    body: string;
    accept: string;
    dismiss: string;
  };
}
