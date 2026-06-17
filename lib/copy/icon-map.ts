import {
  Target,
  Circle,
  BadgeCheck,
  Shield,
  Users,
  Send,
  Wallet,
  Search,
  Zap,
  Megaphone,
  Trophy,
  Bookmark,
  type LucideIcon,
} from "lucide-react"

export const iconMap = {
  target: Target,
  availability: Circle,
  verified: BadgeCheck,
  team: Shield,
  partners: Users,
  proposal: Send,
  payments: Wallet,
  search: Search,
  energy: Zap,
  megaphone: Megaphone,
  trophy: Trophy,
  saved: Bookmark,
} as const satisfies Record<string, LucideIcon>

export type IconConcept = keyof typeof iconMap
