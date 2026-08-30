import type { Dictionary } from './types';

/**
 * English copy. Written alongside the Swahili, not translated from it.
 * Plain verbs, sentence case, no corporate filler. A button says what
 * happens — and its confirmation uses the same word.
 */
const en: Dictionary = {
  meta: {
    title: 'Konekt — internal tracker for CRDB Bank',
    description:
      'Konekt is CRDB Bank\u2019s internal tracking and analytics tool. Access is issued by HQ.',
    ogAlt: 'The Konekt chevron mark in teal, yellow and pink.',
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
    headline: 'Every youth CRDB reaches, station by station.',
    subline:
      'Accounts, SimBanking, Lipa Hapa, cards and loans. Recorded where they happen. Read by the branch, the zone and HQ at the same time.',
    ctaPrimary: 'Sign in',
    ctaSecondary: 'See the map',
    statZones: 'zones',
    statBranches: 'branches',
    statStations: 'stations',
    scrollHint: 'Scroll',
  },
  how: {
    eyebrow: 'How it works',
    title: 'Three steps.',
    lead:
      'No more spreadsheets by email. Everyone files in one place, and everyone above them sees it as it lands.',
    step1Title: 'A branch adds its stations',
    step1Body:
      'Every school, campus, barracks, stand or salon the branch works with, filed under its category. Added once, corrected any time.',
    step2Title: 'It files the figures',
    step2Body:
      'People in the station, accounts opened, active and dormant, deposits mobilised and loans — daily, weekly or monthly, whichever suits. Filing the same period again corrects it rather than adding a second.',
    step3Title: 'Zone and HQ read it live',
    step3Body:
      'A branch sees its own. A zone sees its branches. HQ sees the country. Same figures, same moment.',
  },

  map: {
    eyebrow: 'The map',
    title: 'Eight zones. One network.',
    lead: 'Every station Konekt tracks, pinned to the region the CRDB register places it in. The figures behind the pins are inside the tracker.',
    zoneColumn: 'Zone',
    stationsColumn: 'Stations',
    regionsColumn: 'Regions',
    stationsUnit: { one: 'station', other: 'stations' },
    regionsUnit: { one: 'region', other: 'regions' },
    totalBranches: 'CRDB branches nationally',
    totalStations: 'stations tracked',
    totalCategories: 'categories',
    totalZones: 'zones',
    sourceNote:
      'Counts come straight from CRDB’s own registers, August 2026.',
    pendingNote:
      'Stations are grouped by the zone CRDB assigned them. The register carries no coordinates, so each is pinned to the centre of its region until a branch officer confirms a location.',
    ctaMap: 'The live map opens in the next release',
  },

  footer: {
    tagline: "let's KONEKT",
    attribution:
      'Konekt is an internal tracking and analytics tool for CRDB Bank Plc, Tanzania. Access is issued by HQ.',
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
    map: {
      title: 'Eight zones. 252 branches. One network.',
      lead: 'Every station Konekt tracks, on one map, with the region it sits in and what else is tracked there.',
      legend: 'Shading shows how many stations the register places in each zone',
      densityNote:
        'Every boundary here is real: Natural Earth 1:10m administrative data, all 30 regions, grouped into CRDB’s eight zones.',
      pinNote:
        'There are no pins yet, and that is deliberate. Not one record in the CRDB register carries a coordinate. Geocoding runs next, and no pin reaches this map until a branch officer has confirmed it.',
      tableCaption: 'Stations and regions by zone, from the CRDB register',
      colZone: 'Zone',
      colStations: 'Stations',
      colRegions: 'Regions',
      colRegionNames: 'Covering',
      liveCaption: 'Stations on the map right now, by region',
      colRegion: 'Region',
      colWhich: 'Which stations',
    },
  },
};

export default en;
