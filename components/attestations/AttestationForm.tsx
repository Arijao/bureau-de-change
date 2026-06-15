'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAttestationAction } from '@/actions/attestation.actions'
import { formatMGA } from '@/lib/utils'

interface Currency {
  code: string
  name: string
  flag: string
}

interface Props {
  attestationRate: number
  currencies: Currency[]
}

export default function AttestationForm({ attestationRate, currencies }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [formData, setFormData] = useState({
    clientName: '',
    passportNo: '',
    nationality: '',
    currencyCode: currencies[0]?.code ?? '',
    amount: '',
    destination: '',
    travelNature: '',
    transportTitle: '',
    ticketNo: '',
    departureDate: '',
    returnDate: '',
  })
  
  const amount = parseFloat(formData.amount) || 0
  const totalMGA = amount * attestationRate
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    
    const result = await createAttestationAction({
      clientName: formData.clientName,
      passportNo: formData.passportNo,
      nationality: formData.nationality,
      currencyCode: formData.currencyCode,
      amount: amount,
      attestationRate: attestationRate,
      destination:    formData.destination    || undefined,
      travelNature:   formData.travelNature   || undefined,
      transportTitle: formData.transportTitle || undefined,
      ticketNo:       formData.ticketNo       || undefined,
      departureDate:  formData.departureDate  || undefined,
      returnDate:     formData.returnDate     || undefined,
    })
    
    setLoading(false)
    
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess('✓ Attestation créée et encaissée avec succès')
      setFormData({ clientName: '', passportNo: '', nationality: '', currencyCode: currencies[0]?.code ?? '', amount: '', destination: '', travelNature: '', transportTitle: '', ticketNo: '', departureDate: '', returnDate: '' })
      router.refresh()
      setTimeout(() => setSuccess(''), 3000)
    }
  }
  
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-icon card-icon-blue">📄</span>
        <h2 className="card-title">Nouvelle attestation payante</h2>
      </div>
      
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Nom du client *</label>
            <input
              type="text"
              className="form-control"
              value={formData.clientName}
              onChange={e => setFormData({...formData, clientName: e.target.value})}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">N° Passeport *</label>
            <input
              type="text"
              className="form-control"
              value={formData.passportNo}
              onChange={e => setFormData({...formData, passportNo: e.target.value})}
              required
            />
          </div>
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Nationalité *</label>
            <input
              type="text"
              className="form-control"
              value={formData.nationality}
              onChange={e => setFormData({...formData, nationality: e.target.value})}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Devise *</label>
            <select
              className="form-control"
              value={formData.currencyCode}
              onChange={e => setFormData({...formData, currencyCode: e.target.value})}
              required
            >
              {currencies.map(c => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="form-group">
          <label className="form-label">Montant en devise *</label>
          <input
            type="number"
            className="form-control"
            value={formData.amount}
            onChange={e => setFormData({...formData, amount: e.target.value})}
            min="0"
            step="0.01"
            required
          />
        </div>
        
        <div className="info-box" style={{marginBottom: 16}}>
          <div className="ib-row">
            <span className="ib-label">Tarif unitaire</span>
            <span className="ib-value">{attestationRate} Ar / {formData.currencyCode}</span>
          </div>
          <div className="ib-row">
            <span className="ib-label">Montant à facturer</span>
            <span className="ib-value text-blue">{formatMGA(totalMGA)}</span>
          </div>
        </div>

        <div style={{marginTop: 12, marginBottom: 6, fontWeight: 600, fontSize: 13, color: 'var(--primary,#2563eb)', borderBottom: '1px solid var(--border,#e2e8f0)', paddingBottom: 4}}>
          ✈️ Informations du voyage <span style={{fontWeight: 400, fontSize: 11, color: 'var(--muted,#9ca3af)'}}>(optionnel)</span>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Destination</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ex : Paris, France"
              value={formData.destination}
              onChange={e => setFormData({...formData, destination: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Nature du voyage</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ex : Tourisme, Affaires, Études..."
              value={formData.travelNature}
              onChange={e => setFormData({...formData, travelNature: e.target.value})}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Titre de transport</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ex : Billet d'avion, Train..."
              value={formData.transportTitle}
              onChange={e => setFormData({...formData, transportTitle: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Numéro de billet</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ex : AF1234567890"
              value={formData.ticketNo}
              onChange={e => setFormData({...formData, ticketNo: e.target.value})}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Date de départ</label>
            <input
              type="date"
              className="form-control"
              value={formData.departureDate}
              onChange={e => setFormData({...formData, departureDate: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Date de retour <span style={{color:'var(--muted,#9ca3af)', fontSize:11}}>(facultatif)</span></label>
            <input
              type="date"
              className="form-control"
              value={formData.returnDate}
              onChange={e => setFormData({...formData, returnDate: e.target.value})}
            />
          </div>
        </div>
        
        <div className="btn-group">
          <button type="submit" className="btn btn-primary" disabled={loading || amount <= 0}>
            {loading ? 'Enregistrement...' : '✓ Créer et encaisser'}
          </button>
        </div>
      </form>
    </div>
  )
}