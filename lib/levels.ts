/**
 * Athlete competition-level display labels — the shared, canonical spellings.
 *
 * NOTE: this mapping deliberately mirrors `LEVEL_OPTIONS` in
 * `components/athlete/settings-form.tsx` and
 * `components/athlete/profile-wizard.tsx` (client form components that server
 * pages must not import) plus the roster labels in
 * `lib/supabase/agent-clients.ts`. If a label changes in any of those files,
 * change it here too. The canonical spelling is hyphenated:
 * "Semi-Professional", never "Semi professional".
 */
export const ATHLETE_LEVEL_LABELS: Record<string, string> = {
  recreational: 'Recreational',
  amateur: 'Amateur',
  semi_professional: 'Semi-Professional',
  university_bucs: 'University / BUCS',
  academy: 'Academy',
  national: 'National',
  professional: 'Professional',
  international: 'International',
}

/**
 * Display label for a stored athlete level. Unknown values fall back to a
 * humanised form ("some_value" -> "Some value") so a new enum member never
 * renders raw; null/empty stays null so callers can treat it as unset.
 */
export function athleteLevelLabel(value: string | null | undefined): string | null {
  if (!value) return null
  const label = ATHLETE_LEVEL_LABELS[value]
  if (label) return label
  const spaced = value.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
