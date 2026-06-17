import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import TeamProfileForm from './team-profile-form'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

// jsdom lacks PointerEvent / pointer-capture, which Base UI's Switch relies on.
// Provide minimal shims so switch clicks dispatch in tests.
if (typeof (globalThis as { PointerEvent?: unknown }).PointerEvent === 'undefined') {
  ;(globalThis as { PointerEvent: unknown }).PointerEvent =
    class extends MouseEvent {} as unknown
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
}

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
  const uploadDoc = vi.fn().mockResolvedValue('https://cdn/doc.pdf')
  render(<TeamProfileForm onCreate={onCreate} uploadDoc={uploadDoc} />)
  return { onCreate, uploadDoc }
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

describe('TeamProfileForm (TM2) — sponsorship needs & offers', () => {
  it('renders the sponsorship-needs as card-select tiles, not plain checkboxes', () => {
    setup()
    const seeking = screen.getByRole('group', { name: /what.*team.*seeking/i })
    expect(seeking).toBeInTheDocument()
    // Tiles are buttons (CardSelectGroup), never raw checkbox inputs.
    expect(within(seeking).queryAllByRole('checkbox')).toHaveLength(0)
    expect(within(seeking).getAllByRole('button').length).toBeGreaterThan(1)
  })

  it('relabels the value field to "Annual Sponsorship Target" with helper text', () => {
    setup()
    expect(screen.getByLabelText(/annual sponsorship target/i)).toBeInTheDocument()
    expect(
      screen.getByText(/helps brands understand the scale of partnership/i)
    ).toBeInTheDocument()
  })

  it('shows the sponsorship brief file name, size and upload date after upload', async () => {
    setup()
    const input = screen.getByTestId('sponsorship-brief-input') as HTMLInputElement
    const file = new File(['x'.repeat(2048)], 'brief.pdf', {
      type: 'application/pdf',
    })
    await userEvent.upload(input, file)
    expect(await screen.findByText('brief.pdf')).toBeInTheDocument()
    expect(screen.getByText(/2(\.0)? KB/i)).toBeInTheDocument()
    expect(screen.getByText(/uploaded/i)).toBeInTheDocument()
  })

  it('renders what the team offers as a two-column icon checklist', () => {
    setup()
    const offers = screen.getByRole('group', { name: /what.*team offers/i })
    expect(offers).toBeInTheDocument()
    expect(within(offers).getAllByRole('button').length).toBeGreaterThan(1)
  })

  it('provides an estimated reach per post field', () => {
    setup()
    expect(screen.getByLabelText(/estimated reach per post/i)).toBeInTheDocument()
  })

  it('reveals a media-pack PDF upload only when the toggle is on', async () => {
    setup()
    expect(screen.queryByTestId('media-pack-input')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('switch', { name: /media pack available/i }))
    expect(await screen.findByTestId('media-pack-input')).toBeInTheDocument()
  })

  it('includes sponsorship & offer fields in the onCreate payload', async () => {
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

    const seeking = screen.getByRole('group', { name: /what.*team.*seeking/i })
    await userEvent.click(within(seeking).getAllByRole('button')[0]!)

    const offers = screen.getByRole('group', { name: /what.*team offers/i })
    await userEvent.click(within(offers).getAllByRole('button')[0]!)

    await userEvent.type(
      screen.getByLabelText(/annual sponsorship target/i),
      '50000'
    )
    await userEvent.type(
      screen.getByLabelText(/estimated reach per post/i),
      '10k-20k'
    )

    await userEvent.click(
      screen.getByRole('button', { name: /create team profile/i })
    )
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    const payload = onCreate.mock.calls[0]![0] as Record<string, unknown>
    expect((payload.seeking_sponsorship_types as string[]).length).toBe(1)
    expect(payload.annual_sponsorship_target).toBe(50000)
    expect(payload.offers_to_sponsors).toMatchObject({
      estimated_reach_per_post: '10k-20k',
    })
    expect(
      ((payload.offers_to_sponsors as { offerings: string[] }).offerings).length
    ).toBe(1)
  })
})
