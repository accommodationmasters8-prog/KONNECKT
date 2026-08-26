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
    statCampuses: 'vyuo vilivyoorodheshwa',
    scrollHint: 'Teremka',
  },
  how: {
    eyebrow: 'Inavyofanya kazi',
    title: 'Hatua tatu, mara moja kwa mwezi.',
    lead:
      'Konekt inachukua nafasi ya majedwali yaliyokuwa yakisafiri kati ya tawi na makao makuu kwa barua pepe. Kila mtu anaingiza mahali pamoja, na walio juu yao wanaona mara moja.',
    step1Title: 'Tawi linaongeza vituo vyake',
    step1Body:
      'Kila chuo, sehemu ya kazi, SACCOS au kambi ambayo tawi linafanya nayo kazi, chini ya kundi lake. Huongezwa mara moja; hurekebishwa wakati wowote.',
    step2Title: 'Linaingiza takwimu',
    step2Body:
      'Idadi ya watu, akaunti zilizofunguliwa, hai na zilizolala, amana na mikopo — kila siku, kila wiki au kila mwezi. Kuingiza kipindi kile kile tena kunarekebisha, hakuongezi rekodi ya pili.',
    step3Title: 'Kanda na makao makuu wanaona papo hapo',
    step3Body:
      'Tawi linaona lake, kanda inaona matawi yote chini yake, makao makuu yanaona nchi nzima. Takwimu zile zile, wakati ule ule.',
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
    lead: 'Kila taasisi ambayo Konekt inafuatilia, imewekwa alama kwenye mkoa ambao daftari la CRDB linaiweka. Takwimu zake zipo ndani ya mfumo.',
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
    events: {
      title: 'Kila kinachoendelea karibu nawe',
      lead: 'Ziara za vyuo, kliniki za fedha, michezo na maonyesho ya ajira. Bure kuhudhuria, dakika chache kujiandikisha.',
      empty: 'Kalenda bado haijafunguliwa',
      emptyBody:
        'Matukio yataonekana hapa mara waratibu watakapoanza kuyachapisha. Hakuna kinachoorodheshwa kabla hakijawa halisi na cha kujiandikisha.',
    },
    map: {
      title: 'Kanda nane. Matawi 252. Mtandao mmoja.',
      lead: 'CRDB imekuwa katika miji hii kwa miaka arobaini. Konekt inaweka kila tawi, chuo na kambi kwenye ramani moja ili upate lililo karibu nawe na uone kinachoendelea hapo.',
      legend: 'Rangi inaonyesha idadi ya vyuo ambavyo daftari linaviweka katika kila kanda',
      densityNote:
        'Kila mpaka hapa ni halisi: taarifa za kiutawala za Natural Earth 1:10m, mikoa yote 30, iliyopangwa katika kanda nane za CRDB.',
      pinNote:
        'Bado hakuna alama za maeneo, na hilo ni la makusudi. Hakuna rekodi hata moja katika daftari la CRDB yenye viwianishi. Hatua ya kutafuta viwianishi inafuata, na hakuna alama itakayofika kwenye ramani hii kabla afisa wa tawi hajaithibitisha.',
      tableCaption: 'Vyuo na mikoa kwa kila kanda, kutoka daftari la CRDB',
      colZone: 'Kanda',
      colCampuses: 'Vyuo',
      colRegions: 'Mikoa',
      colRegionNames: 'Inayohusisha',
    },
    membership: {
      title: 'Silver, Gold, Platinum',
      lead: 'Uanachama ni bure na unaanza mara tu unapofungua akaunti ya vijana ya CRDB. Daraja lako unalichuma — kwa kuweka akiba, kwa kukopa vizuri, na kwa kuhudhuria.',
    },
    opportunities: {
      title: 'Ajira, mafunzo kwa vitendo, ufadhili wa masomo, ruzuku',
      lead: 'Ubao mmoja, uliochujwa kulingana na unachostahili kweli — kwa umri, kwa mkoa, kwa uliyosomea.',
    },
    blog: {
      title: 'Habari',
      lead: 'Fedha, maisha ya chuoni, na wanachama wenzako wa Konekt wanachojenga. Imeandikwa na jumuiya na CRDB.',
      empty: 'Bado hakuna habari iliyochapishwa',
      emptyBody:
        'Makala ya kwanza yataonekana timu ya wahariri itakapoanza kuchapisha. Hakuna kinachojazwa ili tu kujaza ukurasa.',
      featured: 'Iliyoangaziwa',
      latest: 'Mpya',
    },
    me: {
      title: 'Konekt yako',
      lead: 'Daraja lako, tiketi zako, uliowaleta.',
      signedOut: 'Ingia kwa namba yako ya simu',
      signedOutBody:
        'Msimbo mmoja kwa SMS na umeingia. Hakuna nywila ya kusahau, wala hakuna cha kujaza ambacho CRDB haina tayari.',
      signIn: 'Nitumie msimbo',
      tier: 'Daraja lako',
      noTier: 'Bado huna daraja',
      noTierBody:
        'Daraja lako linahesabiwa na CRDB kutokana na matumizi ya akaunti yako na litaonekana hapa baada ya tathmini yako ya kwanza.',
      myEvents: 'Matukio yangu',
      myTickets: 'Tiketi zangu',
      myReferrals: 'Niliowaleta',
      referralCode: 'Msimbo wako wa kualika',
      consentCentre: 'Kituo cha idhini',
      consentBody:
        'Chagua hasa tunachoweza kukutumia, na kwa njia gani. Mabadiliko yanaanza kufanya kazi mara moja.',
      profile: 'Wasifu',
    },
  },
};

export default sw;
