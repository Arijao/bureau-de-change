'use server'

import { prisma } from '@/lib/prisma'
import { hashPassword, createSession, deleteSession } from '@/lib/auth'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function loginAction(formData: FormData) {
  const username = formData.get('username') as string
  const password = formData.get('password') as string

  const user = await prisma.user.findUnique({ where: { username } })
  if (!user || !user.active) return { error: 'Identifiant ou mot de passe incorrect' }

  const hash = hashPassword(password)
  if (hash !== user.passwordHash) return { error: 'Identifiant ou mot de passe incorrect' }

  const token = await createSession(user.id)
  const cookieStore = await cookies()
  cookieStore.set('bdc_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  redirect('/dashboard')
}

export async function logoutAction() {
  const cookieStore = await cookies()
  const token = cookieStore.get('bdc_session')?.value
  if (token) await deleteSession(token)
  cookieStore.delete('bdc_session')
  redirect('/login')
}
