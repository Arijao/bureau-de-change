'use client'

import { useState } from 'react'
import { changeOwnPasswordAction } from '@/actions/settings.actions'

interface Props {
  userName: string
}

export default function ChangePasswordForm({ userName }: Props) {
  const [currentPass,  setCurrentPass]  = useState('')
  const [newPass,      setNewPass]      = useState('')
  const [confirmPass,  setConfirmPass]  = useState('')
  const [msg,     setMsg]     = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (newPass !== confirmPass) {
      setMsg({ text: 'Les nouveaux mots de passe ne correspondent pas', type: 'error' })
      return
    }
    setLoading(true)
    const res = await changeOwnPasswordAction(currentPass, newPass)
    setLoading(false)
    if (res.error) {
      setMsg({ text: res.error, type: 'error' })
    } else {
      setMsg({ text: 'Mot de passe modifié avec succès. Vos autres sessions ont été fermées.', type: 'success' })
      setCurrentPass('')
      setNewPass('')
      setConfirmPass('')
    }
  }

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <div className="card-header">
        <span className="card-icon card-icon-blue">🔑</span>
        <h2 className="card-title">Modifier mon mot de passe</h2>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Connecté en tant que</label>
          <p style={{ fontWeight: 600, margin: 0 }}>{userName}</p>
        </div>
        <div className="form-group">
          <label className="form-label">Mot de passe actuel</label>
          <input
            className="form-control"
            type="password"
            value={currentPass}
            onChange={e => setCurrentPass(e.target.value)}
            placeholder="Mot de passe actuel"
            autoComplete="current-password"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Nouveau mot de passe</label>
          <input
            className="form-control"
            type="password"
            value={newPass}
            onChange={e => setNewPass(e.target.value)}
            placeholder="Minimum 6 caractères"
            autoComplete="new-password"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Confirmer le nouveau mot de passe</label>
          <input
            className="form-control"
            type="password"
            value={confirmPass}
            onChange={e => setConfirmPass(e.target.value)}
            placeholder="Répétez le nouveau mot de passe"
            autoComplete="new-password"
          />
        </div>
        {msg !== null && (
          <div className={`alert ${msg.type === 'success' ? 'alert-success' : 'alert-error'}`}>
            {msg.text}
          </div>
        )}
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={loading || !currentPass || !newPass || !confirmPass}
        >
          {loading ? 'Enregistrement...' : '🔒 Modifier mon mot de passe'}
        </button>
      </div>
    </div>
  )
}