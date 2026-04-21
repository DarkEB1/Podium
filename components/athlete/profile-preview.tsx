import type { Database } from '@/types/database'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']
type SocialAccounts = { instagram?: string; tiktok?: string; youtube?: string; twitter?: string }

interface Props { profile: AthleteRow }

export default function ProfilePreview({ profile }: Props) {
  const social = (profile.social_accounts ?? {}) as SocialAccounts

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted text-2xl font-bold">
          {(profile.display_name ?? '?')[0]?.toUpperCase() ?? '?'}
        </div>
        <div>
          <h2 className="text-xl font-bold">{profile.display_name}</h2>
          <p className="text-muted-foreground text-sm">
            {[profile.primary_sport, profile.level?.replace('_', ' ')].filter(Boolean).join(' · ')}
          </p>
          <p className="text-muted-foreground text-sm">
            {[profile.home_city, profile.home_country].filter(Boolean).join(', ')}
          </p>
        </div>
      </div>

      {profile.notable_achievements && (
        <div>
          <h3 className="text-sm font-semibold mb-1">Achievements</h3>
          <p className="text-sm text-muted-foreground">{profile.notable_achievements}</p>
        </div>
      )}

      {(social.instagram || social.tiktok || social.youtube || social.twitter) && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Social</h3>
          <div className="flex flex-wrap gap-2">
            {social.instagram && <a href={social.instagram} target="_blank" rel="noopener noreferrer" className="text-xs underline">Instagram</a>}
            {social.tiktok && <a href={social.tiktok} target="_blank" rel="noopener noreferrer" className="text-xs underline">TikTok</a>}
            {social.youtube && <a href={social.youtube} target="_blank" rel="noopener noreferrer" className="text-xs underline">YouTube</a>}
            {social.twitter && <a href={social.twitter} target="_blank" rel="noopener noreferrer" className="text-xs underline">X / Twitter</a>}
          </div>
        </div>
      )}

      {profile.seeking.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Seeking</h3>
          <div className="flex flex-wrap gap-2">
            {profile.seeking.map((s) => (
              <span key={s} className="rounded-full bg-muted px-3 py-1 text-xs">{s.replace('_', ' ')}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
