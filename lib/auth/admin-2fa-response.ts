import { NextResponse } from 'next/server'
import { ADMIN_2FA_COOKIE, ADMIN_2FA_TTL_MS, signAdmin2faCookie } from './admin-2fa-cookie'

/** Attach a freshly signed 2FA-passed cookie to a response (2.4). */
export async function attachAdmin2faCookie(res: NextResponse, userId: string): Promise<NextResponse> {
  res.cookies.set(ADMIN_2FA_COOKIE, await signAdmin2faCookie(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: Math.floor(ADMIN_2FA_TTL_MS / 1000),
  })
  return res
}
