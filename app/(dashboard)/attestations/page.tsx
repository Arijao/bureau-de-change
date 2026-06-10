import { Suspense } from 'react'
import { getSessionUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getAttestations } from '@/services/attestation.service'
import { getSettings } from '@/services/settings.service'
import { prisma } from '@/lib/prisma'
import AttestationForm from '@/components/attestations/AttestationForm'
import AttestationTable from '@/components/attestations/AttestationTable'

export const dynamic = 'force-dynamic'

export default async function AttestationsPage() {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') redirect('/dashboard')
  
  const [attestationsResult, settings, currencies] = await Promise.all([
    getAttestations(),
    getSettings(),
    prisma.currency.findMany({
      where: { isActive: true, code: { not: 'MGA' } },
      orderBy: { code: 'asc' },
      select: { code: true, name: true, flag: true },
    }),
  ])
  
  const attestationRate = settings.attestationRate ?? 100
  
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">📄 Gestion des Attestations</h1>
          <p className="page-subtitle">
            Vente d'attestations de change — Tarif : {attestationRate} Ar/unité
          </p>
        </div>
      </div>
      <AttestationForm attestationRate={attestationRate} currencies={currencies} />
      <Suspense fallback={<div className="loading">Chargement...</div>}>
        <AttestationTable 
          attestations={attestationsResult.attestations} 
          total={attestationsResult.total}
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