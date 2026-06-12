import { getSessionUser }       from '@/lib/auth'
import { getSettings }          from '@/services/settings.service'
import { getSessionBanner }     from '@/services/cash-session.service'  // ← AJOUT
import { redirect }             from 'next/navigation'
import { cookies }              from 'next/headers'
import Navbar                   from '@/components/layout/Navbar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) {
    redirect('/login')
  }

  const [settings, sessionBanner] = await Promise.all([   // ← MODIFIÉ (Promise.all)
    getSettings(),
    getSessionBanner(user.id),                             // ← AJOUT
  ])

  return (
    <div className="app-container">
      <Navbar
        user={{ name: user.name, role: user.role }}
        bureauName={settings.bureauName}
        sessionBanner={sessionBanner}                      // ← AJOUT prop
      />
      <main className="main-content">{children}</main>

      {/* Signature développeur */}
      <div className="dev-signature">
        <span className="at-symbol">@</span>
        <span className="dev-name">Arijao Rado</span>
      </div>
    </div>
  )
}