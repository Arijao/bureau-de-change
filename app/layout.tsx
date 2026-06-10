import type { Metadata } from 'next'
import './globals.css'
import { prisma } from '@/lib/prisma'

/**
 * Génération dynamique des métadonnées (Titre et Icône)
 * en fonction des paramètres enregistrés dans la base de données.
 */
export async function generateMetadata(): Promise<Metadata> {
  let bureauName = 'Bureau de Change FX Mada'
  let logoBase64: string | null = null

  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
      select: { bureauName: true, logoBase64: true },
    })
    
    if (settings) {
      bureauName = settings.bureauName || bureauName
      logoBase64 = settings.logoBase64 || null
    }
  } catch (error) {
    console.warn('[generateMetadata] Utilisation des métadonnées par défaut.')
  }

  const metadata: Metadata = {
    title: bureauName,
    description: 'Système de gestion de bureau de change — Madagascar',
  }

  if (logoBase64) {
    metadata.icons = {
      icon: logoBase64,
      apple: logoBase64,
    }
  }

  return metadata
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}