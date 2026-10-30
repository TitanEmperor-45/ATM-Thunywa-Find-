export interface ATMData {
  id: string;
  name: string;
  bank: 'FNB' | 'Standard Bank' | 'Capitec' | 'Nedbank' | 'Absa';
  location: { lat: number; lng: number };
  address: string;
  city: string;
  type: 'Mall/Indoor (Secure)' | 'Standalone/Street' | 'Garage/Forecourt' | 'Branch/Bank Lobby';
  status: 'online' | 'offline';
  notes?: string;
  lastUpdated: string;
  isGuarded: boolean;
  hasCCTV: boolean;
  securityRating: 'Safe' | 'Moderate' | 'High Risk Area';
  accessibility: boolean;
  availableNotes: string[];
}

export interface SecurityZoneData {
  id: string;
  name: string;
  city: string;
  center: { lat: number; lng: number };
  radiusMeters: number;
  severity: 'high' | 'very-high';
  advisory: string;
  commonScams: string[];
  saferAlternativeRecommendation: string;
}

export const INITIAL_SECURITY_ZONES: SecurityZoneData[] = [
  {
    id: 'zone-jhb-noord',
    name: 'Johannesburg CBD - Noord St Taxi Rank & Park Station',
    city: 'Johannesburg',
    center: { lat: -26.1983, lng: 28.0441 },
    radiusMeters: 550,
    severity: 'very-high',
    advisory: 'Known hotspot for organized card-skimming devices, distraction pickpocketing, and forced cash withdrawals.',
    commonScams: [
      'Fake "ATM jammed" card swapping by fake helpers',
      'Shoulder-surfing for PIN codes in crowded queues',
      'Following targets leaving ATM with cash'
    ],
    saferAlternativeRecommendation: 'Use inside ATMs at Newtown Junction (Guarded) or Carlton Centre inside bank branch.'
  },
  {
    id: 'zone-jhb-hillbrow',
    name: 'Hillbrow - Kotze & Pretoria Street Hub',
    city: 'Johannesburg',
    center: { lat: -26.1887, lng: 28.0495 },
    radiusMeters: 600,
    severity: 'very-high',
    advisory: 'High incident rate of physical muggings and card cloning. Avoid using standalone outdoor street ATMs, especially after dusk.',
    commonScams: [
      'Armed robbery near street ATM alcoves',
      'Cloned keypad overlays on unguarded machines'
    ],
    saferAlternativeRecommendation: 'Travel 2.5km to Killarney Mall or Rosebank Mall indoor banking halls with armed guard presence.'
  },
  {
    id: 'zone-pta-sunnyside',
    name: 'Sunnyside - Robert Sobukwe & Esselen St Corridor',
    city: 'Pretoria',
    center: { lat: -25.7533, lng: 28.2098 },
    radiusMeters: 500,
    severity: 'high',
    advisory: 'High frequency of syndicate distraction scams targeting university students and commuters.',
    commonScams: [
      'Pretending to offer help when card is slow to insert',
      'Group distractions while PIN is typed'
    ],
    saferAlternativeRecommendation: 'Use Brooklyn Mall or Menlyn Park Shopping Centre branch ATMs.'
  },
  {
    id: 'zone-cpt-station',
    name: 'Cape Town CBD - Station Deck / Golden Acre Exterior',
    city: 'Cape Town',
    center: { lat: -33.9238, lng: 18.4252 },
    radiusMeters: 450,
    severity: 'high',
    advisory: 'Concealed card skimming and intimidation tactics targeting foreign and domestic tourists.',
    commonScams: [
      'Shoulder surfing and bag snatching',
      'Impersonating security/bank officials offering assistance'
    ],
    saferAlternativeRecommendation: 'Use indoor ATMs at V&A Waterfront or inside St Georges Mall protected branches.'
  },
  {
    id: 'zone-dbn-warwick',
    name: 'Durban Central - Warwick Junction & Market Hub',
    city: 'Durban',
    center: { lat: -29.8562, lng: 31.0147 },
    radiusMeters: 500,
    severity: 'high',
    advisory: 'Congested transit area with frequent reports of pickpocketing and fraudulent card swapping.',
    commonScams: [
      'Aggressive distractions while terminal is dispensing cash',
      'Card slot jamming traps'
    ],
    saferAlternativeRecommendation: 'Use indoor ATMs at The Pavilion (Westville) or Gateway Theatre of Shopping (Umhlanga).'
  }
];

