import type { Dictionary } from './types';

/**
 * Kiswahili copy. Written as copy, not run through a translator.
 * Swahili leads in the hero because that is where it lands hardest, and
 * because the logo's own tagline already code-switches.
 *
 * Sign-off owner for Swahili wording is still open — see docs/OPEN-ITEMS.md.
 * Nothing here is a placeholder, but it is not yet client-approved.
 */
const sw: Dictionary = {
  meta: {
    title: 'Konekt — mfumo wa ndani wa Benki ya CRDB',
    description:
      'Konekt ni mfumo wa ndani wa Benki ya CRDB wa kufuatilia na kuchambua takwimu. Ruhusa ya kuingia hutolewa na makao makuu.',
    ogAlt: 'Alama ya Konekt kwa rangi ya kijani-bahari, njano na waridi.',
  },

  nav: {
    skipToContent: 'Rukia hadi maudhui',
    brandHome: 'CRDB Konekt — mwanzo',
    events: 'Matukio',
    map: 'Ramani',
    membership: 'Uanachama',
    opportunities: 'Fursa',
    blog: 'Habari',
    signIn: 'Ingia',
    primaryLabel: 'Kuu',
    tabbarLabel: 'Sehemu',
    tabHome: 'Mwanzo',
    tabMe: 'Wangu',
    languageLabel: 'Lugha',
    switchTo: 'Read in English',
  },

  hero: {
    eyebrow: 'Kifuatiliaji cha ndani · Na CRDB',
    headline: 'Kila kituo CRDB inachofuatilia, mahali pamoja.',
    subline:
      'Konekt ni kifaa cha ndani cha CRDB cha kufuatilia na kuchambua takwimu. Idadi ya watu, akaunti, amana na mikopo \u2014 kwa kila kituo, kutoka tawi hadi kanda hadi makao makuu.',
    ctaPrimary: 'Ingia',
    ctaSecondary: 'Ona ramani',
    statZones: 'kanda',
    statBranches: 'matawi ya CRDB',
    statStations: 'vituo vinavyofuatiliwa',
    scrollHint: 'Teremka',
  },
  how: {
    eyebrow: 'Inavyofanya kazi',
    title: 'Hatua tatu, mara moja kwa mwezi.',
    lead:
      'Konekt inachukua nafasi ya majedwali yaliyokuwa yakisafiri kati ya tawi na makao makuu kwa barua pepe. Kila mtu anaingiza mahali pamoja, na walio juu yao wanaona mara moja.',
    step1Title: 'Tawi linaongeza vituo vyake',
    step1Body:
      'Kila taasisi, sehemu ya kazi au kikundi ambacho tawi linafanya nacho kazi, chini ya kundi lake. Huongezwa mara moja; hurekebishwa wakati wowote.',
    step2Title: 'Linaingiza takwimu',
    step2Body:
      'Idadi ya watu, akaunti zilizofunguliwa, hai na zilizolala, amana na mikopo — kila siku, kila wiki au kila mwezi. Kuingiza kipindi kile kile tena kunarekebisha, hakuongezi rekodi ya pili.',
    step3Title: 'Kanda na makao makuu wanaona papo hapo',
    step3Body:
      'Tawi linaona lake, kanda inaona matawi yote chini yake, makao makuu yanaona nchi nzima. Takwimu zile zile, wakati ule ule.',
  },

  map: {
    eyebrow: 'Ramani',
    title: 'Kanda nane. Mtandao mmoja.',
    lead: 'Kila kituo ambacho Konekt inafuatilia, kimewekwa alama kwenye mkoa ambao daftari la CRDB linakiweka. Takwimu zake zipo ndani ya mfumo.',
    zoneColumn: 'Kanda',
    stationsColumn: 'Vituo',
    regionsColumn: 'Mikoa',
    stationsUnit: { one: 'kituo', other: 'vituo' },
    regionsUnit: { one: 'mkoa', other: 'mikoa' },
    totalBranches: 'matawi ya CRDB nchini',
    totalStations: 'vituo vinavyofuatiliwa',
    totalCategories: 'makundi',
    totalZones: 'kanda',
    sourceNote:
      'Idadi hizi zinatoka moja kwa moja katika daftari za CRDB, Agosti 2026.',
    pendingNote:
      'Vituo vimepangwa kwa kanda ambazo CRDB imeviwekea. Daftari halina viwianishi, hivyo kila kimoja kimewekwa alama katikati ya mkoa wake hadi afisa wa tawi athibitishe mahali.',
    ctaMap: 'Ramani hai itafunguliwa katika toleo lijalo',
  },

  footer: {
    tagline: "let's KONEKT",
    attribution:
      'Konekt ni mfumo wa ndani wa kufuatilia na kuchambua takwimu wa CRDB Bank Plc, Tanzania. Ruhusa ya kuingia hutolewa na makao makuu.',
    regulator:
      'CRDB Bank Plc imepewa leseni na inasimamiwa na Benki Kuu ya Tanzania.',
    navLabel: 'Chini ya ukurasa',
    columnsExplore: 'Tembelea',
    columnsLegal: 'Kisheria',
    columnsConnect: 'Wasiliana',
    privacy: 'Sera ya faragha',
    terms: 'Masharti ya matumizi',
    accessibility: 'Ufikivu',
    contact: 'Wasiliana nasi',
    findBranch: 'Tafuta tawi',
    builtBy: 'Imejengwa na Bermi Techs Limited, Dar es Salaam.',
    rights: 'Haki zote zimehifadhiwa.',
  },

  install: {
    prompt: 'Weka Konekt kwenye skrini yako',
    body: 'Inafanya kazi bila mtandao. Tiketi zako zinabaki nawe hata mtandao ukikatika.',
    accept: 'Weka kwenye skrini',
    dismiss: 'Si sasa',
  },

  partners: {
    title: 'Mtandao wa washirika wa Konekt',
    pending: 'Ya dalili — inasubiri idhini ya Masoko na Sheria',
  },

  common: {
    seeAll: 'Ona vyote',
    back: 'Rudi',
    comingSoon: 'Itafunguliwa katika toleo lijalo',
    notConnected: 'Taarifa za moja kwa moja bado hazijaunganishwa',
    notConnectedBody:
      'Ukurasa huu unatumia daftari la CRDB lililohifadhiwa badala ya hifadhidata hai. Kila unachoona ni taarifa halisi kutoka katika daftari — ila bado hazijasasishwa moja kwa moja.',
    readMore: 'Soma',
    minuteRead: 'dakika za kusoma',
    sample: 'Mfano',
    free: 'Bure',
  },

  pages: {
    map: {
      title: 'Kanda nane. Matawi 252. Mtandao mmoja.',
      lead: 'Kila kituo ambacho Konekt inafuatilia, kwenye ramani moja, pamoja na mkoa kilipo na nini kingine kinafuatiliwa hapo.',
      legend: 'Rangi inaonyesha idadi ya vituo ambavyo daftari linaviweka katika kila kanda',
      densityNote:
        'Kila mpaka hapa ni halisi: taarifa za kiutawala za Natural Earth 1:10m, mikoa yote 30, iliyopangwa katika kanda nane za CRDB.',
      pinNote:
        'Bado hakuna alama za maeneo, na hilo ni la makusudi. Hakuna rekodi hata moja katika daftari la CRDB yenye viwianishi. Hatua ya kutafuta viwianishi inafuata, na hakuna alama itakayofika kwenye ramani hii kabla afisa wa tawi hajaithibitisha.',
      tableCaption: 'Vituo na mikoa kwa kila kanda, kutoka daftari la CRDB',
      colZone: 'Kanda',
      colStations: 'Vituo',
      colRegions: 'Mikoa',
      colRegionNames: 'Inayohusisha',
      liveCaption: 'Vituo vilivyo kwenye ramani sasa, kwa mkoa',
      colRegion: 'Mkoa',
      colWhich: 'Vituo vipi',
    },
  },
};

export default sw;
