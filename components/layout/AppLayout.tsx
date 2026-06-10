import { getSessionUser } from '@/lib/auth'
import { getSettings } from '@/services/settings.service'
import Navbar from './Navbar'
import { redirect } from 'next/navigation'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const settings = await getSettings()

  return (
    <div className="app-container">
      <Navbar user={{ name: user.name, role: user.role }} bureauName={settings.bureauName} />
      <main className="main-content">{children}</main>
    </div>
  )
}
