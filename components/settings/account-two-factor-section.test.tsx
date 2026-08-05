import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AccountTwoFactorSection from './account-two-factor-section'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function mockFetch(response: { ok: boolean; body?: unknown }) {
  const fn = vi.fn().mockResolvedValue({
    ok: response.ok,
    json: async () => response.body ?? {},
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('AccountTwoFactorSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // Disabling 2FA now costs a code, exactly as enabling it does: a hijacked
  // session could otherwise strip the second factor in a single request.
  it('does not disable straight from the button, it asks for a code first', async () => {
    const fetchMock = mockFetch({ ok: true })
    render(<AccountTwoFactorSection enabled />)

    await userEvent.click(screen.getByRole('button', { name: /turn off 2fa/i }))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/authentication code/i)).toBeInTheDocument()
  })

  it('sends the code to the disable endpoint', async () => {
    const fetchMock = mockFetch({ ok: true })
    render(<AccountTwoFactorSection enabled />)

    await userEvent.click(screen.getByRole('button', { name: /turn off 2fa/i }))
    await userEvent.type(screen.getByLabelText(/authentication code/i), '123456')
    await userEvent.click(screen.getByRole('button', { name: /confirm and turn off/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }]
    expect(url).toBe('/api/account/2fa/disable')
    expect(JSON.parse(init.body)).toEqual({ token: '123456' })
  })

  it('shows the server message and stays enabled on a rejected code', async () => {
    mockFetch({ ok: false, body: { error: { message: 'That code is not valid.' } } })
    render(<AccountTwoFactorSection enabled />)

    await userEvent.click(screen.getByRole('button', { name: /turn off 2fa/i }))
    await userEvent.type(screen.getByLabelText(/authentication code/i), '000000')
    await userEvent.click(screen.getByRole('button', { name: /confirm and turn off/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/not valid/i)
  })

  it('can be cancelled without disabling anything', async () => {
    const fetchMock = mockFetch({ ok: true })
    render(<AccountTwoFactorSection enabled />)

    await userEvent.click(screen.getByRole('button', { name: /turn off 2fa/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /turn off 2fa/i })).toBeInTheDocument()
  })

  it('offers enrolment when 2FA is off', () => {
    mockFetch({ ok: true })
    render(<AccountTwoFactorSection enabled={false} />)
    expect(screen.getByRole('button', { name: /enable 2fa/i })).toBeInTheDocument()
  })
})
