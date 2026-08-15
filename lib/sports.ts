/**
 * Canonical list of sports across Podium — the single source of truth for
 * sport <select> options on athlete/team profile forms and for the Discover
 * sport filter.
 *
 * There is no DB enum for sport: `primary_sport`, `secondary_sport` and
 * `target_sports` are free-text columns (see `types/database.ts`), so the
 * label here IS the stored value. Adding a sport here makes it selectable
 * everywhere that imports `SPORTS`. Keep "Other" last.
 *
 * This deliberately supersedes the ad-hoc `SPORTS` array in
 * `components/team/team-profile-form.tsx` (which historically omitted
 * individual/action sports such as Surfing — the root cause of athletes whose
 * sport never appeared in the Discover filter). Prefer importing from here.
 */
export const SPORTS = [
  'American Football',
  'Athletics',
  'Badminton',
  'Baseball',
  'Basketball',
  'Boxing',
  'Climbing',
  'Cricket',
  'Cycling',
  'Equestrian',
  'Fencing',
  'Football',
  'Golf',
  'Gymnastics',
  'Handball',
  'Hockey',
  'Ice Hockey',
  'Judo',
  'Lacrosse',
  'Martial Arts',
  'Motorsport',
  'Netball',
  'Rowing',
  'Rugby League',
  'Rugby Union',
  'Sailing',
  'Skateboarding',
  'Skiing',
  'Snowboarding',
  'Squash',
  'Surfing',
  'Swimming',
  'Table Tennis',
  'Taekwondo',
  'Tennis',
  'Triathlon',
  'Volleyball',
  'Water Polo',
  'Weightlifting',
  'Wrestling',
  'Other',
] as const

export type Sport = (typeof SPORTS)[number]

/** `{ value, label }` pairs for <select>/combobox option lists. */
export const SPORT_OPTIONS: ReadonlyArray<{ value: string; label: string }> =
  SPORTS.map((name) => ({ value: name, label: name }))

/**
 * True when `value` is one of the canonical sports. Useful when migrating
 * free-text data: values that fail this check are legacy/unconstrained input
 * (e.g. junk left over from the old text field) and should be surfaced, not
 * silently dropped, when rendering a select for an existing profile.
 */
export function isKnownSport(value: string | null | undefined): value is Sport {
  return !!value && (SPORTS as readonly string[]).includes(value)
}
