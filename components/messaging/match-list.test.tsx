import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import MatchList, { type Conversation } from './match-list'

const convos: Conversation[] = [
  {
    id: 'm-old',
    name: 'Alice Archer',
    avatarUrl: null,
    preview: 'See you at the track meet',
    timestamp: '2026-06-10T09:00:00.000Z',
    unreadCount: 0,
  },
  {
    id: 'm-recent',
    name: 'Bob Brand',
    avatarUrl: 'https://cdn.example.com/bob.jpg',
    preview: 'Can we discuss the proposal?',
    timestamp: '2026-06-15T18:30:00.000Z',
    unreadCount: 3,
  },
]

function names() {
  return screen.getAllByTestId('conversation-name').map((el) => el.textContent)
}

describe('MatchList', () => {
  it('renders avatar, name, preview, timestamp and an unread badge per conversation', () => {
    render(<MatchList conversations={convos} basePath="/athlete/messages" />)

    expect(screen.getByText('Alice Archer')).toBeInTheDocument()
    expect(screen.getByText('Can we discuss the proposal?')).toBeInTheDocument()
    // unread count badge
    expect(screen.getByText('3')).toBeInTheDocument()
    // link points at the conversation route
    const link = screen.getByRole('link', { name: /bob brand/i })
    expect(link).toHaveAttribute('href', '/athlete/messages/m-recent')
  })

  it('sorts by most recent by default and supports oldest / unread sorts', async () => {
    const user = userEvent.setup()
    render(<MatchList conversations={convos} basePath="/athlete/messages" />)

    // default: recent first
    expect(names()).toEqual(['Bob Brand', 'Alice Archer'])

    const sort = screen.getByLabelText(/sort conversations/i)
    await user.selectOptions(sort, 'oldest')
    expect(names()).toEqual(['Alice Archer', 'Bob Brand'])

    await user.selectOptions(sort, 'unread')
    // unread (Bob, 3) ahead of read (Alice, 0)
    expect(names()[0]).toBe('Bob Brand')
  })

  it('filters by name or message content via the search box', async () => {
    const user = userEvent.setup()
    render(<MatchList conversations={convos} basePath="/athlete/messages" />)

    const search = screen.getByRole('searchbox', { name: /search conversations/i })

    await user.type(search, 'alice')
    expect(names()).toEqual(['Alice Archer'])

    await user.clear(search)
    await user.type(search, 'proposal')
    expect(names()).toEqual(['Bob Brand'])
  })

  it('marks unread conversations with a bold name and coloured left border', () => {
    render(<MatchList conversations={convos} basePath="/athlete/messages" />)

    const unreadRow = screen.getByTestId('conversation-m-recent')
    expect(unreadRow).toHaveAttribute('data-unread', 'true')
    const unreadName = within(unreadRow).getByTestId('conversation-name')
    expect(unreadName.className).toMatch(/font-semibold|font-bold/)

    const readRow = screen.getByTestId('conversation-m-old')
    expect(readRow).toHaveAttribute('data-unread', 'false')
  })

  it('archives via right-click (desktop) and removes the conversation from the inbox', async () => {
    const user = userEvent.setup()
    const onArchive = vi.fn().mockResolvedValue(undefined)
    render(
      <MatchList conversations={convos} basePath="/athlete/messages" onArchive={onArchive} />
    )

    const row = screen.getByTestId('conversation-m-recent')
    await user.pointer({ keys: '[MouseRight]', target: row })

    // context action surfaces
    const archive = await screen.findByRole('menuitem', { name: /archive/i })
    await user.click(archive)

    expect(onArchive).toHaveBeenCalledWith('m-recent')
    // optimistically removed from the inbox
    expect(screen.queryByText('Bob Brand')).toBeNull()
  })

  it('shows an empty state when there are no conversations', () => {
    render(<MatchList conversations={[]} basePath="/athlete/messages" />)
    expect(screen.getByText(/your inbox is quiet/i)).toBeInTheDocument()
    expect(screen.getByText(/accept a connection request/i)).toBeInTheDocument()
  })

  it('hides the search and sort controls when the inbox is empty (MSG2)', () => {
    render(<MatchList conversations={[]} basePath="/athlete/messages" />)
    expect(screen.queryByRole('searchbox', { name: /search conversations/i })).toBeNull()
    expect(screen.queryByLabelText(/sort conversations/i)).toBeNull()
  })

  it('renders the empty-inbox actions passed by the surface (MSG1)', () => {
    render(
      <MatchList
        conversations={[]}
        basePath="/athlete/messages"
        emptyInbox={{
          description: 'When you accept a request from a brand or agent, your conversation appears here.',
          primaryAction: { label: 'View connection requests', href: '/athlete/requests' },
          secondaryAction: { label: 'Discover brands', href: '/athlete/discover' },
        }}
      />
    )
    expect(
      screen.getByText(/when you accept a request from a brand or agent/i)
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view connection requests/i })).toHaveAttribute(
      'href',
      '/athlete/requests'
    )
    expect(screen.getByRole('link', { name: /discover brands/i })).toHaveAttribute(
      'href',
      '/athlete/discover'
    )
  })

  it('shows a distinct no-match state naming the query, with a clear-search action (MSG2)', async () => {
    const user = userEvent.setup()
    render(<MatchList conversations={convos} basePath="/athlete/messages" />)

    const search = screen.getByRole('searchbox', { name: /search conversations/i })
    await user.type(search, 'zzz-nobody')

    // distinct copy that quotes the query — not the generic "inbox is quiet"
    expect(screen.getByText(/no conversations match 'zzz-nobody'/i)).toBeInTheDocument()
    expect(screen.queryByText(/your inbox is quiet/i)).toBeNull()
    expect(screen.queryByTestId('conversation-name')).toBeNull()

    // clearing the search restores the full list
    await user.click(screen.getByRole('button', { name: /clear search/i }))
    expect(names()).toEqual(['Bob Brand', 'Alice Archer'])
  })
})
