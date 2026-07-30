import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import ConnectRequestButton from './connect-request-button'
import { ROUTES } from '@/lib/routes'
import { CONNECTION_MESSAGE_MIN, CONNECTION_MESSAGE_MAX } from '@/lib/limits'

const toastError = vi.fn()
const toastSuccess = vi.fn()
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m), success: (m: string) => toastSuccess(m) } }))

const track = vi.fn()
vi.mock('@/lib/analytics', () => ({ track: (...args: unknown[]) => track(...args) }))

function renderButton(overrides: Partial<React.ComponentProps<typeof ConnectRequestButton>> = {}) {
  return render(
    <ConnectRequestButton
      recipientUserId="athlete-user-1"
      recipientName="Maya Okafor"
      recipientRole="athlete"
      surface="brand_athlete_detail"
      {...overrides}
    />,
  )
}

/** Opens the dialog and writes a message long enough to be sendable. */
async function composeValidMessage() {
  await userEvent.click(screen.getByRole('button', { name: /send connection request/i }))
  await screen.findByRole('dialog')
  fireEvent.change(screen.getByLabelText(/personalised message/i), {
    target: { value: 'a'.repeat(CONNECTION_MESSAGE_MIN) },
  })
  return screen.getByRole('button', { name: /^send request$/i })
}

describe('ConnectRequestButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 201, json: async () => ({ id: 'cr1' }) })),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // The gap this component closes: a brand could open an athlete or team detail
  // page and the only interactive element was a "Back" link. There was no way to
  // contact anybody through the UI at all.
  it('offers a send action', () => {
    renderButton()
    expect(screen.getByRole('button', { name: /send connection request/i })).toBeInTheDocument()
  })

  it('posts the recipient user id and the trimmed message to the connections API', async () => {
    renderButton()
    const send = await composeValidMessage()
    await userEvent.click(send)

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(url).toBe(ROUTES.api.discovery.connections)
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    // Must be the recipient's *user* id: connection_requests.recipient_id is an
    // FK to users, so a profile id violates it.
    expect(body.recipient_id).toBe('athlete-user-1')
    expect(body.message).toHaveLength(CONNECTION_MESSAGE_MIN)
  })

  it('enforces the shared message bounds rather than its own', async () => {
    renderButton()
    await userEvent.click(screen.getByRole('button', { name: /send connection request/i }))
    await screen.findByRole('dialog')
    const send = screen.getByRole('button', { name: /^send request$/i })
    expect(send).toBeDisabled()

    const textarea = screen.getByLabelText(/personalised message/i)
    fireEvent.change(textarea, { target: { value: 'a'.repeat(CONNECTION_MESSAGE_MIN - 1) } })
    expect(send).toBeDisabled()

    fireEvent.change(textarea, { target: { value: 'a'.repeat(CONNECTION_MESSAGE_MIN) } })
    expect(send).toBeEnabled()
  })

  it('reports the send to analytics without the message or recipient id', async () => {
    renderButton({ recipientRole: 'team', surface: 'brand_team_detail' })
    const send = await composeValidMessage()
    await userEvent.click(send)

    await waitFor(() => expect(track).toHaveBeenCalled())
    const [event, payload] = track.mock.calls[0] as [string, Record<string, unknown>]
    expect(event).toBe('connection_request_sent')
    expect(payload).toEqual({ recipient_role: 'team', surface: 'brand_team_detail' })
  })

  describe('failures always reach the user', () => {
    it('surfaces the API error message', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: false,
          status: 409,
          json: async () => ({ error: { code: 'DUPLICATE_REQUEST', message: 'Already sent' } }),
        })),
      )
      renderButton()
      await userEvent.click(await composeValidMessage())
      await waitFor(() => expect(toastError).toHaveBeenCalledWith('Already sent'))
    })

    // The failure mode that made the original bug invisible: an empty non-JSON
    // body makes res.json() throw before res.ok can be checked, and an unguarded
    // handler swallows it, so the user is told nothing.
    it('still explains itself when the body is not JSON', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: false,
          status: 500,
          json: async () => {
            throw new SyntaxError('Unexpected end of JSON input')
          },
        })),
      )
      renderButton()
      await userEvent.click(await composeValidMessage())
      await waitFor(() => expect(toastError).toHaveBeenCalled())
      expect(toastSuccess).not.toHaveBeenCalled()
    })

    it('explains itself when the request never completes', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
      renderButton()
      await userEvent.click(await composeValidMessage())
      await waitFor(() => expect(toastError).toHaveBeenCalled())
    })
  })

  it('explains why instead of offering a dead action when unavailable', () => {
    renderButton({ unavailableReason: 'Maya Okafor is browsing only right now.' })
    expect(screen.queryByRole('button', { name: /send connection request/i })).not.toBeInTheDocument()
    expect(screen.getByText(/browsing only right now/i)).toBeInTheDocument()
  })
})
