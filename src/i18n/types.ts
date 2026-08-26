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
    blog: string;
    signIn: string;
    primaryLabel: string;
    tabbarLabel: string;
    tabHome: string;
    tabMe: string;
    languageLabel: string;
    switchTo: string;
  };
  hero: {
    eyebrow: string;
    headline: string;
    subline: string;
    ctaPrimary: string;
    ctaSecondary: string;
    statZones: string;
    statBranches: string;
    statStations: string;
    scrollHint: string;
  };
  how: {
    eyebrow: string;
    title: string;
    lead: string;
    step1Title: string;
    step1Body: string;
    step2Title: string;
    step2Body: string;
    step3Title: string;
    step3Body: string;
  };
  map: {
    eyebrow: string;
    title: string;
    lead: string;
    zoneColumn: string;
    stationsColumn: string;
    regionsColumn: string;
    stationsUnit: PluralUnit;
    regionsUnit: PluralUnit;
    totalBranches: string;
    totalStations: string;
    totalCategories: string;
    totalZones: string;
    sourceNote: string;
    pendingNote: string;
    ctaMap: string;
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
  partners: {
    title: string;
    pending: string;
  };
  common: {
    seeAll: string;
    back: string;
    comingSoon: string;
    notConnected: string;
    notConnectedBody: string;
    readMore: string;
    minuteRead: string;
    sample: string;
    free: string;
  };
  pages: {
    map: {
      title: string;
      lead: string;
      legend: string;
      densityNote: string;
      pinNote: string;
      tableCaption: string;
      colZone: string;
      colStations: string;
      colRegions: string;
      colRegionNames: string;
    liveCaption: string;
    colRegion: string;
    colWhich: string;
    };
  };
}
