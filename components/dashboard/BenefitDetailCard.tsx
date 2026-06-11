'use client'

import { useState } from 'react'
import { formatMGA } from '@/lib/utils'

interface BenefitDetailCardProps {
  margeSurVentes: number
  attestationRevenues: number
  totalCommissions: number
  totalDepenses: number
  totalSalaires: number
  avancesEnCours: number
  avancesEnCoursCount: number
  totalCnapsEmployer: number
  beneficeEstime: number
}

export default function BenefitDetailCard({
  margeSurVentes,
  attestationRevenues,
  totalCommissions,
  totalDepenses,
  totalSalaires,
  avancesEnCours,
  avancesEnCoursCount,
  totalCnapsEmployer,
  beneficeEstime,
}: BenefitDetailCardProps) {
  const [open, setOpen] = useState(false)

  const totalProduits =
    (margeSurVentes || 0) + (attestationRevenues || 0) + totalCommissions

  return (
    <div className="card">

      {/* En-tête cliquable */}
      <div
        className="card-header"
        onClick={() => setOpen(o => !o)}
        style={{ cursor: 'pointer', userSelect: 'none' }}
        role="button"
        aria-expanded={open}
      >
        <span className="card-icon card-icon-blue">📊</span>
        <h2 className="card-title">Détail du bénéfice net</h2>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 13,
            color: 'var(--text-muted, #888)',
            transition: 'transform 0.2s ease',
            display: 'inline-block',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          ▾
        </span>
      </div>

      {/* Contenu accordéon */}
      {open && (
        <div className="table-responsive">
          <table className="table">
            <tbody>

              <tr>
                <td>Marge sur ventes de devises</td>
                <td className="text-right fw-600 text-green">{formatMGA(margeSurVentes || 0)}</td>
              </tr>
              <tr>
                <td>Revenus attestations payantes</td>
                <td className="text-right fw-600 text-green">{formatMGA(attestationRevenues || 0)}</td>
              </tr>
              <tr>
                <td>Commissions perçues</td>
                <td className="text-right fw-600 text-green">{formatMGA(totalCommissions)}</td>
              </tr>

              <tr style={{ borderTop: '2px solid var(--border)' }}>
                <td className="fw-600">Total produits</td>
                <td className="text-right fw-600 text-green">{formatMGA(totalProduits)}</td>
              </tr>

              <tr>
                <td>Dépenses d&apos;exploitation</td>
                <td className="text-right fw-600 text-red">-{formatMGA(totalDepenses || 0)}</td>
              </tr>
              <tr>
                <td>Salaires bruts (charges de personnel)</td>
                <td className="text-right fw-600 text-red">-{formatMGA(totalSalaires || 0)}</td>
              </tr>

              <tr style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)' }}>
                <td>
                  <span className="text-muted fs-12">⚠️ </span>
                  Avances en cours (non régularisées)
                  <div className="text-muted fs-11">
                    {avancesEnCoursCount} avance(s) en attente de paie
                  </div>
                </td>
                <td className="text-right fw-600 text-amber">
                  {formatMGA(avancesEnCours || 0)}
                </td>
              </tr>

              <tr>
                <td>CNaPS patronal</td>
                <td className="text-right fw-600 text-red">-{formatMGA(totalCnapsEmployer || 0)}</td>
              </tr>

              <tr style={{ borderTop: '2px solid var(--border)', backgroundColor: 'var(--bg2)' }}>
                <td className="fw-700">BÉNÉFICE NET</td>
                <td className={`text-right fw-700 ${beneficeEstime >= 0 ? 'text-green' : 'text-red'}`}>
                  {formatMGA(beneficeEstime)}
                </td>
              </tr>

            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}
