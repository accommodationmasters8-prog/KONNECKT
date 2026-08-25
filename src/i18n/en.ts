import type { Dictionary } from './types';

/**
 * English copy. Written alongside the Swahili, not translated from it.
 * Plain verbs, sentence case, no corporate filler. A button says what
 * happens — and its confirmation uses the same word.
 */
const en: Dictionary = {
  meta: {
    title: 'CRDB Konekt — the youth community of CRDB Bank',
    description:
      'Events, opportunities and a bank account that grows with you. CRDB Konekt is where young Tanzanians connect, show up and get ahead.',
    ogAlt: 'The CRDB Konekt chevron mark in teal, yellow and pink.',
  },

  nav: {
    skipToContent: 'Skip to content',
    brandHome: 'CRDB Konekt — home',
    events: 'Events',
    map: 'The map',
    membership: 'Membership',
    opportunities: 'Opportunities',
    blog: 'Stories',
    signIn: 'Sign in',
    primaryLabel: 'Main',
    tabbarLabel: 'Sections',
    tabHome: 'Home',
    tabMe: 'Me',
    languageLabel: 'Language',
    switchTo: 'Soma kwa Kiswahili',
  },

  hero: {
    eyebrow: 'Na CRDB',
    headline: 'Konekt reaches every zone in Tanzania.',
    subline:
      'Campuses, workplaces and groups across the country, branch by branch. Sign in to work with your figures.',
    ctaPrimary: 'Sign in',
    ctaSecondary: 'See the map',
    statZones: 'zones',
    statBranches: 'CRDB branches',
    statCampuses: 'campuses mapped',
    scrollHint: 'Scroll',
  },

  events: {
    eyebrow: 'Live now / next up',
    title: 'What is happening near you',
    lead: 'Campus tours, money clinics, sports days and career fairs. Every event is free to attend and takes minutes to register for.',
    liveBadge: 'Live now',
    soonBadge: 'Coming up',
    seedNotice:
      'Sample programme. Real dates open for registration when the events calendar goes live.',
    ctaAll: 'See the full calendar',
    dateLabel: 'Date',
    placeLabel: 'Place',
  },

  map: {
    eyebrow: 'The map',
    title: 'Eight zones. One network.',
    lead: 'CRDB has been in these towns for forty years. Konekt puts every branch, campus and barracks on one map so you can find the nearest one and see what is on there.',
    zoneColumn: 'Zone',
    institutionsColumn: 'Campuses',
    regionsColumn: 'Regions',
    institutionsUnit: { one: 'campus', other: 'campuses' },
    regionsUnit: { one: 'region', other: 'regions' },
    totalBranches: 'CRDB branches nationally',
    totalInstitutions: 'universities and colleges',
    totalBarracks: 'JKT barracks',
    totalZones: 'zones',
    sourceNote:
      'Counts come straight from CRDB’s own branch, TCU and JKT registers, August 2026.',
    pendingNote:
      'Campuses are grouped by the zone CRDB assigned them. Branches and barracks carry no zone or coordinates in the register yet — those arrive with the geocoding pass, and no pin goes on the live map until a branch officer has confirmed it.',
    ctaMap: 'The live map opens in the next release',
  },

  membership: {
    eyebrow: 'Membership',
    title: 'Silver, Gold, Platinum',
    lead: 'Membership is free and starts the moment you open a CRDB youth account. Where you sit is earned — by saving, by borrowing well, and by turning up to Konekt events.',
    ageNote: 'Open to account holders aged 18 to 35.',
    tiers: {
      silver: {
        name: 'Silver',
        blurb: 'Where everyone starts. Open an account and you are in.',
        points: [
          'Every Konekt event, free entry',
          'The opportunities board',
          'Money tools and savings goals',
        ],
      },
      gold: {
        name: 'Gold',
        blurb:
          'For members who save steadily and show up. Reviewed every quarter.',
        points: [
          'Everything in Silver',
          'At least one Konekt event a quarter',
          'Priority seats at capped events',
          'Partner offers on transport, data and campus services',
        ],
      },
      platinum: {
        name: 'Platinum',
        blurb:
          'The top tier. Reviewed twice a year, on savings, credit standing and community.',
        points: [
          'Everything in Gold',
          'Two Konekt events a year, plus two referrals who complete onboarding',
          'Invitations to closed sessions and mentoring',
          'The widest partner benefits',
        ],
      },
    },
    stepDownTitle: 'If you fall below',
    stepDownBody:
      'You step down one tier, never out, and you keep your benefits for three months while you build back.',
    benefitsNote:
      'Partner benefits are indicative and pending Marketing and Legal sign-off.',
    ctaMembership: 'Read the full criteria',
  },

  opportunities: {
    eyebrow: 'Opportunities',
    title: 'Jobs, internships, scholarships, grants',
    lead: 'One board, filtered to what you are actually eligible for — by age, by region, by what you studied.',
    emptyTitle: 'Nothing is listed yet',
    emptyBody:
      'The board opens when the first verified listings are in. Nothing gets published here until someone at CRDB has checked it, so it will be empty rather than padded.',
    emptyCta: 'Tell me when it opens',
    filtersLabel: 'The board will filter on (not active yet)',
    filterAge: 'Age',
    filterRegion: 'Region',
    filterField: 'Field of study',
    filterEducation: 'Education level',
  },

  footer: {
    tagline: "let's KONEKT",
    attribution:
      'CRDB Konekt is the youth banking community of CRDB Bank Plc, Tanzania.',
    regulator: 'CRDB Bank Plc is licensed and regulated by the Bank of Tanzania.',
    navLabel: 'Footer',
    columnsExplore: 'Explore',
    columnsLegal: 'Legal',
    columnsConnect: 'Connect',
    privacy: 'Privacy policy',
    terms: 'Terms of use',
    accessibility: 'Accessibility',
    contact: 'Contact us',
    findBranch: 'Find a branch',
    builtBy: 'Built by Bermi Techs Limited, Dar es Salaam.',
    rights: 'All rights reserved.',
  },

  install: {
    prompt: 'Add Konekt to your home screen',
    body: 'Works offline. Your tickets stay with you when the network does not.',
    accept: 'Add to home screen',
    dismiss: 'Not now',
  },

  partners: {
    title: 'The Konekt partner network',
    pending: 'Indicative — pending Marketing and Legal sign-off',
  },

  common: {
    seeAll: 'See all',
    back: 'Back',
    comingSoon: 'Opens in the next release',
    notConnected: 'Live data is not connected yet',
    notConnectedBody:
      'This page is running on the committed CRDB register rather than the live database. Everything you see is real data from the register — it just is not updating yet.',
    readMore: 'Read',
    minuteRead: 'min read',
    sample: 'Sample',
    free: 'Free',
  },

  pages: {
    events: {
      title: 'Everything happening near you',
      lead: 'Campus tours, money clinics, sports days and career fairs. Free to attend, minutes to register for.',
      empty: 'The calendar is not open yet',
      emptyBody:
        'Events appear here the moment coordinators start publishing them. Nothing is listed before it is real and registrable.',
    },
    map: {
      title: 'Eight zones. 252 branches. One network.',
      lead: 'CRDB has been in these towns for forty years. Konekt puts every branch, campus and barracks on one map so you can find the nearest one and see what is on there.',
      legend: 'Shading shows how many campuses the register places in each zone',
      densityNote:
        'Every boundary here is real: Natural Earth 1:10m administrative data, all 30 regions, grouped into CRDB’s eight zones.',
      pinNote:
        'There are no pins yet, and that is deliberate. Not one record in the CRDB register carries a coordinate. Geocoding runs next, and no pin reaches this map until a branch officer has confirmed it.',
      tableCaption: 'Campuses and regions by zone, from the CRDB register',
      colZone: 'Zone',
      colCampuses: 'Campuses',
      colRegions: 'Regions',
      colRegionNames: 'Covering',
    },
    membership: {
      title: 'Silver, Gold, Platinum',
      lead: 'Membership is free and starts the moment you open a CRDB youth account. Where you sit is earned — by saving, by borrowing well, and by turning up.',
    },
    opportunities: {
      title: 'Jobs, internships, scholarships, grants',
      lead: 'One board, filtered to what you are actually eligible for — by age, by region, by what you studied.',
    },
    blog: {
      title: 'Stories',
      lead: 'Money, campus life, and what other Konekt members are building. Written by the community and by CRDB.',
      empty: 'No stories published yet',
      emptyBody:
        'The first posts go up when the editorial team starts publishing. Nothing is padded out to fill the page.',
      featured: 'Featured',
      latest: 'Latest',
    },
    me: {
      title: 'Your Konekt',
      lead: 'Your tier, your tickets, your referrals.',
      signedOut: 'Sign in with your phone',
      signedOutBody:
        'One code by SMS and you are in. No password to forget, and nothing to fill in that CRDB does not already have.',
      signIn: 'Send me a code',
      tier: 'Your tier',
      noTier: 'No tier yet',
      noTierBody:
        'Your tier is calculated by CRDB from your account activity and appears here once your first review runs.',
      myEvents: 'My events',
      myTickets: 'My tickets',
      myReferrals: 'My referrals',
      referralCode: 'Your referral code',
      consentCentre: 'Consent centre',
      consentBody:
        'Choose exactly what we may send you, on which channel. Changes take effect immediately.',
      profile: 'Profile',
    },
  },
};

export default en;
