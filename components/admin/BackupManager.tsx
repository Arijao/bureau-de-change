'use client'

import { useState, useRef } from 'react'
import { listBackupsAction, deleteBackupAction, type BackupFile } from '@/actions/backup.actions'

interface Props {
  initialBackups: BackupFile[]
}

export default function BackupManager({ initialBackups }: Props) {
  const [backups, setBackups] = useState<BackupFile[]>(initialBackups)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [confirmRestore, setConfirmRestore] = useState<File | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<BackupFile | null>(null)
  const [restorePassword, setRestorePassword] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function toast(text: string, type: 'success' | 'error' = 'success') {
    setFeedback({ text, type })
    setTimeout(() => setFeedback(null), 5000)
  }

  async function refreshBackups() {
    const res = await listBackupsAction()
    setBackups(res.backups)
  }

  async function handleExportSqlite() {
    setLoading(true)
    try {
        const res = await fetch('/api/backup', {
        credentials: 'include',
        })
        
        if (!res.ok) {
        const data = await res.json()
        toast(data.error || 'Erreur lors de l\'export', 'error')
        return
        }
        
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `bdc_backup_${new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', 'h')}.db`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        toast('✅ Backup SQLite téléchargé avec succès')
    } catch (error) {
        toast(' Erreur lors du téléchargement', 'error')
    } finally {
        setLoading(false)
    }
    }

    async function handleExportJson() {
    setLoading(true)
    try {
        const res = await fetch('/api/backup/json', {
        credentials: 'include',
        })
        
        if (!res.ok) {
        const data = await res.json()
        toast(data.error || 'Erreur lors de l\'export', 'error')
        return
        }
        
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `bdc_backup_json_${new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', 'h')}.json`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        toast('✅ Backup JSON téléchargé avec succès')
    } catch (error) {
        toast('❌ Erreur lors du téléchargement', 'error')
    } finally {
        setLoading(false)
    }
    }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (!file.name.endsWith('.json')) {
      toast('Seuls les fichiers JSON sont acceptés pour la restauration', 'error')
      return
    }
    
    setConfirmRestore(file)
    setRestorePassword('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function executeRestore() {
    if (!confirmRestore) return
    if (!restorePassword) {
      toast('Veuillez entrer votre mot de passe admin pour confirmer', 'error')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', confirmRestore)
      formData.append('adminPassword', restorePassword)

      const res = await fetch('/api/restore', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        toast(data.error || 'Erreur lors de la restauration', 'error')
      } else {
        toast(
          `✅ ${data.message}\n⚠️ Mot de passe par défaut : ${data.defaultPassword}`,
          'success'
        )
        setConfirmRestore(null)
        setRestorePassword('')
        await refreshBackups()
      }
    } catch (error) {
      toast('Erreur réseau lors de la restauration', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function executeDelete() {
    if (!confirmDelete) return
    setLoading(true)
    const res = await deleteBackupAction(confirmDelete.name)
    setLoading(false)
    
    if (res.error) {
      toast(res.error, 'error')
    } else {
      toast(`Backup "${confirmDelete.name}" supprimé`)
      setConfirmDelete(null)
      await refreshBackups()
    }
  }

  function getTypeIcon(type: BackupFile['type']) {
    switch (type) {
      case 'sqlite': return '🗄️'
      case 'json': return '📄'
      case 'pre-restore': return '🛡️'
    }
  }

  function getTypeLabel(type: BackupFile['type']) {
    switch (type) {
      case 'sqlite': return 'SQLite'
      case 'json': return 'JSON'
      case 'pre-restore': return 'Pré-restauration'
    }
  }

  return (
    <>
      {feedback && (
        <div className={`alert alert-${feedback.type}`} style={{ marginBottom: 16, whiteSpace: 'pre-line' }}>
          {feedback.text}
        </div>
      )}

      {/* ── EXPORT ─────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h2 className="card-title">📤 Exporter une sauvegarde</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          <div className="info-box" style={{ padding: 16 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🗄️</div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>Backup SQLite (binaire)</h3>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
              Copie complète de la base. Idéal pour restauration rapide et sauvegarde technique.
            </p>
            <button className="btn btn-primary" onClick={handleExportSqlite}>
              📥 Télécharger .db
            </button>
          </div>

          <div className="info-box" style={{ padding: 16 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📄</div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>Backup JSON (structuré)</h3>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
              Données lisibles et auditables. Idéal pour archivage, Git et migration.
            </p>
            <button className="btn btn-primary" onClick={handleExportJson}>
              📥 Télécharger .json
            </button>
          </div>
        </div>
      </div>

      {/* ── IMPORT ─────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h2 className="card-title">📥 Restaurer depuis un backup</h2>
        </div>
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          ⚠️ <strong>Attention :</strong> La restauration <strong>remplace intégralement</strong> les données actuelles.
          Un backup de sécurité automatique sera créé avant l'opération.
          Les mots de passe des utilisateurs seront réinitialisés.
        </div>

        <div className="form-group">
          <label className="form-label">Fichier JSON de backup</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="form-control"
            onChange={handleFileSelect}
          />
        </div>
      </div>

      {/* ── LISTE DES BACKUPS ──────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📋 Backups stockés ({backups.length})</h2>
          <button className="btn btn-sm btn-outline" onClick={refreshBackups}>
            🔄 Actualiser
          </button>
        </div>

        {backups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <div>Aucun backup stocké</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Nom</th>
                  <th>Taille</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map(b => (
                  <tr key={b.name}>
                    <td>
                      <span className="chip chip-blue">
                        {getTypeIcon(b.type)} {getTypeLabel(b.type)}
                      </span>
                    </td>
                    <td><code style={{ fontSize: 12 }}>{b.name}</code></td>
                    <td>{b.sizeHuman}</td>
                    <td>{b.createdAtHuman}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <a
                          href={`/backups/${b.name}`}
                          download
                          className="btn btn-sm btn-outline"
                          title="Télécharger"
                        >
                          📥
                        </a>
                        <button
                          className="btn btn-sm btn-outline"
                          style={{ color: 'var(--danger, #e53e3e)' }}
                          onClick={() => setConfirmDelete(b)}
                          title="Supprimer"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL CONFIRMATION RESTAURATION ────────────────────────── */}
      {confirmRestore && (
        <div className="modal-overlay" onClick={() => !loading && setConfirmRestore(null)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">⚠️ Confirmer la restauration</h3>
              <button className="modal-close" onClick={() => setConfirmRestore(null)} disabled={loading}>×</button>
            </div>

            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              <strong>Opération irréversible !</strong> Toutes les données actuelles seront remplacées.
            </div>

            <div className="info-box" style={{ marginBottom: 16 }}>
              <div className="ib-row">
                <span className="ib-label">Fichier</span>
                <span className="ib-value fw-600">{confirmRestore.name}</span>
              </div>
              <div className="ib-row">
                <span className="ib-label">Taille</span>
                <span className="ib-value">{(confirmRestore.size / 1024).toFixed(1)} Ko</span>
              </div>
            </div>

            <div className="alert alert-info" style={{ marginBottom: 16, fontSize: 13 }}>
              🛡️ Un backup de sécurité sera automatiquement créé avant la restauration.
            </div>

            <div className="form-group">
              <label className="form-label">
                🔐 Mot de passe admin (pour confirmer)
              </label>
              <input
                type="password"
                className="form-control"
                autoFocus
                value={restorePassword}
                onChange={e => setRestorePassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && executeRestore()}
                placeholder="Entrez votre mot de passe"
              />
            </div>

            <div className="btn-group mt-16">
              <button
                className="btn btn-danger btn-lg"
                onClick={executeRestore}
                disabled={loading || !restorePassword}
              >
                {loading ? 'Restauration…' : '⚠️ Confirmer la restauration'}
              </button>
              <button className="btn btn-outline" onClick={() => setConfirmRestore(null)} disabled={loading}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIRMATION SUPPRESSION ─────────────────────────── */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => !loading && setConfirmDelete(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">🗑️ Supprimer le backup</h3>
              <button className="modal-close" onClick={() => setConfirmDelete(null)} disabled={loading}>×</button>
            </div>

            <div className="info-box" style={{ marginBottom: 16 }}>
              <div className="ib-row">
                <span className="ib-label">Fichier</span>
                <span className="ib-value fw-600">{confirmDelete.name}</span>
              </div>
              <div className="ib-row">
                <span className="ib-label">Taille</span>
                <span className="ib-value">{confirmDelete.sizeHuman}</span>
              </div>
            </div>

            <div className="btn-group mt-16">
              <button
                className="btn btn-danger btn-lg"
                onClick={executeDelete}
                disabled={loading}
              >
                {loading ? 'Suppression…' : '🗑️ Confirmer'}
              </button>
              <button className="btn btn-outline" onClick={() => setConfirmDelete(null)} disabled={loading}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}