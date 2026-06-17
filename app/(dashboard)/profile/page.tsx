import { getSessionUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ChangePasswordForm from '@/components/profile/ChangePasswordForm'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">👤 Mon profil</h1>
        <p className="page-subtitle">Gérer mes informations personnelles</p>
      </div>
      <ChangePasswordForm userName={user.name} />
    </div>
  )
}