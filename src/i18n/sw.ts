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
    title: 'CRDB Konekt — jumuiya ya vijana ya Benki ya CRDB',
    description:
      'Matukio, fursa na akaunti inayokua pamoja nawe. CRDB Konekt ni mahali vijana wa Tanzania wanapokutana, wanapohudhuria na wanaposonga mbele.',
    ogAlt: 'Alama ya CRDB Konekt kwa rangi ya kijani-bahari, njano na waridi.',
  },

  nav: {
    skipToContent: 'Rukia hadi maudhui',
    brandHome: 'CRDB Konekt — mwanzo',
    events: 'Matukio',
    map: 'Ramani',
    membership: 'Uanachama',
    opportunities: 'Fursa',
    primaryLabel: 'Kuu',
    languageLabel: 'Lugha',
    switchTo: 'Read in English',
  },

  hero: {
    eyebrow: 'Jumuiya ya vijana ya Benki ya CRDB',
    headlineLead: "let's",
    headlineMark: 'KONEKT',
    headlineTail: 'Na CRDB',
    subline:
      'Tafuta kinachoendelea karibu nawe, fika, na ufungue akaunti inayokua pamoja nawe. Kujiunga ni bure, kuanzia miaka 18 hadi 35.',
    ctaPrimary: 'Tafuta matukio karibu nawe',
    ctaSecondary: 'Uanachama unavyofanya kazi',
    markAlt:
      'Alama ya Konekt: mshale wa kijani-bahari, pembetatu ya njano juu na pembetatu ya waridi chini.',
    statZones: 'kanda',
    statBranches: 'matawi ya CRDB',
    statCampuses: 'vyuo vilivyoorodheshwa',
    scrollHint: 'Teremka',
  },

  events: {
    eyebrow: 'Yanaendelea sasa / yajayo',
    title: 'Kinachoendelea karibu nawe',
    lead: 'Ziara za vyuo, kliniki za fedha, michezo na maonyesho ya ajira. Kila tukio ni bure kuhudhuria na kujiandikisha kunachukua dakika chache.',
    liveBadge: 'Yanaendelea',
    soonBadge: 'Yajayo',
    seedNotice:
      'Ratiba ya mfano. Tarehe halisi zitafunguliwa kwa usajili kalenda ya matukio itakapoanza.',
    ctaAll: 'Ona kalenda nzima',
    dateLabel: 'Tarehe',
    placeLabel: 'Mahali',
  },

  map: {
    eyebrow: 'Ramani',
    title: 'Kanda nane. Mtandao mmoja.',
    lead: 'CRDB imekuwa katika miji hii kwa miaka arobaini. Konekt inaweka kila tawi, chuo na kambi kwenye ramani moja ili upate lililo karibu nawe na uone kinachoendelea hapo.',
    zoneColumn: 'Kanda',
    institutionsColumn: 'Vyuo',
    regionsColumn: 'Mikoa',
    institutionsUnit: { one: 'chuo', other: 'vyuo' },
    regionsUnit: { one: 'mkoa', other: 'mikoa' },
    totalBranches: 'matawi ya CRDB nchini',
    totalInstitutions: 'vyuo vikuu na vyuo',
    totalBarracks: 'kambi za JKT',
    totalZones: 'kanda',
    sourceNote:
      'Idadi hizi zinatoka moja kwa moja katika daftari za matawi ya CRDB, TCU na JKT, Agosti 2026.',
    pendingNote:
      'Vyuo vimepangwa kwa kanda ambazo CRDB imeviwekea. Matawi na kambi bado hayana kanda wala viwianishi katika daftari — hivyo vitakuja na hatua ya kutafuta viwianishi, na hakuna alama itakayowekwa kwenye ramani hai kabla afisa wa tawi hajaithibitisha.',
    ctaMap: 'Ramani hai itafunguliwa katika toleo lijalo',
  },

  membership: {
    eyebrow: 'Uanachama',
    title: 'Silver, Gold, Platinum',
    lead: 'Uanachama ni bure na unaanza mara tu unapofungua akaunti ya vijana ya CRDB. Daraja lako unalichuma — kwa kuweka akiba, kwa kukopa vizuri, na kwa kuhudhuria matukio ya Konekt.',
    ageNote: 'Ni kwa wenye akaunti wenye miaka 18 hadi 35.',
    tiers: {
      silver: {
        name: 'Silver',
        blurb: 'Hapa ndipo kila mtu anapoanzia. Fungua akaunti na umo.',
        points: [
          'Kila tukio la Konekt, kuingia bure',
          'Ubao wa fursa',
          'Zana za fedha na malengo ya akiba',
        ],
      },
      gold: {
        name: 'Gold',
        blurb:
          'Kwa wanachama wanaoweka akiba kwa uthabiti na wanaohudhuria. Hupitiwa kila robo mwaka.',
        points: [
          'Yote yaliyo katika Silver',
          'Angalau tukio moja la Konekt kwa robo mwaka',
          'Nafasi za kipaumbele katika matukio yenye idadi ndogo',
          'Punguzo la washirika kwa usafiri, data na huduma za chuoni',
        ],
      },
      platinum: {
        name: 'Platinum',
        blurb:
          'Daraja la juu kabisa. Hupitiwa mara mbili kwa mwaka, kwa akiba, hali ya mkopo na mchango kwa jumuiya.',
        points: [
          'Yote yaliyo katika Gold',
          'Matukio mawili ya Konekt kwa mwaka, pamoja na wawili uliowaleta waliomaliza usajili',
          'Mialiko ya vikao maalum na ushauri wa kitaalamu',
          'Manufaa mapana zaidi ya washirika',
        ],
      },
    },
    stepDownTitle: 'Ukishuka chini ya kiwango',
    stepDownBody:
      'Unashuka daraja moja tu, huondolewi, na unabaki na manufaa yako kwa miezi mitatu unaporudi juu.',
    benefitsNote:
      'Manufaa ya washirika ni ya dalili na yanasubiri idhini ya Masoko na Sheria.',
    ctaMembership: 'Soma vigezo vyote',
  },

  opportunities: {
    eyebrow: 'Fursa',
    title: 'Ajira, mafunzo kwa vitendo, ufadhili wa masomo, ruzuku',
    lead: 'Ubao mmoja, uliochujwa kulingana na unachostahili kweli — kwa umri, kwa mkoa, kwa uliyosomea.',
    emptyTitle: 'Hakuna kilichoorodheshwa bado',
    emptyBody:
      'Ubao utafunguliwa matangazo ya kwanza yaliyohakikiwa yatakapoingia. Hakuna kinachochapishwa hapa kabla mtu wa CRDB hajakithibitisha, kwa hiyo utabaki mtupu badala ya kujazwa vitu visivyo halisi.',
    emptyCta: 'Nijulishe utakapofunguliwa',
    filtersLabel: 'Ubao utachuja kwa (bado haujaanza kufanya kazi)',
    filterAge: 'Umri',
    filterRegion: 'Mkoa',
    filterField: 'Fani ya masomo',
    filterEducation: 'Kiwango cha elimu',
  },

  footer: {
    tagline: "let's KONEKT",
    attribution:
      'CRDB Konekt ni jumuiya ya vijana ya kibenki ya CRDB Bank Plc, Tanzania.',
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
};

export default sw;
