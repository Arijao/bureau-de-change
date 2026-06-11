'use server'
import { prisma } from '@/lib/prisma'

export async function getLoginSettings() {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
      select: { 
        bureauName: true, 
        logoBase64: true,
        address: true,
      },
    })
    
    return {
      bureauName: settings?.bureauName ?? 'Bureau de Change',
      logoBase64: settings?.logoBase64 ?? null,
      address: settings?.address ?? '',
    }
  } catch (error) {
    console.error('[getLoginSettings] Erreur:', error)
    return {
      bureauName: 'Bureau de Change',
      logoBase64: null,
      address: '',
    }
  }
}