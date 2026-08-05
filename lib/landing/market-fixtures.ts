// Demo data for the landing marketplace panel. Deliberately static: the landing
// page never reads the DB (spec: Implementation). Names are fictional.
export type MarketProfile = {
  id: string
  name: string
  initials: string
  sport: string
  tier: 'U18' | 'U21' | 'Senior'
  kind: 'athlete' | 'team'
  deals: number
  seeking: string
}

export const SKYLINE_FILTERS = ['All', 'Tennis', 'Football', 'Athletics', 'Teams'] as const

export const MARKET_PROFILES: MarketProfile[] = [
  { id: 'p1', name: 'Rita Silva', initials: 'RS', sport: 'Tennis', tier: 'U21', kind: 'athlete', deals: 22, seeking: 'Kit deal' },
  { id: 'p2', name: 'Joe Okafor', initials: 'JO', sport: 'Athletics', tier: 'Senior', kind: 'athlete', deals: 31, seeking: 'Season sponsor' },
  { id: 'p3', name: 'Mia Bakker', initials: 'MB', sport: 'Tennis', tier: 'U18', kind: 'athlete', deals: 12, seeking: 'Travel support' },
  { id: 'p4', name: 'Lena Tan', initials: 'LT', sport: 'Athletics', tier: 'U21', kind: 'athlete', deals: 8, seeking: 'Equipment' },
  { id: 'p5', name: 'Ferndale FC', initials: 'FF', sport: 'Football', tier: 'Senior', kind: 'team', deals: 17, seeking: 'Shirt sponsor' },
  { id: 'p6', name: 'Ana Novak', initials: 'AN', sport: 'Tennis', tier: 'Senior', kind: 'athlete', deals: 26, seeking: 'Racket partner' },
  { id: 'p7', name: 'Tom Forster', initials: 'TF', sport: 'Athletics', tier: 'U18', kind: 'athlete', deals: 5, seeking: 'First sponsor' },
  { id: 'p8', name: 'Harbour Rowing', initials: 'HR', sport: 'Rowing', tier: 'Senior', kind: 'team', deals: 9, seeking: 'Boat naming' },
  { id: 'p9', name: 'Kai Mercer', initials: 'KM', sport: 'Football', tier: 'U21', kind: 'athlete', deals: 14, seeking: 'Boot deal' },
  { id: 'p10', name: 'Priya Shah', initials: 'PS', sport: 'Tennis', tier: 'U21', kind: 'athlete', deals: 19, seeking: 'Apparel' },
  { id: 'p11', name: 'Oak Park Netball', initials: 'ON', sport: 'Netball', tier: 'Senior', kind: 'team', deals: 11, seeking: 'Court sponsor' },
  { id: 'p12', name: 'Leo Costa', initials: 'LC', sport: 'Football', tier: 'U18', kind: 'athlete', deals: 7, seeking: 'Academy backer' },
]

export type RallyPair = {
  athlete: MarketProfile
  brand: string
  category: string
  baseOffer: number
}

export const RALLY_PAIRS: RallyPair[] = [
  { athlete: MARKET_PROFILES[0]!, brand: 'Vantage Gear', category: 'Apparel', baseOffer: 400 },
  { athlete: MARKET_PROFILES[1]!, brand: 'Northline Energy', category: 'Nutrition', baseOffer: 650 },
  { athlete: MARKET_PROFILES[4]!, brand: 'Hexa Insurance', category: 'Local sponsor', baseOffer: 900 },
  { athlete: MARKET_PROFILES[5]!, brand: 'CourtOne', category: 'Equipment', baseOffer: 550 },
]
