'use client'

import { useRef } from 'react'
import { formatMGA } from '@/lib/utils'

interface Employee {
  id: number
  firstName: string
  lastName: string
  cin: string | null
  position: string | null
  department: string | null
  bankAccount: string | null
}

interface Salary {
  id: number
  month: number
  year: number
  baseSalary: number
  bonuses: number
  deductions: number
  netSalary: number
  cnapsEmployee: number  // NOUVEAU
  cnapsEmployer: number  // NOUVEAU
  note: string | null
  paidAt: Date | null
  createdAt: Date
}

interface Props {
  employee: Employee
  salary: Salary
  onClose: () => void
}

export default function SalarySlip({ employee, salary, onClose }: Props) {
  const slipRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    window.print()
  }

  const monthName = new Date(salary.year, salary.month - 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  })

  const monthNameCapitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1)

  return (
    <div className="salary-slip-overlay" onClick={onClose}>
      <div className="salary-slip-modal" onClick={(e) => e.stopPropagation()}>
        {/* Barre d'actions (cachée à l'impression) */}
        <div className="salary-slip-actions">
          <h2 className="salary-slip-title">📄 Bulletin de paie</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={handlePrint}>
              🖨️ Imprimer / PDF
            </button>
            <button className="btn btn-outline" onClick={onClose}>
              ✕ Fermer
            </button>
          </div>
        </div>

        {/* Contenu du bulletin */}
        <div ref={slipRef} className="salary-slip-content">
          {/* En-tête entreprise */}
          <div className="slip-header">
            <div className="slip-logo">₵</div>
            <div className="slip-company-info">
              <h1>BUREAU DE CHANGE XCHANGE</h1>
              <p>Antananarivo, Madagascar</p>
              <p>Tél : +261 20 22 XXX XX</p>
            </div>
          </div>

          {/* Titre du document */}
          <div className="slip-title-bar">
            <h2>BULLETIN DE PAIE</h2>
            <span className="slip-period">{monthNameCapitalized}</span>
          </div>

          {/* Informations employé */}
          <div className="slip-employee-section">
            <div className="slip-info-grid">
              <div className="slip-info-item">
                <span className="slip-info-label">Nom complet</span>
                <span className="slip-info-value">{employee.lastName} {employee.firstName}</span>
              </div>
              {employee.cin && (
                <div className="slip-info-item">
                  <span className="slip-info-label">CIN</span>
                  <span className="slip-info-value">{employee.cin}</span>
                </div>
              )}
              {employee.position && (
                <div className="slip-info-item">
                  <span className="slip-info-label">Poste</span>
                  <span className="slip-info-value">{employee.position}</span>
                </div>
              )}
              {employee.department && (
                <div className="slip-info-item">
                  <span className="slip-info-label">Service</span>
                  <span className="slip-info-value">{employee.department}</span>
                </div>
              )}
              {employee.bankAccount && (
                <div className="slip-info-item">
                  <span className="slip-info-label">Compte bancaire</span>
                  <span className="slip-info-value">{employee.bankAccount}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tableau de rémunération */}
          <div className="slip-remuneration-section">
            <h3>Détail de la rémunération</h3>
            <table className="slip-table">
              <thead>
                <tr>
                  <th className="slip-th-label">RUBRIQUE</th>
                  <th className="slip-th-amount">MONTANT (Ar)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Salaire de base</td>
                  <td className="slip-amount">{formatMGA(salary.baseSalary)}</td>
                </tr>
                {salary.bonuses > 0 && (
                  <tr className="slip-row-bonus">
                    <td>Primes</td>
                    <td className="slip-amount slip-amount-positive">+ {formatMGA(salary.bonuses)}</td>
                  </tr>
                )}
                {/* CNaPS salariale - NOUVEAU */}
                {(salary.cnapsEmployee || 0) > 0 && (
                  <tr className="slip-row-deduction">
                    <td>CNaPS salariale (1%)</td>
                    <td className="slip-amount slip-amount-negative">- {formatMGA(salary.cnapsEmployee)}</td>
                  </tr>
                )}
                {/* Autres déductions (avances, sanctions, etc.) */}
                {(salary.deductions - (salary.cnapsEmployee || 0)) > 0 && (
                  <tr className="slip-row-deduction">
                    <td>Autres déductions (avances, sanctions)</td>
                    <td className="slip-amount slip-amount-negative">
                      - {formatMGA(salary.deductions - (salary.cnapsEmployee || 0))}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="slip-row-net">
                  <td>NET À PAYER</td>
                  <td className="slip-amount-net">{formatMGA(salary.netSalary)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Cotisations patronales - Section informative - NOUVEAU */}
          {(salary.cnapsEmployer || 0) > 0 && (
            <div className="slip-cnaps-section">
              <h3>Cotisations patronales</h3>
              <div className="slip-info-box">
                <div className="slip-info-row">
                  <span className="slip-info-label">CNaPS patronale (13%)</span>
                  <span className="slip-info-value">{formatMGA(salary.cnapsEmployer)}</span>
                </div>
                <div className="slip-info-row slip-info-total">
                  <span className="slip-info-label">Coût total employeur</span>
                  <span className="slip-info-value">
                    {formatMGA(salary.baseSalary + salary.bonuses + (salary.cnapsEmployer || 0))}
                  </span>
                </div>
              </div>
              <p className="slip-cnaps-note">
                Ces cotisations sont à la charge de l'employeur et ne sont pas déduites du salaire net.
              </p>
            </div>
          )}

          {/* Note */}
          {salary.note && (
            <div className="slip-note">
              <strong>Observations :</strong> {salary.note}
            </div>
          )}

          {/* Pied de page */}
          <div className="slip-footer">
            <div className="slip-footer-row">
              <span>Arrêté le : {new Date(salary.createdAt).toLocaleDateString('fr-FR')}</span>
              {salary.paidAt && (
                <span className="slip-paid-badge">✓ Payé le {new Date(salary.paidAt).toLocaleDateString('fr-FR')}</span>
              )}
            </div>
            <p className="slip-disclaimer">
              Ce bulletin est délivré à titre informatif et fait foi de paiement pour la période indiquée.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        /* Overlay */
        .salary-slip-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        /* Modal avec hauteur maximale */
        .salary-slip-modal {
          background: #fff;
          border-radius: 12px;
          width: 100%;
          max-width: 700px;
          max-height: 90vh; /* ← Hauteur maximale */
          display: flex;
          flex-direction: column; /* ← Layout vertical */
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          overflow: hidden;
        }

        /* Barre d'actions fixe en haut */
        .salary-slip-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
          flex-shrink: 0; /* ← Ne rétrécit pas */
        }

        .salary-slip-title {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
          color: #1a1916;
        }

        /* Contenu scrollable */
        .salary-slip-content {
          padding: 32px;
          background: #fff;
          overflow-y: auto; /* ← Défilement vertical */
          flex: 1; /* ← Prend l'espace restant */
        }

        /* Personnalisation de la scrollbar */
        .salary-slip-content::-webkit-scrollbar {
          width: 8px;
        }

        .salary-slip-content::-webkit-scrollbar-track {
          background: #f1f1f1;
        }

        .salary-slip-content::-webkit-scrollbar-thumb {
          background: #ccc;
          border-radius: 4px;
        }

        .salary-slip-content::-webkit-scrollbar-thumb:hover {
          background: #999;
        }

        /* En-tête entreprise */
        .slip-header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding-bottom: 20px;
          border-bottom: 2px solid #1a5fa8;
          margin-bottom: 24px;
        }

        .slip-logo {
          width: 56px;
          height: 56px;
          background: #1a5fa8;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 28px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .slip-company-info h1 {
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 4px 0;
          color: #1a1916;
          letter-spacing: 0.5px;
        }

        .slip-company-info p {
          font-size: 12px;
          color: #5a5750;
          margin: 2px 0;
        }

        /* Titre du document */
        .slip-title-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f0ede8;
          padding: 12px 20px;
          border-radius: 8px;
          margin-bottom: 24px;
        }

        .slip-title-bar h2 {
          font-size: 16px;
          font-weight: 700;
          margin: 0;
          color: #1a1916;
          letter-spacing: 1px;
        }

        .slip-period {
          font-size: 14px;
          font-weight: 600;
          color: #1a5fa8;
          text-transform: capitalize;
        }

        /* Section employé */
        .slip-employee-section {
          margin-bottom: 24px;
        }

        .slip-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          background: #fafafa;
          padding: 16px;
          border-radius: 8px;
          border: 1px solid #e9ecef;
        }

        .slip-info-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .slip-info-label {
          font-size: 11px;
          color: #9a9690;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 500;
        }

        .slip-info-value {
          font-size: 14px;
          color: #1a1916;
          font-weight: 600;
        }

        /* Section rémunération */
        .slip-remuneration-section {
          margin-bottom: 24px;
        }

        .slip-remuneration-section h3 {
          font-size: 13px;
          font-weight: 600;
          color: #1a1916;
          margin: 0 0 12px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .slip-table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #e0ddd8;
          border-radius: 8px;
          overflow: hidden;
        }

        .slip-table thead {
          background: #1a1916;
          color: #fff;
        }

        .slip-th-label,
        .slip-th-amount {
          padding: 10px 16px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .slip-th-label {
          text-align: left;
        }

        .slip-th-amount {
          text-align: right;
          width: 180px;
        }

        .slip-table tbody td {
          padding: 12px 16px;
          font-size: 14px;
          border-bottom: 1px solid #e9ecef;
        }

        .slip-table tbody td:first-child {
          color: #1a1916;
        }

        .slip-amount {
          text-align: right;
          font-weight: 600;
          font-family: 'Courier New', monospace;
          font-size: 14px;
        }

        .slip-row-bonus td:last-child {
          color: #1d6a4a;
        }

        .slip-row-deduction td:last-child {
          color: #c0392b;
        }

        .slip-amount-positive {
          color: #1d6a4a !important;
        }

        .slip-amount-negative {
          color: #c0392b !important;
        }

        .slip-table tfoot {
          background: #f0ede8;
        }

        .slip-row-net td {
          padding: 16px;
          font-size: 15px;
          font-weight: 700;
          border-top: 2px solid #1a1916;
        }

        .slip-amount-net {
          text-align: right;
          color: #1d6a4a;
          font-family: 'Courier New', monospace;
          font-size: 18px;
          font-weight: 700;
        }

        /* Section cotisations patronales */
        .slip-cnaps-section {
          margin-bottom: 24px;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 8px;
          border: 1px solid #e9ecef;
        }

        .slip-cnaps-section h3 {
          font-size: 13px;
          font-weight: 600;
          color: #1a1916;
          margin: 0 0 12px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .slip-info-box {
          background: white;
          border-radius: 6px;
          padding: 12px;
          border: 1px solid #e0ddd8;
        }

        .slip-info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 0;
          font-size: 13px;
        }

        .slip-info-row:not(:last-child) {
          border-bottom: 1px solid #f0f0f0;
        }

        .slip-info-label {
          color: #5a5750;
        }

        .slip-info-value {
          font-weight: 600;
          color: #1a1916;
          font-family: 'Courier New', monospace;
        }

        .slip-info-total {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 2px solid #1a1916 !important;
          font-weight: 700;
        }

        .slip-info-total .slip-info-label,
        .slip-info-total .slip-info-value {
          color: #1a5fa8;
          font-weight: 700;
        }

        .slip-cnaps-note {
          margin: 12px 0 0 0;
          font-size: 11px;
          color: #9a9690;
          font-style: italic;
        }

        /* Note */
        .slip-note {
          background: #fff8e1;
          border-left: 3px solid #b8720a;
          padding: 12px 16px;
          border-radius: 4px;
          font-size: 13px;
          color: #5a5750;
          margin-bottom: 24px;
        }

        /* Pied de page */
        .slip-footer {
          border-top: 1px solid #e0ddd8;
          padding-top: 16px;
        }

        .slip-footer-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          color: #5a5750;
          margin-bottom: 8px;
        }

        .slip-paid-badge {
          background: #e8f5ef;
          color: #1d6a4a;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
        }

        .slip-disclaimer {
          font-size: 10px;
          color: #9a9690;
          font-style: italic;
          margin: 0;
          text-align: center;
        }

        /* Styles d'impression */
        @media print {
          body * {
            visibility: hidden;
          }
          .salary-slip-overlay,
          .salary-slip-overlay * {
            visibility: visible;
          }
          .salary-slip-overlay {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            padding: 0;
          }
          .salary-slip-modal {
            box-shadow: none;
            max-width: 100%;
            max-height: none;
          }
          .salary-slip-actions {
            display: none !important;
          }
          .salary-slip-content {
            padding: 20px;
            overflow: visible;
          }
        }
      `}</style>
    </div>
  )
}