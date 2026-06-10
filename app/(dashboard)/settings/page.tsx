import { getSessionUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getSettings } from '@/services/settings.service'
import { prisma } from '@/lib/prisma'
import SettingsClient from '@/components/settings/SettingsClient'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') redirect('/dashboard')

  const [settings, users] = await Promise.all([
    getSettings(),
    prisma.user.findMany({ select: { id: true, username: true, name: true, role: true, active: true, createdAt: true } }),
  ])

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">⚙️ Paramètres</h1>
        <p className="page-subtitle">Configuration du bureau de change</p>
      </div>
      <SettingsClient settings={settings} users={users} currentUserId={user.id} />
    </div>
  )
}
