'use server'

import { revalidatePath } from 'next/cache'
import {
  getSessionUser,
  getCurrentToken,
  hashPassword,
  deleteAllUserSessions,
  renewSession,
} from '@/lib/auth'
import { updateSettings, updateLogo } from '@/services/settings.service'
import { prisma } from '@/lib/prisma'

export async function updateSettingsAction(data: {
  bureauName?:      string
  address?:         string
  phone?:           string
  footer?:          string
  nif?:             string
  stat?:            string
  email?:           string
  rib?:             string
  bureauPrefix?:    string
  attestationRate?: number   // Tarif attestation en Ar par unité de devise
}) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') return { error: 'Accès refusé' }

  // Validation du préfixe : 2 à 6 caractères alphanumériques si fourni
  if (data.bureauPrefix !== undefined) {
    const p = data.bureauPrefix.trim().toUpperCase()
    if (p.length > 0 && !/^[A-Z0-9]{2,6}$/.test(p)) {
      return { error: 'Le préfixe doit contenir 2 à 6 caractères alphanumériques (ex: TREX)' }
    }
    data.bureauPrefix = p || undefined
  }

  try {
    await updateSettings(data)
    revalidatePath('/', 'layout')
    return { success: true }
  } catch {
    return { error: 'Erreur lors de la sauvegarde' }
  }
}

// ── GESTION UTILISATEURS (ADMIN uniquement) ─────────────────

export async function createUserAction(data: {
  username: string; name: string; role: 'ADMIN' | 'CAISSIER'; password: string
}) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') return { error: 'Accès refusé' }
  if (data.password.length < 6) return { error: 'Mot de passe trop court (6 caractères minimum)' }

  const username = data.username.toLowerCase().trim()
  if (!username || !data.name.trim()) return { error: 'Identifiant et nom requis' }

  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) return { error: `L'identifiant "${username}" est déjà utilisé` }

  try {
    await prisma.user.create({
      data: {
        username,
        name:         data.name.trim(),
        role:         data.role,
        passwordHash: hashPassword(data.password),
      },
    })
    revalidatePath('/settings')
    return { success: true }
  } catch (e: any) {
    return { error: e.message ?? 'Erreur création utilisateur' }
  }
}

/**
 * Changement de mot de passe — deux comportements selon la cible :
 *
 * CAS 1 — Admin change SON PROPRE mot de passe :
 *   → vérification de l'ancien mot de passe requise
 *   → session courante CONSERVÉE (évite la boucle de redirect)
 *   → autres sessions fermées (autres onglets / postes)
 *
 * CAS 2 — Admin change le mot de passe d'un AUTRE utilisateur :
 *   → toutes les sessions de cet utilisateur supprimées
 *   → reconnexion obligatoire pour lui
 */
export async function changePasswordAction(
  userId: string,
  newPassword: string,
  currentPasswordConfirm?: string
) {
  const admin = await getSessionUser()
  if (!admin || admin.role !== 'ADMIN') return { error: 'Accès refusé' }
  if (newPassword.length < 6) return { error: 'Mot de passe trop court (6 caractères minimum)' }

  const isSelf = userId === admin.id

  // Vérification de l'ancien mot de passe obligatoire si l'admin change le sien
  if (isSelf) {
    if (!currentPasswordConfirm) {
      return { error: 'Veuillez confirmer votre mot de passe actuel' }
    }
    const adminRecord = await prisma.user.findUnique({ where: { id: admin.id } })
    if (!adminRecord || hashPassword(currentPasswordConfirm) !== adminRecord.passwordHash) {
      return { error: 'Mot de passe actuel incorrect' }
    }
  }

  try {
    // 1. Mettre à jour le hash
    await prisma.user.update({
      where: { id: userId },
      data:  { passwordHash: hashPassword(newPassword) },
    })

    if (isSelf) {
      // 2a. Régénérer la session courante + fermer toutes les autres
      // renewSession() crée un nouveau token ET réécrit le cookie dans la même
      // réponse HTTP — évite la boucle redirect → /login causée par revalidatePath
      const currentToken = await getCurrentToken()
      if (currentToken) {
        await renewSession(userId, currentToken)
      } else {
        await deleteAllUserSessions(userId)
      }
    } else {
      // 2b. Fermer TOUTES les sessions de l'autre utilisateur
      await deleteAllUserSessions(userId)
    }

    revalidatePath('/settings')
    return { success: true, isSelf }
  } catch (e: any) {
    return { error: e.message ?? 'Erreur changement mot de passe' }
  }
}

export async function toggleUserActiveAction(userId: string) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') return { error: 'Accès refusé' }
  if (userId === user.id) return { error: 'Impossible de désactiver son propre compte' }

  try {
    const target = await prisma.user.findUnique({ where: { id: userId } })
    if (!target) return { error: 'Utilisateur introuvable' }

    const willBeDeactivated = target.active // true = on était actif = on désactive
    await prisma.user.update({ where: { id: userId }, data: { active: !target.active } })

    // Supprimer les sessions uniquement lors d'une désactivation
    if (willBeDeactivated) {
      await deleteAllUserSessions(userId)
    }

    revalidatePath('/settings')
    return { success: true }
  } catch (e: any) {
    return { error: e.message ?? 'Erreur' }
  }
}

// ── MISE À JOUR DU LOGO ───────────────────────────────────────────────────────

export async function updateLogoAction(data: {
  logoBase64: string | null
  logoName:   string | null
}) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') return { error: 'Accès refusé' }

  // Validation taille : base64 d'une image ne doit pas dépasser ~2 Mo
  // (2 Mo binaire ≈ 2.7 Mo en base64 ≈ ~2 800 000 caractères)
  if (data.logoBase64 && data.logoBase64.length > 3_000_000) {
    return { error: 'Logo trop volumineux (maximum 2 Mo)' }
  }

  // Validation format : doit commencer par data:image/
  if (data.logoBase64 && !data.logoBase64.startsWith('data:image/')) {
    return { error: 'Format de fichier invalide (PNG, JPG, SVG ou WebP attendu)' }
  }

  try {
    await updateLogo(data)
    revalidatePath('/', 'layout')
    return { success: true }
  } catch {
    return { error: 'Erreur lors de la sauvegarde du logo' }
  }
}

export async function updateUserAction(
  userId: string,
  data: { name?: string; username?: string }
) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') return { error: 'Accès refusé' }

  const name     = data.name?.trim()
  const username = data.username?.toLowerCase().trim()

  if (!name && !username) return { error: 'Aucune modification fournie' }
  if (name     && name.length < 2)     return { error: 'Le nom doit contenir au moins 2 caractères' }
  if (username && username.length < 3) return { error: "L'identifiant doit contenir au moins 3 caractères" }
  if (username && !/^[a-z0-9._-]+$/.test(username)) {
    return { error: "L'identifiant ne peut contenir que des lettres minuscules, chiffres, points, tirets" }
  }

  try {
    // Vérifier unicité du username si modifié
    if (username) {
      const existing = await prisma.user.findUnique({ where: { username } })
      if (existing && existing.id !== userId) {
        return { error: `L'identifiant "${username}" est déjà utilisé` }
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name     && { name }),
        ...(username && { username }),
      },
    })

    revalidatePath('/settings')
    return { success: true }
  } catch (e: any) {
    return { error: e.message ?? 'Erreur modification utilisateur' }
  }
}