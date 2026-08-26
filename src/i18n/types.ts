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
    statCampuses: string;
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
    events: { title: string; lead: string; empty: string; emptyBody: string };
    map: {
      title: string;
      lead: string;
      legend: string;
      densityNote: string;
      pinNote: string;
      tableCaption: string;
      colZone: string;
      colCampuses: string;
      colRegions: string;
      colRegionNames: string;
    };
    membership: { title: string; lead: string };
    opportunities: { title: string; lead: string };
    blog: {
      title: string;
      lead: string;
      empty: string;
      emptyBody: string;
      featured: string;
      latest: string;
    };
    me: {
      title: string;
      lead: string;
      signedOut: string;
      signedOutBody: string;
      signIn: string;
      tier: string;
      noTier: string;
      noTierBody: string;
      myEvents: string;
      myTickets: string;
      myReferrals: string;
      referralCode: string;
      consentCentre: string;
      consentBody: string;
      profile: string;
    };
  };
}
