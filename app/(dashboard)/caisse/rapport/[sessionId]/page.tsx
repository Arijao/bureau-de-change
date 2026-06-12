// app/(dashboard)/caisse/rapport/[sessionId]/page.tsx
// Server Component — charge le rapport complet et le passe au composant d'affichage

import { getSessionUser }   from '@/lib/auth'
import { redirect }         from 'next/navigation'
import { getSessionReport } from '@/services/cash-session.service'
import { getSettings }      from '@/services/settings.service'
import CashSessionReport    from '@/components/caisse/CashSessionReport'
import Link                 from 'next/link'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ sessionId: string }>
}

export default async function SessionReportPage({ params }: Props) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const { sessionId } = await params
  try {
    const [report, settings] = await Promise.all([
      getSessionReport(sessionId),
      getSettings(),
    ])

    return (
      <div className="page-container">
        <CashSessionReport
          report={JSON.parse(JSON.stringify(report))}
          bureauName={settings.bureauName}
        />
      </div>
    )
  } catch (e: any) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">Rapport de session</h1>
        </div>
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 8, padding: '16px 20px', color: '#dc2626',
        }}>
          <strong>Erreur :</strong> {e.message}
        </div>
        <div style={{ marginTop: 16 }}>
          <Link href="/caisse/historique" className="btn btn-secondary">
            ← Retour à l'historique
          </Link>
        </div>
      </div>
    )
  }
}
