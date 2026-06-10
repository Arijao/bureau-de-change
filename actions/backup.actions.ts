'use server'

import { getSessionUser } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

export interface BackupFile {
  name: string
  size: number
  sizeHuman: string
  createdAt: string
  createdAtHuman: string
  type: 'sqlite' | 'json' | 'pre-restore'
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('fr-FR', { 
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export async function listBackupsAction(): Promise<{ backups: BackupFile[]; error?: string }> {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') {
    return { backups: [], error: 'Accès refusé' }
  }

  try {
    const backupDir = path.join(process.cwd(), 'backups')
    if (!fs.existsSync(backupDir)) {
      return { backups: [] }
    }

    const files = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.db') || f.endsWith('.json'))
      .map(name => {
        const filePath = path.join(backupDir, name)
        const stat = fs.statSync(filePath)
        
        let type: BackupFile['type'] = 'json'
        if (name.endsWith('.db')) type = 'sqlite'
        else if (name.startsWith('pre_restore_')) type = 'pre-restore'

        return {
          name,
          size: stat.size,
          sizeHuman: formatBytes(stat.size),
          createdAt: stat.birthtime.toISOString(),
          createdAtHuman: formatDate(stat.birthtime.toISOString()),
          type,
        }
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return { backups: files }
  } catch (error) {
    console.error('Erreur listage backups:', error)
    return { backups: [], error: 'Impossible de lister les backups' }
  }
}

export async function deleteBackupAction(filename: string): Promise<{ success: boolean; error?: string }> {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') {
    return { success: false, error: 'Accès refusé' }
  }

  // Sécurité : empêcher les attaques par traversal de chemin
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return { success: false, error: 'Nom de fichier invalide' }
  }

  try {
    const filePath = path.join(process.cwd(), 'backups', filename)
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Fichier introuvable' }
    }
    fs.unlinkSync(filePath)
    return { success: true }
  } catch (error) {
    console.error('Erreur suppression backup:', error)
    return { success: false, error: 'Impossible de supprimer le fichier' }
  }
}