import { Suspense } from 'react'
import { getSessionUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getAttestations } from '@/services/attestation.service'
import { getSettings } from '@/services/settings.service'
import AttestationTable from '@/components/ticket/AttestationTable'

export const dynamic = 'force-dynamic'

interface SearchParams {
  dateFrom?: string
  dateTo?:   string
  search?:   string
}

export default async function AttestationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const params = await searchParams

  const [{ attestations, total }, settings] = await Promise.all([
    getAttestations({
      dateFrom: params.dateFrom,
      dateTo:   params.dateTo,
      search:   params.search,
      limit:    100,
    }),
    getSettings(),
  ])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">📄 Historique des attestations</h1>
          <p className="page-subtitle">{total} attestation(s) archivée(s)</p>
        </div>
        <a href="/transactions" className="btn btn-outline btn-sm">
          ← Retour aux transactions
        </a>
      </div>

      <Suspense fallback={<div className="loading">Chargement...</div>}>
        <AttestationTable
          attestations={attestations as any}
          total={total}
          bureauName={settings.bureauName}
          bureauAddress={settings.address}
          bureauPhone={settings.phone}
          bureauFooter={settings.footer}
          bureauNif={settings.nif}
          bureauStat={settings.stat}
          bureauEmail={settings.email}
          bureauRib={settings.rib}
          logoBase64={settings.logoBase64}
        />
      </Suspense>
    </div>
  )
}
