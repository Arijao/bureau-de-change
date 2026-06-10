import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, createSession } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  const { username, password } = await req.json()
  const user = await prisma.user.findUnique({ where: { username } })
  if (!user || !user.active) return NextResponse.json({ error: 'Identifiant ou mot de passe incorrect' })
  if (hashPassword(password) !== user.passwordHash) return NextResponse.json({ error: 'Identifiant ou mot de passe incorrect' })
  const token = await createSession(user.id)
  const cookieStore = await cookies()
  cookieStore.set('bdc_session', token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/',
  })
  return NextResponse.json({ ok: true })
}
