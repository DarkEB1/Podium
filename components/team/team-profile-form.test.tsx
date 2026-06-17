import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import TeamProfileForm from './team-profile-form'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

// athlete_level enum (types/database.ts) — the competition-level list must cover
// every value (spec §5A.1: "expanded level list").
const ATHLETE_LEVELS = [
  'recreational',
  'amateur',
  'semi_professional',
  'professional',
  'international',
  'university_bucs',
  'academy',
  'national',
]

function setup(onCreate = vi.fn().mockResolvedValue({ id: 't1' })) {
  render(<TeamProfileForm onCreate={onCreate} />)
  return { onCreate }
}

describe('TeamProfileForm (TM1)', () => {
  it('renders mandatory logo and cover uploads', () => {
    setup()
    expect(screen.getByRole('group', { name: /logo/i })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /cover/i })).toBeInTheDocument()
  })

  it('renders a public-header preview of the team', () => {
    setup()
    expect(screen.getByTestId('team-header-preview')).toBeInTheDocument()
  })

  it('renders a searchable sport combobox and an optional secondary sport', () => {
    setup()
    expect(screen.getByLabelText(/primary sport/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/secondary sport/i)).toBeInTheDocument()
  })

  it('offers a competition level for every athlete_level enum value', () => {
    setup()
    const select = screen.getByLabelText(/competition level/i)
    const values = Array.from(
      select.querySelectorAll('option')
    ).map((o) => (o as HTMLOptionElement).value)
    for (const level of ATHLETE_LEVELS) {
      expect(values).toContain(level)
    }
  })

  it('constrains year founded between 1800 and the current year', () => {
    setup()
    const year = screen.getByLabelText(/year founded/i) as HTMLInputElement
    expect(year).toHaveAttribute('type', 'number')
    expect(year).toHaveAttribute('min', '1800')
    expect(year).toHaveAttribute('max', String(new Date().getFullYear()))
  })

  it('shows a live 0/500 character counter and a help tooltip for the bio', async () => {
    setup()
    expect(screen.getByText(/0\/500 characters/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /about the bio/i })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/short bio/i), 'Hello')
    expect(screen.getByText(/5\/500 characters/i)).toBeInTheDocument()
  })

  it('blocks creation until team name, logo, and cover are provided', async () => {
    const { onCreate } = setup()
    await userEvent.click(screen.getByRole('button', { name: /create team profile/i }))
    expect(onCreate).not.toHaveBeenCalled()
    expect(await screen.findByText(/logo is required/i)).toBeInTheDocument()
    expect(screen.getByText(/cover.*required/i)).toBeInTheDocument()
  })

  it('creates the team profile via onCreate when required fields are present', async () => {
    const onCreate = vi
      .fn<(data: Record<string, unknown>) => Promise<{ id: string }>>()
      .mockResolvedValue({ id: 't1' })
    render(
      <TeamProfileForm
        onCreate={onCreate}
        initialLogoUrl="https://cdn/logo.png"
        initialCoverUrl="https://cdn/cover.png"
      />
    )
    await userEvent.type(screen.getByLabelText(/team name/i), 'Riverside FC')
    await userEvent.click(screen.getByRole('button', { name: /create team profile/i }))
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    expect(onCreate.mock.calls[0]![0]).toMatchObject({
      team_name: 'Riverside FC',
      logo_url: 'https://cdn/logo.png',
      cover_photo_url: 'https://cdn/cover.png',
    })
  })
})
