import type { Metadata } from 'next'
import './globals.css'
import 'flag-icons/css/flag-icons.min.css'
import { prisma } from '@/lib/prisma'
import { ThemeProvider } from '@/components/ui/ThemeProvider'

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
    // suppressHydrationWarning : nécessaire car data-theme est posé par le script
    // avant l'hydratation React (mismatch attendu et intentionnel)
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Script anti-flash : s'exécute de façon synchrone avant le premier paint */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('theme') ||
              (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            document.documentElement.setAttribute('data-theme', t);
          } catch(e) {}
        `}} />
        <link
          href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}