export const INITIAL_ATMS: ATMData[] = [
  // Johannesburg
  {
    id: 'atm-fnb-carlton',
    name: 'FNB ATM - Carlton Centre',
    bank: 'FNB',
    location: { lat: -26.2052, lng: 28.0475 },
    address: '150 Commissioner St, Marshalltown, Johannesburg',
    city: 'Johannesburg',
    type: 'Branch/Bank Lobby',
    status: 'online',
    notes: 'Inside mall bank lobby with security guards and CCTV.',
    lastUpdated: '10 mins ago',
    isGuarded: true,
    hasCCTV: true,
    securityRating: 'Safe',
    accessibility: true
  },
  {
    id: 'atm-capitec-park-station',
    name: 'Capitec ATM - Park Station Entrance',
    bank: 'Capitec',
    location: { lat: -26.1969, lng: 28.0428 },
    address: 'Rissik St, Johannesburg CBD',
    city: 'Johannesburg',
    type: 'Standalone/Street',
    status: 'offline',
    notes: 'Reported offline: Card reader stuck & out of cash.',
    lastUpdated: '18 mins ago',
    isGuarded: false,
    hasCCTV: true,
    securityRating: 'High Risk Area',
    accessibility: false
  },
  {
    id: 'atm-std-gandhi',
    name: 'Standard Bank ATM - Gandhi Square',
    bank: 'Standard Bank',
    location: { lat: -26.2071, lng: 28.0425 },
    address: 'Gandhi Square Bus Terminus, Johannesburg',
    city: 'Johannesburg',
    type: 'Branch/Bank Lobby',
    status: 'online',
    notes: 'Active security personnel on duty. Dispensing R100, R200 notes.',
    lastUpdated: '5 mins ago',
    isGuarded: true,
    hasCCTV: true,
    securityRating: 'Safe',
    accessibility: true,
    availableNotes: ['R100', 'R200']
  },
  {
    id: 'atm-absa-noord',
    name: 'Absa ATM - Noord Street Kiosk',
    bank: 'Absa',
    location: { lat: -26.1988, lng: 28.0461 },
    address: 'Noord & Klein St, Joubert Park, Johannesburg',
    city: 'Johannesburg',
    type: 'Standalone/Street',
    status: 'offline',
    notes: 'Reported offline: Power interruption / Network fault.',
    lastUpdated: '34 mins ago',
    isGuarded: false,
    hasCCTV: false,
    securityRating: 'High Risk Area',
    accessibility: false
  },
  {
    id: 'atm-nedbank-newtown',
    name: 'Nedbank ATM - Newtown Junction Mall',
    bank: 'Nedbank',
    location: { lat: -26.2009, lng: 28.0336 },
    address: '100 Carr St, Newtown, Johannesburg',
    city: 'Johannesburg',
    type: 'Mall/Indoor (Secure)',
    status: 'online',
    notes: 'Fully functional, well-lit mall basement near Pick n Pay.',
    lastUpdated: '2 mins ago',
    isGuarded: true,
    hasCCTV: true,
    securityRating: 'Safe',
    accessibility: true,
    availableNotes: ['R100', 'R200']
  },
  {
    id: 'atm-fnb-rosebank',
    name: 'FNB ATM - Rosebank Mall Level 2',
    bank: 'FNB',
    location: { lat: -26.1462, lng: 28.0416 },
    address: '50 Bath Ave, Rosebank, Johannesburg',
    city: 'Johannesburg',
    type: 'Mall/Indoor (Secure)',
    status: 'online',
    notes: 'High security area, Gautrain station adjacent.',
    lastUpdated: 'Just now',
    isGuarded: true,
    hasCCTV: true,
    securityRating: 'Safe',
    accessibility: true,
    availableNotes: ['R100', 'R200']
  },
  {
    id: 'atm-std-sandton',
    name: 'Standard Bank ATM - Sandton City Banking Court',
    bank: 'Standard Bank',
    location: { lat: -26.1075, lng: 28.0527 },
    address: 'Rivonia Rd, Sandhurst, Sandton',
    city: 'Johannesburg',
    type: 'Mall/Indoor (Secure)',
    status: 'online',
    notes: 'Premium guarded zone. 4 operational ATM terminals.',
    lastUpdated: '15 mins ago',
    isGuarded: true,
    hasCCTV: true,
    securityRating: 'Safe',
    accessibility: true,
    availableNotes: ['R100', 'R200']
  },
  {
    id: 'atm-capitec-kotze',
    name: 'Capitec ATM - Kotze Street Hillbrow',
    bank: 'Capitec',
    location: { lat: -26.1884, lng: 28.0491 },
    address: 'Kotze St, Hillbrow, Johannesburg',
    city: 'Johannesburg',
    type: 'Standalone/Street',
    status: 'offline',
    notes: 'Reported offline: Card reader vandalized / Tamper alert.',
    lastUpdated: '45 mins ago',
    isGuarded: false,
    hasCCTV: false,
    securityRating: 'High Risk Area',
    accessibility: false
  },
  {
    id: 'atm-absa-maponya',
    name: 'Absa ATM - Maponya Mall Soweto',
    bank: 'Absa',
    location: { lat: -26.2625, lng: 27.8967 },
    address: 'Chris Hani Rd, Klipspruit, Soweto',
    city: 'Johannesburg',
    type: 'Mall/Indoor (Secure)',
    status: 'online',
    notes: 'Mall security patrolled. Accepts all SASWITCH cards.',
    lastUpdated: '8 mins ago',
    isGuarded: true,
    hasCCTV: true,
    securityRating: 'Safe',
    accessibility: true,
    availableNotes: ['R100', 'R200']
  },

  // Pretoria
  {
    id: 'atm-fnb-church-sq',
    name: 'FNB ATM - Church Square Pretoria',
    bank: 'FNB',
    location: { lat: -25.7461, lng: 28.1881 },
    address: 'Church Square, Pretoria Central',
    city: 'Pretoria',
    type: 'Branch/Bank Lobby',
    status: 'online',
    notes: 'Branch interior, operational.',
    lastUpdated: '20 mins ago',
    isGuarded: true,
    hasCCTV: true,
    securityRating: 'Safe',
    accessibility: true,
    availableNotes: ['R100', 'R200']
  },
  {
    id: 'atm-std-sunnyside',
    name: 'Standard Bank ATM - Esselen Street Sunnyside',
    bank: 'Standard Bank',
    location: { lat: -25.7538, lng: 28.2104 },
    address: 'Robert Sobukwe St, Sunnyside, Pretoria',
    city: 'Pretoria',
    type: 'Standalone/Street',
    status: 'offline',
    notes: 'Reported offline: Out of banknotes / Screen error.',
    lastUpdated: '1 hour ago',
    isGuarded: false,
    hasCCTV: true,
    securityRating: 'High Risk Area',
    accessibility: false
  },

  // Cape Town
  {
    id: 'atm-fnb-waterfront',
    name: 'FNB ATM - V&A Waterfront Victoria Wharf',
    bank: 'FNB',
    location: { lat: -33.9054, lng: 18.4216 },
    address: 'Breakwater Blvd, Victoria & Alfred Waterfront, Cape Town',
    city: 'Cape Town',
    type: 'Mall/Indoor (Secure)',
    status: 'online',
    notes: 'High security tourism precinct, 24/7 CCTV & security personnel.',
    lastUpdated: '3 mins ago',
    isGuarded: true,
    hasCCTV: true,
    securityRating: 'Safe',
    accessibility: true,
    availableNotes: ['R100', 'R200']
  },
  {
    id: 'atm-capitec-golden-acre',
    name: 'Capitec ATM - Golden Acre Station Deck',
    bank: 'Capitec',
    location: { lat: -33.9234, lng: 18.4249 },
    address: 'Adderley St & Strand St, Cape Town CBD',
    city: 'Cape Town',
    type: 'Standalone/Street',
    status: 'offline',
    notes: 'Reported offline: Card dispenser jam.',
    lastUpdated: '25 mins ago',
    isGuarded: false,
    hasCCTV: true,
    securityRating: 'High Risk Area',
    accessibility: false
  },

  // Durban
  {
    id: 'atm-fnb-gateway',
    name: 'FNB ATM - Gateway Theatre of Shopping',
    bank: 'FNB',
    location: { lat: -29.7258, lng: 31.0662 },
    address: '1 Palm Blvd, Umhlanga Ridge, Durban',
    city: 'Durban',
    type: 'Mall/Indoor (Secure)',
    status: 'online',
    notes: 'Indoor banking mall with 24/7 armed patrol.',
    lastUpdated: '12 mins ago',
    isGuarded: true,
    hasCCTV: true,
    securityRating: 'Safe',
    accessibility: true,
    availableNotes: ['R100', 'R200']
  },
  {
    id: 'atm-absa-warwick',
    name: 'Absa ATM - Warwick Triangle Market',
    bank: 'Absa',
    location: { lat: -29.8571, lng: 31.0139 },
    address: 'Brook St & Market Rd, Durban Central',
    city: 'Durban',
    type: 'Standalone/Street',
    status: 'offline',
    notes: 'Reported offline: Tamper warning triggered.',
    lastUpdated: '50 mins ago',
    isGuarded: false,
    hasCCTV: false,
    securityRating: 'High Risk Area',
    accessibility: false
  }
];
