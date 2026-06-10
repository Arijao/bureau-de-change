'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      body: JSON.stringify({ username: fd.get('username'), password: fd.get('password') }),
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
          <div className="login-logo">₵</div>
          <h1 className="login-title">Bureau de Change</h1>
          <p className="login-subtitle">FX Mada · Système de gestion des opérations</p>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">Identifiant</label>
            <input className="form-control" name="username" placeholder="Votre identifiant" required autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Mot de passe</label>
            <input className="form-control" name="password" type="password" placeholder="••••••••" required />
          </div>
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
        <div className="login-demo">
          <div className="demo-label">Comptes de démonstration</div>
          <div className="demo-accounts">
            <div className="demo-account"><div className="demo-role">Administrateur</div><div className="demo-creds">admin / admin123</div></div>
            <div className="demo-account"><div className="demo-role">Caissier</div><div className="demo-creds">caissier / caissier123</div></div>
          </div>
        </div>
      </div>
    </div>
  )
}