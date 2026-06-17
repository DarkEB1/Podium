'use client'

import { useId, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { HelpCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Combobox } from '@/components/ui/combobox'
import { ImageUpload } from '@/components/ui/image-upload'
import { CharacterCounter } from '@/components/ui/character-counter'
import { RequiredKey } from '@/components/ui/required-key'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

// The wizard never sets user_id — createTeamProfile (B9) attaches it server-side.
type TeamInsert = Omit<
  Database['public']['Tables']['team_profiles']['Insert'],
  'user_id'
>
type TeamLevel = Database['public']['Enums']['team_level']
type AthleteLevel = Database['public']['Enums']['athlete_level']

const BIO_MAX = 500
const MIN_YEAR = 1800

// Sports offered as the searchable primary/secondary options (spec §5A.1).
const SPORTS = [
  'Football',
  'Rugby Union',
  'Rugby League',
  'Cricket',
  'Basketball',
  'Netball',
  'Hockey',
  'Athletics',
  'Tennis',
  'Cycling',
  'Swimming',
  'Rowing',
  'Volleyball',
  'Handball',
  'American Football',
  'Ice Hockey',
  'Lacrosse',
  'Water Polo',
  'Other',
]

const SPORT_OPTIONS = SPORTS.map((name) => ({ value: name, label: name }))

// Expanded competition level list mirroring the athlete_level enum (spec §5A.1).
// Each entry stores a valid `team_level` value; the displayed label/value uses
// the richer athlete_level vocabulary so teams and athletes speak the same
// language. Mapping keeps the persisted column inside its enum domain.
const COMPETITION_LEVELS: {
  value: AthleteLevel
  label: string
  team_level: TeamLevel
}[] = [
  { value: 'recreational', label: 'Recreational', team_level: 'grassroots' },
  { value: 'amateur', label: 'Amateur', team_level: 'grassroots' },
  { value: 'semi_professional', label: 'Semi-Professional', team_level: 'semi_pro' },
  { value: 'professional', label: 'Professional', team_level: 'professional' },
  { value: 'international', label: 'International', team_level: 'international' },
  { value: 'university_bucs', label: 'University / BUCS', team_level: 'college' },
  { value: 'academy', label: 'Academy', team_level: 'semi_pro' },
  { value: 'national', label: 'National Programme', team_level: 'international' },
]

function teamLevelFor(value: string | null): TeamLevel | null {
  return COMPETITION_LEVELS.find((l) => l.value === value)?.team_level ?? null
}

export interface TeamProfileFormProps {
  /** Server action wrapping createTeamProfile (B9). Returns the created row. */
  onCreate: (data: TeamInsert) => Promise<{ id: string }>
  initialLogoUrl?: string | null
  initialCoverUrl?: string | null
}

export default function TeamProfileForm({
  onCreate,
  initialLogoUrl = null,
  initialCoverUrl = null,
}: TeamProfileFormProps) {
  const router = useRouter()
  const bioHelpId = useId()

  const [teamName, setTeamName] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl)
  const [coverUrl, setCoverUrl] = useState<string | null>(initialCoverUrl)
  const [primarySport, setPrimarySport] = useState<string | null>(null)
  const [secondarySport, setSecondarySport] = useState<string | null>(null)
  const [level, setLevel] = useState<string>('')
  const [yearFounded, setYearFounded] = useState('')
  const [bio, setBio] = useState('')

  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const currentYear = useMemo(() => new Date().getFullYear(), [])

  const nameMissing = teamName.trim().length === 0
  const logoMissing = !logoUrl
  const coverMissing = !coverUrl

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (nameMissing || logoMissing || coverMissing) return

    const parsedYear = yearFounded ? Number(yearFounded) : null
    const sports = [primarySport, secondarySport].filter(
      (s): s is string => Boolean(s)
    )

    const data: TeamInsert = {
      team_name: teamName.trim(),
      logo_url: logoUrl,
      cover_photo_url: coverUrl,
      sports,
      competition_level: teamLevelFor(level),
      year_founded:
        parsedYear && parsedYear >= MIN_YEAR && parsedYear <= currentYear
          ? parsedYear
          : null,
      bio: bio.trim() || null,
    }

    setLoading(true)
    try {
      await onCreate(data)
      toast.success('Team profile created.')
      router.push('/team/onboarding/step/2')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      <RequiredKey />

      {/* Identity: logo + cover with a live public-header preview. */}
      <section className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <ImageUpload
              value={logoUrl}
              onUploaded={(url) => setLogoUrl(url)}
              aspect={1}
              shape="square"
              required
              showError={submitted && logoMissing}
              label="Team logo"
              subtext="Square image, at least 500px. Shown across the marketplace."
            />
            {submitted && logoMissing ? (
              <p role="alert" className="text-small text-destructive">
                Logo is required to continue.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <ImageUpload
              value={coverUrl}
              onUploaded={(url) => setCoverUrl(url)}
              aspect={16 / 9}
              shape="square"
              required
              showError={submitted && coverMissing}
              label="Cover image"
              subtext="Wide banner shown on your public team header (required)."
            />
            {submitted && coverMissing ? (
              <p role="alert" className="text-small text-destructive">
                Cover image is required to continue.
              </p>
            ) : null}
          </div>
        </div>

        {/* Public-header preview (spec §5A.1). */}
        <div>
          <p className="mb-2 text-small font-medium text-muted-foreground">
            How your public team header will look
          </p>
          <div
            data-testid="team-header-preview"
            className="overflow-hidden rounded-xl border bg-card shadow-card"
          >
            <div className="relative aspect-[16/9] w-full bg-muted">
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverUrl}
                  alt={`${teamName || 'Your team'} cover`}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-small text-muted-foreground">
                  Cover preview
                </div>
              )}
              <div className="absolute -bottom-6 left-4 size-16 overflow-hidden rounded-full border-4 border-card bg-muted">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt={`${teamName || 'Your team'} logo`}
                    className="size-full object-cover"
                  />
                ) : null}
              </div>
            </div>
            <div className="px-4 pb-4 pt-8">
              <p className="font-heading text-large">{teamName || 'Your team'}</p>
              <p className="text-small text-muted-foreground">
                {[primarySport, COMPETITION_LEVELS.find((l) => l.value === level)?.label]
                  .filter(Boolean)
                  .join(' · ') || 'Sport · Level'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Team name */}
      <div className="space-y-2">
        <Label htmlFor="team-name">
          Team name <span aria-hidden="true" className="text-destructive">*</span>
        </Label>
        <Input
          id="team-name"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="Riverside FC"
          aria-invalid={submitted && nameMissing}
          aria-describedby={submitted && nameMissing ? 'team-name-error' : undefined}
        />
        {submitted && nameMissing ? (
          <p id="team-name-error" role="alert" className="text-small text-destructive">
            Team name is required.
          </p>
        ) : null}
      </div>

      {/* Sports */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="primary-sport">
            Primary sport <span aria-hidden="true" className="text-destructive">*</span>
          </Label>
          <Combobox
            id="primary-sport"
            aria-label="Primary sport"
            options={SPORT_OPTIONS}
            value={primarySport}
            onChange={setPrimarySport}
            placeholder="Search sports…"
            searchable
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="secondary-sport">
            Secondary sport{' '}
            <span className="text-small text-muted-foreground">(optional)</span>
          </Label>
          <Combobox
            id="secondary-sport"
            aria-label="Secondary sport"
            options={SPORT_OPTIONS}
            value={secondarySport}
            onChange={setSecondarySport}
            placeholder="Search sports…"
            searchable
          />
        </div>
      </div>

      {/* Competition level + year founded */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="competition-level">Competition level</Label>
          <select
            id="competition-level"
            aria-label="Competition level"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className={cn(
              'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-medium shadow-xs',
              'focus-visible:ring-3 focus-visible:ring-ring/50 outline-none'
            )}
          >
            <option value="">Select a level</option>
            {COMPETITION_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="year-founded">
            Year founded{' '}
            <span className="text-small text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="year-founded"
            type="number"
            inputMode="numeric"
            min={MIN_YEAR}
            max={currentYear}
            value={yearFounded}
            onChange={(e) => setYearFounded(e.target.value)}
            placeholder="e.g. 1998"
          />
        </div>
      </div>

      {/* Short bio */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="team-bio">
            Short bio{' '}
            <span className="text-small text-muted-foreground">(optional)</span>
          </Label>
          <button
            type="button"
            aria-label="About the bio"
            title="A concise summary of your team shown on your public header and discovery card."
            aria-describedby={bioHelpId}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 rounded-full outline-none"
          >
            <HelpCircle aria-hidden="true" className="size-4" />
          </button>
          <span id={bioHelpId} className="sr-only">
            A concise summary of your team shown on your public header and discovery card.
          </span>
        </div>
        <Textarea
          id="team-bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          maxLength={BIO_MAX}
          className="resize-none"
          placeholder="Tell sponsors who you are, your history, and what makes your team a great partner…"
        />
        <div className="flex justify-end">
          <CharacterCounter value={bio} max={BIO_MAX} />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Creating…' : 'Create team profile →'}
      </Button>
    </form>
  )
}
