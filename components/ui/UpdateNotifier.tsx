'use client'

import { useEffect, useState } from 'react'

interface UpdateInfo {
  version: string
  releaseDate?: string | null
}

type UpdateState =
  | { status: 'idle' }
  | { status: 'available'; info: UpdateInfo }
  | { status: 'downloading'; percent: number }
  | { status: 'ready' }

export default function UpdateNotifier() {
  const [state, setState] = useState<UpdateState>({ status: 'idle' })
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api) return // navigateur dev : rien à faire

    api.onUpdateAvailable((info: UpdateInfo) => {
      setState({ status: 'available', info })
      setDismissed(false)
    })

    api.onDownloadProgress(({ percent }: { percent: number }) => {
      setState({ status: 'downloading', percent })
    })

    api.onUpdateDownloaded(() => {
      setState({ status: 'ready' })
    })

    return () => { api.removeUpdateListeners?.() }
  }, [])

  if (state.status === 'idle' || dismissed) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 99999,
      background: 'var(--bg, #ffffff)',
      border: '1px solid var(--border, #e5e7eb)',
      borderRadius: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
      padding: '18px 22px',
      minWidth: 320,
      maxWidth: 400,
    }}>

      {/* ── Mise à jour disponible ── */}
      {state.status === 'available' && (
        <>
          <p style={{ fontWeight: 600, margin: '0 0 4px' }}>🆕 Mise à jour disponible</p>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 14px' }}>
            Version {state.info.version} est prête à être téléchargée.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={() => {
                setState({ status: 'downloading', percent: 0 })
                ;(window as any).electronAPI?.installUpdate?.()
              }}
            >
              Mettre à jour
            </button>
            <button className="btn btn-outline" onClick={() => setDismissed(true)}>
              Plus tard
            </button>
          </div>
        </>
      )}

      {/* ── Téléchargement en cours ── */}
      {state.status === 'downloading' && (
        <>
          <p style={{ fontWeight: 600, margin: '0 0 10px' }}>⏬ Téléchargement en cours…</p>
          <div style={{ background: '#f3f4f6', borderRadius: 6, height: 8, overflow: 'hidden' }}>
            <div style={{
              background: 'var(--primary, #2563eb)',
              height: '100%',
              width: `${state.percent}%`,
              transition: 'width 0.3s ease',
              borderRadius: 6,
            }}/>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '6px 0 0', textAlign: 'right' }}>
            {state.percent}%
          </p>
        </>
      )}

      {/* ── Prête à installer ── */}
      {state.status === 'ready' && (
        <>
          <p style={{ fontWeight: 600, margin: '0 0 4px' }}>✅ Mise à jour prête</p>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 14px' }}>
            Redémarrez l'application pour appliquer la mise à jour.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={() => (window as any).electronAPI?.installUpdate?.()}
            >
              Redémarrer maintenant
            </button>
            <button className="btn btn-outline" onClick={() => setDismissed(true)}>
              Plus tard
            </button>
          </div>
        </>
      )}

    </div>
  )
}