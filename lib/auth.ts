import { createHash, randomBytes } from 'crypto'
import { prisma } from './prisma'
import { cookies } from 'next/headers'

export function hashPassword(password: string): string {
  return createHash('sha256').update(password + 'bdc_salt').digest('hex')
}

export function generateToken(): string {
  return randomBytes(32).toString('hex')
}

export async function createSession(userId: string) {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000 * 7) // 7 jours
  await prisma.session.create({ data: { userId, token, expiresAt } })
  return token
}

export async function getSessionUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('bdc_session')?.value
  if (!token) return null
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  })
  // Session expirée : nettoyer silencieusement
  if (!session) return null
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { token } }).catch(() => {})
    return null
  }
  return session.user
}

/**
 * Récupère le token de la session courante (depuis le cookie).
 * Utilisé pour préserver la session lors du changement de son propre mot de passe.
 */
export async function getCurrentToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('bdc_session')?.value ?? null
}

export async function deleteSession(token: string) {
  await prisma.session.deleteMany({ where: { token } })
}

/**
 * Supprime toutes les sessions d'un utilisateur SAUF la session courante.
 * Utilisé quand l'admin change son propre mot de passe.
 */
export async function deleteOtherSessions(userId: string, keepToken: string) {
  await prisma.session.deleteMany({
    where: { userId, NOT: { token: keepToken } },
  })
}

/**
 * Supprime TOUTES les sessions d'un utilisateur.
 * Utilisé quand l'admin change le mot de passe d'un autre utilisateur.
 */
export async function deleteAllUserSessions(userId: string) {
  await prisma.session.deleteMany({ where: { userId } })
}
/**
 * Régénère la session courante après un changement de mot de passe sur son propre compte.
 * Supprime l'ancien token, crée un nouveau, réécrit le cookie.
 * Évite la boucle redirect → /login causée par revalidatePath + middleware.
 */
export async function renewSession(userId: string, oldToken: string): Promise<void> {
  const cookieStore = await cookies()

  // Supprimer l'ancienne session
  await prisma.session.deleteMany({ where: { token: oldToken } })

  // Créer une nouvelle session avec un nouveau token
  const newToken = generateToken()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000 * 7) // 7 jours
  await prisma.session.create({ data: { userId, token: newToken, expiresAt } })

  // Réécrire le cookie avec le nouveau token — le middleware le trouvera valide
  cookieStore.set('bdc_session', newToken, {
    httpOnly: true,
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })
}

/**
 * Vérifie les credentials d'un admin pour l'override depuis un poste caissier.
 * Retourne l'objet User admin si valide, null sinon.
 * Ne crée pas de session — utilisé uniquement pour valider une action ponctuelle.
 */
export async function verifyAdminCredentials(
  username: string,
  password: string
): Promise<{ id: string; name: string; role: string } | null> {
  if (!username || !password) return null
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase().trim() },
    select: { id: true, name: true, role: true, passwordHash: true, active: true },
  })
  if (!user || !user.active || user.role !== 'ADMIN') return null
  if (hashPassword(password) !== user.passwordHash) return null
  return { id: user.id, name: user.name, role: user.role }
}
