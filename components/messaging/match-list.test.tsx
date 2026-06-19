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
    expect(screen.getByText(/no conversations yet/i)).toBeInTheDocument()
  })
})
