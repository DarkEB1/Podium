'use client'

import { useId, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  FileText,
  Gift,
  HelpCircle,
  Loader2,
  Megaphone,
  Shirt,
  Sparkles,
  Star,
  Ticket,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Combobox } from '@/components/ui/combobox'
import { ImageUpload } from '@/components/ui/image-upload'
import { isRemoteImageSrc } from '@/components/ui/image-src'
import { CardSelectGroup } from '@/components/ui/card-select'
import { CharacterCounter } from '@/components/ui/character-counter'
import { RequiredKey } from '@/components/ui/required-key'
import { Switch } from '@/components/ui/switch'
import { createClient } from '@/lib/supabase/client'
import { createUploadUrl } from '@/lib/storage'
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

// What the team is seeking — rendered as CardSelectGroup tiles, the same
// component as the brand profile (spec §5A.2). Multi-select.
const SEEKING_OPTIONS: { value: string; label: string; description?: string }[] = [
  { value: 'title_sponsor', label: 'Title sponsor', description: 'Headline naming-rights partner' },
  { value: 'kit_sponsor', label: 'Kit / shirt sponsor', description: 'Branding on playing kit' },
  { value: 'matchday', label: 'Matchday sponsor', description: 'Single-event partnership' },
  { value: 'equipment', label: 'Equipment / supplier', description: 'Gear, apparel or product' },
  { value: 'venue', label: 'Venue / facilities', description: 'Stadium or ground branding' },
  { value: 'community', label: 'Community programme', description: 'Grassroots & outreach support' },
  { value: 'digital', label: 'Digital / social', description: 'Online content partnership' },
  { value: 'travel', label: 'Travel / logistics', description: 'Transport & accommodation' },
]

// What the team offers — two-column icon checklist (spec §5A.3).
const OFFER_OPTIONS: { value: string; label: string; icon: React.ReactNode }[] = [
  { value: 'kit_logo', label: 'Logo on kit', icon: <Shirt className="size-5" aria-hidden="true" /> },
  { value: 'social_mentions', label: 'Social media mentions', icon: <Megaphone className="size-5" aria-hidden="true" /> },
  { value: 'venue_branding', label: 'Venue branding', icon: <Ticket className="size-5" aria-hidden="true" /> },
  { value: 'matchday_hospitality', label: 'Matchday hospitality', icon: <Users className="size-5" aria-hidden="true" /> },
  { value: 'player_appearances', label: 'Player appearances', icon: <Star className="size-5" aria-hidden="true" /> },
  { value: 'product_sampling', label: 'Product sampling', icon: <Gift className="size-5" aria-hidden="true" /> },
  { value: 'content_creation', label: 'Content creation', icon: <Sparkles className="size-5" aria-hidden="true" /> },
  { value: 'community_events', label: 'Community events', icon: <Users className="size-5" aria-hidden="true" /> },
]

/** Human-readable size of an uploaded document (spec §5A.2 preview). */
function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

interface UploadedDoc {
  url: string
  name: string
  size: number
  uploadedAt: string
}

/** Default PDF upload via presigned URL (lib/storage B8) — bytes go straight to
 * Supabase Storage, never through Next.js. */
async function uploadPdfDefault(file: File): Promise<string> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in to upload a file.')
  const { uploadUrl, path } = await createUploadUrl(supabase, {
    bucket: 'docs',
    userId: user.id,
    ext: 'pdf',
  })
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'content-type': file.type || 'application/pdf' },
  })
  if (!res.ok) throw new Error('Upload failed. Please try again.')
  // The `docs` bucket is private (migration 20260720005002), so there is no
  // public URL to store. Persist the object PATH and mint a short-lived link at
  // read time with createSignedDownloadUrl() — a stored URL cannot be re-signed.
  return path
}

interface PdfUploadProps {
  testId: string
  label: string
  subtext?: string
  value: UploadedDoc | null
  onUploaded: (doc: UploadedDoc) => void
  /** Test seam mirroring ImageUpload — defaults to the presigned-URL pipeline. */
  uploadFile?: ((file: File) => Promise<string>) | undefined
}

/**
 * PdfUpload — sponsorship-brief / media-pack document picker. ImageUpload only
 * accepts images, so PDFs use this sibling control. After a successful upload it
 * shows the file name, size and upload date so brands can see them before
 * downloading (spec §5A.2).
 */
