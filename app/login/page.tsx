'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getLoginSettings } from './actions'
import PasswordInput from '@/components/ui/PasswordInput'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [settings, setSettings] = useState({
    bureauName: 'Bureau de Change',
    logoBase64: null as string | null,
  })

  // Charger les paramètres du bureau
  useEffect(() => {
    getLoginSettings().then(setSettings)
  }, [])

  // Nettoie silencieusement un éventuel cookie de session périmé.
  // Évite la boucle de redirect si un token invalide traîne dans le navigateur.
  useEffect(() => {
    fetch('/api/logout', { method: 'POST' }).catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true); setError('')
    const fd = new FormData(e.currentTarget)
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: fd.get('username'), password }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.error) { setError(data.error); return }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          {/* Logo dynamique */}
          {settings.logoBase64 ? (
            <img 
              src={settings.logoBase64} 
              alt="Logo" 
              className="login-logo"
              style={{
                width: '80px',
                height: '80px',
                objectFit: 'contain',
                borderRadius: '12px',
                backgroundColor: 'white',
                padding: '8px',
                marginBottom: '16px',
              }}
            />
          ) : (
            <div className="login-logo">₵</div>
          )}
          
          {/* Nom dynamique du bureau */}
          <h1 className="login-title">{settings.bureauName}</h1>
          <p className="login-subtitle">Système de gestion des opérations</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">Identifiant</label>
            <input className="form-control" name="username" placeholder="Votre identifiant" required autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Mot de passe</label>
            <PasswordInput
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={loading}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        {/* Section démonstration SUPPRIMÉE */}
      </div>
      <div className="dev-signature">
        <span className="at-symbol">@</span>
        <span className="dev-name">Arijao Rado</span>
      </div>
    </div>
  )
}