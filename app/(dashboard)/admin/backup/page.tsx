import { getSessionUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { listBackupsAction } from '@/actions/backup.actions'
import BackupManager from '@/components/admin/BackupManager'

export const dynamic = 'force-dynamic'

export default async function BackupPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (user.role !== 'ADMIN') redirect('/dashboard')

  const { backups } = await listBackupsAction()

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">💾 Gestion des sauvegardes</h1>
        <p className="page-subtitle">
          Exportez, importez et gérez les sauvegardes de votre base de données
        </p>
      </div>
      <BackupManager initialBackups={backups} />
    </div>
  )
}