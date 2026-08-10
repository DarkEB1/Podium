// Panel 02 fixture profiles (build spec v3 §3 P02). Compliance rules: every
// profile is an anonymized archetype (sport + level + region + price band),
// no invented person names, no follower counts, no fabricated testimonials.
// The card header always carries a SAMPLE tag so nothing reads as a real deal.

export type MarketFixture = {
  id: string
  /** Mono role tag shown in the card header. */
  role: 'ATHLETE' | 'CLUB' | 'YOUTH TEAM'
  /** Archetype title, never a person's name. */
  title: string
  level: string
  region: string
  /** Season asking-price floor in GBP. */
  asksFrom: number
  /** What a sponsor gets, two short lines. */
  gets: readonly [string, string]
}

export const FIXTURES = [
  {
    id: 'track-sprinter-manchester',
    role: 'ATHLETE',
    title: 'Track sprinter',
    level: 'National level',
    region: 'Manchester',
    asksFrom: 400,
    gets: ['Kit branding at ranked meets', 'Monthly training-day content'],
  },
  {
    id: 'football-club-leeds',
    role: 'CLUB',
    title: 'Grassroots football club',
    level: '400 members',
    region: 'Leeds',
    asksFrom: 600,
    gets: ['Shirt-front logo all season', 'Pitchside boards at home games'],
  },
  {
    id: 'netball-youth-bristol',
    role: 'YOUTH TEAM',
    title: 'Youth netball team',
    level: 'Under-15 league',
    region: 'Bristol',
    asksFrom: 250,
    gets: ['Warm-up kit branding', 'Named end-of-season award'],
  },
  {
    id: 'road-cyclist-surrey',
    role: 'ATHLETE',
    title: 'Road cyclist',
    level: 'Elite amateur',
    region: 'Surrey',
    asksFrom: 500,
    gets: ['Frame and jersey placement', 'Race-day social coverage'],
  },
  {
    id: 'boxing-gym-birmingham',
    role: 'CLUB',
    title: 'Boxing gym',
    level: 'Community club',
    region: 'Birmingham',
    asksFrom: 350,
    gets: ['Ring-corner branding', 'Sponsor slots at open nights'],
  },
  {
    id: 'swimmer-glasgow',
    role: 'ATHLETE',
    title: 'Distance swimmer',
    level: 'Junior international',
    region: 'Glasgow',
    asksFrom: 450,
    gets: ['Cap and poolside branding', 'Meet-report mentions'],
  },
  {
    id: 'rugby-club-cardiff',
    role: 'CLUB',
    title: 'Rugby union club',
    level: 'Regional league',
    region: 'Cardiff',
    asksFrom: 800,
    gets: ['Shirt and clubhouse branding', 'Matchday programme page'],
  },
  {
    id: 'judo-sheffield',
    role: 'ATHLETE',
    title: 'Judo athlete',
    level: 'Senior national squad',
    region: 'Sheffield',
    asksFrom: 300,
    gets: ['Gi patch at televised events', 'Training-camp diaries'],
  },
  {
    id: 'cricket-academy-nottingham',
    role: 'YOUTH TEAM',
    title: 'Youth cricket academy',
    level: 'County pathway U17',
    region: 'Nottingham',
    asksFrom: 550,
    gets: ['Net-session kit branding', 'Summer tournament naming'],
  },
  {
    id: 'triathlete-brighton',
    role: 'ATHLETE',
    title: 'Triathlete',
    level: 'Age-group qualifier',
    region: 'Brighton',
    asksFrom: 400,
    gets: ['Race-suit placement', 'Season training vlog'],
  },
  {
    id: 'basketball-club-london',
    role: 'CLUB',
    title: 'Basketball club',
    level: 'Division two',
    region: 'London',
    asksFrom: 700,
    gets: ['Courtside hoardings', 'Home shirt sleeve logo'],
  },
  {
    id: 'para-sprinter-liverpool',
    role: 'ATHLETE',
    title: 'Para sprinter',
    level: 'International classification',
    region: 'Liverpool',
    asksFrom: 500,
    gets: ['Kit branding at majors', 'School visit programme'],
  },
] as const satisfies readonly MarketFixture[]