function PdfUpload({
  testId,
  label,
  subtext,
  value,
  onUploaded,
  uploadFile,
}: PdfUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const errorId = useId()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const doUpload = uploadFile ?? uploadPdfDefault

  async function handleFiles(files: FileList | null) {
    setError(null)
    const file = files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      setError('Please choose a PDF file.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File must be 10MB or smaller.')
      return
    }
    setUploading(true)
    try {
      const url = await doUpload(file)
      onUploaded({
        url,
        name: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`${testId}-trigger`}>{label}</Label>
      {subtext ? (
        <p className="text-small text-muted-foreground">{subtext}</p>
      ) : null}

      {value ? (
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <FileText aria-hidden="true" className="mt-0.5 size-5 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-medium font-medium text-foreground">
              {value.name}
            </p>
            <p className="text-small text-muted-foreground">
              {formatFileSize(value.size)} · Uploaded{' '}
              {new Date(value.uploadedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      ) : null}

      <Button
        id={`${testId}-trigger`}
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        ) : null}
        {value ? 'Replace PDF' : 'Upload PDF'}
      </Button>

      <input
        ref={inputRef}
        data-testid={testId}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {error ? (
        <p id={errorId} role="alert" className="text-small text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export interface TeamProfileFormProps {
  /** Server action wrapping createTeamProfile (B9). Returns the created row. */
  onCreate: (data: TeamInsert) => Promise<{ id: string }>
  initialLogoUrl?: string | null
  initialCoverUrl?: string | null
  /** Test/override seam for the PDF upload pipeline (mirrors ImageUpload). */
  uploadDoc?: (file: File) => Promise<string>
}

export default function TeamProfileForm({
  onCreate,
  initialLogoUrl = null,
  initialCoverUrl = null,
  uploadDoc,
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

  // TM2 — sponsorship needs & offers (spec §5A.2–5A.3).
  const [seeking, setSeeking] = useState<string[]>([])
  const [annualTarget, setAnnualTarget] = useState('')
  const [briefDoc, setBriefDoc] = useState<UploadedDoc | null>(null)
  const [offerings, setOfferings] = useState<string[]>([])
  const [reachPerPost, setReachPerPost] = useState('')
  const [mediaPackEnabled, setMediaPackEnabled] = useState(false)
  const [mediaPackDoc, setMediaPackDoc] = useState<UploadedDoc | null>(null)

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

    const parsedTarget = annualTarget ? Number(annualTarget) : null

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
      seeking_sponsorship_types: seeking,
      annual_sponsorship_target:
        parsedTarget !== null && Number.isFinite(parsedTarget) && parsedTarget > 0
          ? parsedTarget
          : null,
      sponsorship_brief_url: briefDoc?.url ?? null,
      offers_to_sponsors: {
        offerings,
        estimated_reach_per_post: reachPerPost.trim() || null,
      },
      media_pack_url: mediaPackEnabled ? (mediaPackDoc?.url ?? null) : null,
    }

    setLoading(true)
    try {
      await onCreate(data)
      toast.success('Team profile created.')
      // B-4: no step-2 route exists; land on the dashboard once the profile saves.
      router.push('/team/dashboard')
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
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
          >
            <div className="relative aspect-[16/9] w-full bg-muted">
              {coverUrl ? (
                // A-2: `fill` inherits the wrapper's 16:9 box, which already
                // reserves the footprint — the preview cannot shift the form.
                // `onUploaded` only ever yields a stored URL, never a blob.
                <Image
                  src={coverUrl}
                  alt={`${teamName || 'Your team'} cover`}
                  fill
                  sizes="(min-width: 768px) 32rem, 100vw"
                  unoptimized={isRemoteImageSrc(coverUrl)}
                  className="object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-small text-muted-foreground">
                  Cover preview
                </div>
              )}
              <div className="absolute -bottom-6 left-4 size-16 overflow-hidden rounded-full border-4 border-card bg-muted">
                {logoUrl ? (
                  // A-2: explicit 64×64 intrinsic size (the size-16 badge).
                  <Image
                    src={logoUrl}
                    alt={`${teamName || 'Your team'} logo`}
                    width={64}
                    height={64}
                    unoptimized={isRemoteImageSrc(logoUrl)}
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
              'focus-visible:ring-2 focus-visible:ring-ring outline-none'
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
            className="text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring rounded-full outline-none"
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

      {/* Sponsorship needs (spec §5A.2) */}
      <section className="space-y-4">
        <div
          role="group"
          aria-labelledby="seeking-label"
          className="space-y-2"
        >
          <p
            id="seeking-label"
            className="text-medium font-medium text-foreground"
          >
            What is your team seeking?
          </p>
          <CardSelectGroup
            options={SEEKING_OPTIONS}
            value={seeking}
            onChange={setSeeking}
            multiple
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="annual-target">
            Annual Sponsorship Target{' '}
            <span className="text-small text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="annual-target"
            type="number"
            inputMode="numeric"
            min={0}
            value={annualTarget}
            onChange={(e) => setAnnualTarget(e.target.value)}
            placeholder="e.g. 50000"
            aria-describedby="annual-target-help"
          />
          <p id="annual-target-help" className="text-small text-muted-foreground">
            This helps brands understand the scale of partnership you&rsquo;re
            looking for.
          </p>
        </div>

        <PdfUpload
          testId="sponsorship-brief-input"
          label="Sponsorship brief (PDF)"
          subtext="Optional. Brands can review the file details before downloading."
          value={briefDoc}
          onUploaded={setBriefDoc}
          uploadFile={uploadDoc}
        />
      </section>

      {/* What the team offers (spec §5A.3) */}
      <section className="space-y-4">
        <div
          role="group"
          aria-labelledby="offers-label"
          className="space-y-2"
        >
          <p
            id="offers-label"
            className="text-medium font-medium text-foreground"
          >
            What your team offers
          </p>
          <CardSelectGroup
            options={OFFER_OPTIONS}
            value={offerings}
            onChange={setOfferings}
            multiple
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reach-per-post">
            Estimated reach per post{' '}
            <span className="text-small text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="reach-per-post"
            value={reachPerPost}
            onChange={(e) => setReachPerPost(e.target.value)}
            placeholder="e.g. 10k–20k"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Switch
              id="media-pack-toggle"
              aria-label="Media pack available"
              checked={mediaPackEnabled}
              onCheckedChange={(checked: boolean) => setMediaPackEnabled(checked)}
            />
            <Label htmlFor="media-pack-toggle" className="cursor-pointer">
              Media pack available?
            </Label>
          </div>
          {mediaPackEnabled ? (
            <PdfUpload
              testId="media-pack-input"
              label="Media pack (PDF)"
              subtext="Upload your media pack so brands can see your audience and inventory."
              value={mediaPackDoc}
              onUploaded={setMediaPackDoc}
              uploadFile={uploadDoc}
            />
          ) : null}
        </div>
      </section>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Creating…' : 'Create team profile →'}
      </Button>
    </form>
  )
}
