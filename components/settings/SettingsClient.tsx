'use client'
import { useState } from 'react'
import {
  updateSettingsAction, createUserAction, changePasswordAction,
  toggleUserActiveAction, updateLogoAction, updateUserAction,
  resetAllDataAction,
} from '@/actions/settings.actions'

interface UserRow { id: string; username: string; name: string; role: string; active: boolean; createdAt: Date }
interface Props {
  settings: {
    bureauName: string; address: string; phone: string; footer: string
    nif?: string | null; stat?: string | null; email?: string | null; rib?: string | null
    logoBase64?: string | null; logoName?: string | null
    bureauPrefix?: string | null
    attestationRate?: number   // Tarif attestation en Ar par unité de devise
  }
  users: UserRow[]
  currentUserId: string
}

type UserModal = null | { mode: 'create' } | { mode: 'password'; user: UserRow } | { mode: 'edit'; user: UserRow }

export default function SettingsClient({ settings, users: initUsers, currentUserId }: Props) {
  const [bureauName, setBureauName] = useState(settings.bureauName)
  const [address, setAddress]       = useState(settings.address)
  const [phone, setPhone]           = useState(settings.phone)
  const [footer, setFooter]         = useState(settings.footer)
  const [nif,   setNif]             = useState(settings.nif   ?? '')
  const [stat,  setStat]            = useState(settings.stat  ?? '')
  const [email, setEmail]           = useState(settings.email ?? '')
  const [rib,   setRib]             = useState(settings.rib   ?? '')
  const [bureauPrefix, setBureauPrefix] = useState(settings.bureauPrefix ?? '')
  const [attestationRate, setAttestationRate] = useState(settings.attestationRate ?? 100)
  const [settingsMsg, setSettingsMsg] = useState('')
  const [settingsLoading, setSettingsLoading] = useState(false)

  // ── Logo ───────────────────────────────────────────────────────────────────
  const [logoBase64,   setLogoBase64]   = useState<string | null>(settings.logoBase64 ?? null)
  const [logoName,     setLogoName]     = useState<string | null>(settings.logoName   ?? null)
  const [logoPreview,  setLogoPreview]  = useState<string | null>(settings.logoBase64 ?? null)
  const [logoDirty,    setLogoDirty]    = useState(false)
  const [logoMsg,      setLogoMsg]      = useState('')
  const [logoLoading,  setLogoLoading]  = useState(false)

  const [users, setUsers] = useState(initUsers)
  const [userModal, setUserModal] = useState<UserModal>(null)
  const [userMsg, setUserMsg]     = useState<{text:string;type:'success'|'error'}|null>(null)
  const [loading, setLoading]     = useState(false)

  // Create form
  const [cUsername, setCUsername] = useState('')
  const [cName, setCName]         = useState('')
  const [cRole, setCRole]         = useState<'ADMIN'|'CAISSIER'>('CAISSIER')
  const [cPass, setCPass]         = useState('')

  // ── Reset données ───────────────────────────────────────────────
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [resetChecked, setResetChecked] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMsg, setResetMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Password form
  const [newPass, setNewPass]     = useState('')
  const [currentPass, setCurrentPass] = useState('')
  const [eName, setEName]         = useState('')
  const [eUsername, setEUsername] = useState('')
  const [modalError, setModalError]   = useState('')

  function toast(text: string, type: 'success'|'error' = 'success') {
    setUserMsg({ text, type }); setTimeout(() => setUserMsg(null), 4000)
  }

  async function handleSaveSettings() {
    setSettingsLoading(true)
    const res = await updateSettingsAction({ 
      bureauName, 
      address, 
      phone, 
      footer, 
      nif, 
      stat, 
      email, 
      rib, 
      bureauPrefix,
      attestationRate 
    })
    setSettingsLoading(false)
    setSettingsMsg(res.error ? '❌ ' + res.error : '✓ Paramètres sauvegardés')
    setTimeout(() => setSettingsMsg(''), 3000)
  }

  // ── Gestionnaires logo ────────────────────────────────────────────────────
  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
    if (!allowed.includes(file.type)) {
      setLogoMsg('❌ Format non supporté (PNG, JPG, SVG ou WebP)')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoMsg('❌ Fichier trop volumineux (maximum 2 Mo)')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setLogoPreview(result)
      setLogoBase64(result)
      setLogoName(file.name)
      setLogoDirty(true)
      setLogoMsg('')
    }
    reader.readAsDataURL(file)
  }

  async function handleSaveLogo() {
    setLogoLoading(true)
    const res = await updateLogoAction({ logoBase64, logoName })
    setLogoLoading(false)
    if (!res.error) setLogoDirty(false)
    setLogoMsg(res.error ? '❌ ' + res.error : '✓ Logo sauvegardé')
    setTimeout(() => setLogoMsg(''), 3000)
  }

  async function handleRemoveLogo() {
    setLogoLoading(true)
    const res = await updateLogoAction({ logoBase64: null, logoName: null })
    setLogoLoading(false)
    if (!res.error) {
      setLogoBase64(null); setLogoName(null); setLogoPreview(null); setLogoDirty(false)
    }
    setLogoMsg(res.error ? '❌ ' + res.error : '✓ Logo supprimé')
    setTimeout(() => setLogoMsg(''), 3000)
  }

  async function handleCreateUser() {
    setLoading(true)
    const res = await createUserAction({ username: cUsername, name: cName, role: cRole, password: cPass })
    setLoading(false)
    if (res.error) { toast(res.error, 'error'); return }
    setUserModal(null)
    setCUsername(''); setCName(''); setCRole('CAISSIER'); setCPass('')
    window.location.reload()
  }

  async function handleChangePassword() {
    if (userModal?.mode !== 'password') return
    const isSelf = userModal.user.id === currentUserId
    setLoading(true)
    setModalError('')
    const res = await changePasswordAction(userModal.user.id, newPass, isSelf ? currentPass : undefined)
    setLoading(false)
    if (res.error) { setModalError(res.error); return }
    setUserModal(null); setNewPass(''); setCurrentPass(''); setModalError('')
    toast(isSelf
      ? 'Mot de passe modifié. Vos autres sessions ont été fermées.'
      : `Mot de passe de ${userModal.user.name} modifié. Sessions fermées.`
    )
  }

  async function handleToggleActive(u: UserRow) {
    const res = await toggleUserActiveAction(u.id)
    if (res.error) { toast(res.error, 'error'); return }
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, active: !x.active } : x))
    toast(`${u.name} ${u.active ? 'désactivé' : 'réactivé'}`)
  }

  async function handleUpdateUser() {
    if (userModal?.mode !== 'edit') return
    setLoading(true)
    setModalError('')
    const res = await updateUserAction(userModal.user.id, {
      name:     eName     !== userModal.user.name     ? eName     : undefined,
      username: eUsername !== userModal.user.username ? eUsername : undefined,
    })
    setLoading(false)
    if (res.error) { setModalError(res.error); return }
    setUsers(prev => prev.map(x =>
      x.id === userModal.user.id
        ? { ...x, name: eName || x.name, username: eUsername || x.username }
        : x
    ))
    setUserModal(null)
    toast(`Compte de ${eName || userModal.user.name} modifié`)
  }

  const isSelfPassword = userModal?.mode === 'password' && userModal.user.id === currentUserId

  async function doReset() {
    if (resetConfirmText !== 'REMISE A ZERO' || !resetChecked) return
    setResetLoading(true)
    const res = await resetAllDataAction()
    setResetLoading(false)
    if (res.error) {
      setResetMsg({ text: res.error, type: 'error' })
    } else {
      setShowResetModal(false)
      setResetConfirmText('')
      setResetChecked(false)
      setResetMsg({ text: '✅ Remise à zéro effectuée. La base est prête pour la production.', type: 'success' })
    }
  }

  return (
    <div className="settings-grid">
      {/* ── PARAMÈTRES BUREAU ─────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header"><span className="card-icon">🏪</span><h2 className="card-title">Informations du bureau</h2></div>
        {settingsMsg && <div className={`alert ${settingsMsg.startsWith('✓') ? 'alert-success' : 'alert-error'}`}>{settingsMsg}</div>}
        <div className="form-group"><label className="form-label">Nom du bureau</label><input className="form-control" value={bureauName} onChange={e => setBureauName(e.target.value)}/></div>
        <div className="form-group"><label className="form-label">Adresse</label><input className="form-control" value={address} onChange={e => setAddress(e.target.value)}/></div>
        <div className="form-group"><label className="form-label">Téléphone</label><input className="form-control" value={phone} onChange={e => setPhone(e.target.value)}/></div>
        <div className="form-group"><label className="form-label">Message pied de ticket</label><input className="form-control" value={footer} onChange={e => setFooter(e.target.value)}/></div>

        {/* Section informations officielles */}
        <div className="divider"/>
        <div className="card-subtitle mb-8" style={{display:'flex',alignItems:'center',gap:6}}>
          📄 Informations officielles <span style={{fontSize:11,color:'var(--muted,#9ca3af)',fontWeight:400}}>(pour les attestations de change)</span>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">NIF</label><input className="form-control" placeholder="Numéro d'Identification Fiscale" value={nif} onChange={e => setNif(e.target.value)}/></div>
          <div className="form-group"><label className="form-label">STAT</label><input className="form-control" placeholder="Numéro statistique" value={stat} onChange={e => setStat(e.target.value)}/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Email</label><input className="form-control" type="email" placeholder="contact@bureau.mg" value={email} onChange={e => setEmail(e.target.value)}/></div>
          <div className="form-group"><label className="form-label">RIB</label><input className="form-control" placeholder="Relevé d'identité bancaire" value={rib} onChange={e => setRib(e.target.value)}/></div>
          <div className="form-group">
            <label className="form-label">
              Préfixe attestation
              <span style={{fontSize:11, color:'var(--muted,#9ca3af)', marginLeft:6}}>(ex: TREX — 2 à 6 caractères)</span>
            </label>
            <input
              className="form-control"
              placeholder="Ex: TREX, BDC, FX..."
              value={bureauPrefix}
              onChange={e => setBureauPrefix(e.target.value.toUpperCase().slice(0, 6))}
              maxLength={6}
            />
          </div>
          </div>

          <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              Tarif des attestations (Ar par unité de devise)
              <span style={{fontSize:11, color:'var(--muted,#9ca3af)', marginLeft:6}}>(ex: 100 Ar pour 1 EUR)</span>
            </label>
            <input
              className="form-control"
              type="number"
              step="0.1"
              min="0"
              placeholder="100"
              value={attestationRate}
              onChange={e => setAttestationRate(parseFloat(e.target.value) || 0)}
            />
            <small className="text-muted fs-12">
              Formule : Montant attestation = Valeur devises × Tarif (ex: 1000 EUR × 100 = 100 000 Ar)
            </small>
          </div>
        </div>



        {/* Section logo */}
        <div className="divider"/>
        <div className="card-subtitle mb-8" style={{display:'flex',alignItems:'center',gap:6}}>
          🖼️ Logo du bureau <span style={{fontSize:11,color:'var(--muted,#9ca3af)',fontWeight:400}}>(affiché sur les attestations de change)</span>
        </div>

        {logoMsg && (
          <div className={`alert ${logoMsg.startsWith('✓') ? 'alert-success' : 'alert-error'}`} style={{marginBottom:8}}>
            {logoMsg}
          </div>
        )}

        {logoPreview ? (
          <div style={{
            display:'flex', alignItems:'center', gap:12,
            padding:'10px 14px', borderRadius:6,
            border:'1px solid var(--border,#e2e8f0)',
            background:'var(--surface,#f8fafc)', marginBottom:10,
          }}>
            <img
              src={logoPreview}
              alt="Logo bureau"
              style={{maxHeight:56, maxWidth:140, objectFit:'contain', flexShrink:0}}
            />
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:12, fontWeight:600, color:'var(--foreground,#1a1a1a)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                {logoName ?? 'logo'}
              </div>
              <div style={{fontSize:11, color:'var(--muted,#6b7280)', marginTop:2}}>
                Affiché automatiquement sur les attestations
              </div>
              {logoDirty && (
                <div style={{fontSize:11, color:'var(--warning,#d97706)', marginTop:2}}>
                  ⚠️ Non sauvegardé — cliquez sur « Sauvegarder le logo »
                </div>
              )}
            </div>
            <button
              className="btn btn-sm btn-outline"
              style={{color:'var(--danger,#e53e3e)', flexShrink:0}}
              onClick={handleRemoveLogo}
              disabled={logoLoading}
              title="Supprimer le logo"
            >
              🗑️
            </button>
          </div>
        ) : (
          <div style={{
            padding:'12px 16px', borderRadius:6, marginBottom:10,
            border:'1px dashed var(--border,#e2e8f0)',
            background:'var(--surface,#f8fafc)',
            color:'var(--muted,#9ca3af)', fontSize:12, textAlign:'center',
          }}>
            Aucun logo configuré
          </div>
        )}

        <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:4}}>
          <label style={{
            display:'inline-flex', alignItems:'center', gap:6,
            padding:'6px 14px', borderRadius:6, cursor:'pointer',
            border:'1px solid var(--border,#e2e8f0)',
            background:'var(--surface,#f8fafc)', fontSize:13, fontWeight:500,
          }}>
            📁 {logoPreview ? 'Remplacer' : 'Importer un logo'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              style={{display:'none'}}
              onChange={handleLogoChange}
            />
          </label>

          {logoDirty && (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSaveLogo}
              disabled={logoLoading}
            >
              {logoLoading ? 'Sauvegarde…' : '💾 Sauvegarder le logo'}
            </button>
          )}
        </div>
        <div style={{fontSize:11, color:'var(--muted,#9ca3af)'}}>
          Formats : PNG, JPG, SVG, WebP — Max 2 Mo
        </div>

        {/* Aperçu ticket */}
        <div className="divider"/>
        <div className="card-subtitle mb-8">Aperçu du ticket</div>
        <div className="ticket-preview-mini">
          <div className="tpm-header">{bureauName}</div>
          <div className="tpm-body">
            <div className="tpm-row"><span>Adresse</span><span>{address}</span></div>
            <div className="tpm-row"><span>Tél.</span><span>{phone}</span></div>
            <div className="tpm-footer">{footer}</div>
          </div>
        </div>
        <button className="btn btn-success btn-lg" onClick={handleSaveSettings} disabled={settingsLoading} style={{marginTop:16}}>
          {settingsLoading ? 'Sauvegarde…' : '💾 Sauvegarder'}
        </button>
      </div>

      <div>
        {/* ── GESTION UTILISATEURS ── */}
        <div className="card">
          <div className="card-header">
            <span className="card-icon">👥</span>
            <h2 className="card-title">Utilisateurs ({users.length})</h2>
            <button className="btn btn-primary btn-sm" style={{marginLeft:'auto'}} onClick={() => setUserModal({ mode: 'create' })}>+ Ajouter</button>
          </div>

          {userMsg && <div className={`alert alert-${userMsg.type === 'success' ? 'success' : 'error'}`} style={{marginBottom:12}}>{userMsg.text}</div>}

          <table className="data-table">
            <thead><tr><th>Nom</th><th>Username</th><th>Rôle</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td className="fw-600">
                    {u.name}
                    {u.id === currentUserId && (
                      <span className="chip chip-blue" style={{fontSize:9, marginLeft:6}}>MOI</span>
                    )}
                  </td>
                  <td><code className="code-tag">{u.username}</code></td>
                  <td><span className={`chip ${u.role === 'ADMIN' ? 'chip-blue' : 'chip-amber'}`}>{u.role}</span></td>
                  <td><span className={`chip ${u.active ? 'chip-green' : 'chip-red'}`}>{u.active ? 'Actif' : 'Inactif'}</span></td>
                  <td>
                    <div style={{display:'flex',gap:6}}>
                      <button className="btn btn-sm btn-outline"
                        title="Modifier nom et identifiant"
                        onClick={() => {
                          setEName(u.name)
                          setEUsername(u.username)
                          setModalError('')
                          setUserModal({ mode: 'edit', user: u })
                        }}>
                        ✏️
                      </button>
                      <button className="btn btn-sm btn-outline" title="Changer mot de passe"
                        onClick={() => { setNewPass(''); setCurrentPass(''); setModalError(''); setUserModal({ mode: 'password', user: u }) }}>
                        🔑
                      </button>
                      {u.id !== currentUserId && (
                        <button className={`btn btn-sm ${u.active ? 'btn-outline' : 'btn-success'}`}
                          title={u.active ? 'Désactiver' : 'Réactiver'} onClick={() => handleToggleActive(u)}>
                          {u.active ? '🔒' : '✅'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── BASE DE DONNÉES ── */}
        <div className="card" style={{marginTop:16}}>
          <div className="card-header"><span className="card-icon">🗄️</span><h2 className="card-title">Base de données</h2></div>
          <div className="info-box">
            <div className="ib-row"><span className="ib-label">ORM</span><span className="ib-value">Prisma 5 (SQLite)</span></div>
            <div className="ib-row"><span className="ib-label">Modèles</span><span className="ib-value">User · Currency · ExchangeRate · CashStock · Transaction</span></div>
            <div className="ib-row"><span className="ib-label">Taux</span><span className="ib-value">Historique complet (ExchangeRate)</span></div>
            <div className="ib-row"><span className="ib-label">Stock</span><span className="ib-value">Suivi par devise (CashStock + StockLog)</span></div>
          </div>
          <a href="/api/backup" className="btn btn-outline btn-sm" style={{marginTop:12}}>⬇ Télécharger backup DB</a>
        </div>
      </div>

      {/* ── MODAL : CRÉER UTILISATEUR ── */}
      {userModal?.mode === 'create' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setUserModal(null)}>
          <div className="modal" style={{maxWidth:440}}>
            <div className="modal-header"><h3 className="modal-title">👤 Nouvel utilisateur</h3><button className="modal-close" onClick={() => setUserModal(null)}>×</button></div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Identifiant (username) *</label>
                <input className="form-control" placeholder="jean.rakoto" value={cUsername} onChange={e => setCUsername(e.target.value.toLowerCase())}/>
              </div>
              <div className="form-group">
                <label className="form-label">Nom complet *</label>
                <input className="form-control" placeholder="Jean Rakoto" value={cName} onChange={e => setCName(e.target.value)}/>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Rôle</label>
                <select className="form-control" value={cRole} onChange={e => setCRole(e.target.value as 'ADMIN'|'CAISSIER')}>
                  <option value="CAISSIER">Caissier</option>
                  <option value="ADMIN">Administrateur</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Mot de passe * <span className="text-muted fs-11">(min. 6 caractères)</span></label>
                <input className="form-control" type="password" placeholder="••••••••" value={cPass} onChange={e => setCPass(e.target.value)}/>
              </div>
            </div>
            <div className="btn-group">
              <button className="btn btn-primary" onClick={handleCreateUser} disabled={loading || !cUsername || !cName || !cPass}>{loading ? '…' : 'Créer'}</button>
              <button className="btn btn-outline" onClick={() => setUserModal(null)}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL : CHANGER MOT DE PASSE ── */}
      {userModal?.mode === 'password' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setUserModal(null)}>
          <div className="modal" style={{maxWidth:400}}>
            <div className="modal-header">
              <h3 className="modal-title">🔑 Mot de passe — {userModal.user.name}</h3>
              <button className="modal-close" onClick={() => setUserModal(null)}>×</button>
            </div>
            <div className="alert alert-info" style={{marginBottom:16}}>
              {isSelfPassword
                ? <>Vous modifiez <strong>votre propre mot de passe</strong>. Votre session reste active, vos autres sessions seront fermées.</>
                : <>Les sessions actives de <strong>{userModal.user.name}</strong> seront fermées immédiatement.</>
              }
            </div>
            {modalError && (
              <div className="alert alert-error" style={{marginBottom:12}}>❌ {modalError}</div>
            )}
            {isSelfPassword && (
              <div className="form-group">
                <label className="form-label">Mot de passe actuel *</label>
                <input className="form-control" type="password" placeholder="••••••••" autoFocus
                  value={currentPass}
                  onChange={e => { setCurrentPass(e.target.value); setModalError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
                />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Nouveau mot de passe *</label>
              <input className="form-control" type="password" placeholder="••••••••" autoFocus={!isSelfPassword}
                value={newPass}
                onChange={e => { setNewPass(e.target.value); setModalError('') }}
                onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
              />
            </div>
            <div className="btn-group">
              <button className="btn btn-primary" onClick={handleChangePassword}
                disabled={loading || newPass.length < 6 || (isSelfPassword && currentPass.length < 1)}>
                {loading ? '…' : 'Enregistrer'}
              </button>
              <button className="btn btn-outline" onClick={() => setUserModal(null)}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL : MODIFIER UTILISATEUR ── */}
      {userModal?.mode === 'edit' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setUserModal(null)}>
          <div className="modal" style={{maxWidth:440}}>
            <div className="modal-header">
              <h3 className="modal-title">✏️ Modifier — {userModal.user.name}</h3>
              <button className="modal-close" onClick={() => setUserModal(null)}>×</button>
            </div>
            {modalError && (
              <div className="alert alert-error" style={{marginBottom:12}}>❌ {modalError}</div>
            )}
            <div className="form-group">
              <label className="form-label">Nom complet</label>
              <input className="form-control"
                value={eName}
                onChange={e => { setEName(e.target.value); setModalError('') }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Identifiant (login)
                <span className="text-muted fs-11" style={{marginLeft:6}}>
                  (lettres minuscules, chiffres, points, tirets)
                </span>
              </label>
              <input className="form-control"
                value={eUsername}
                onChange={e => { setEUsername(e.target.value.toLowerCase()); setModalError('') }}
              />
            </div>
            <div className="alert alert-info" style={{marginBottom:12, fontSize:12}}>
              Le mot de passe reste inchangé. Utilisez 🔑 pour le modifier séparément.
            </div>
            <div className="btn-group">
              <button className="btn btn-primary"
                onClick={handleUpdateUser}
                disabled={loading || (!eName.trim() && !eUsername.trim())}>
                {loading ? '…' : 'Enregistrer'}
              </button>
              <button className="btn btn-outline" onClick={() => setUserModal(null)}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Zone dangereuse ── */}
      <div style={{ marginTop: 40, border: '2px solid #dc2626', borderRadius: 10, padding: '24px 28px' }}>
        <h2 style={{ color: '#dc2626', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>⚠️ Zone dangereuse</h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          Supprime toutes les données de test (transactions, taux, attestations, sessions de caisse, charges, logs RH)
          et remet les stocks à zéro. Les utilisateurs, devises, paramètres, fiches employés et plan comptable sont conservés.
        </p>
        {resetMsg && (
          <div className={`alert alert-${resetMsg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 12 }}>
            {resetMsg.text}
          </div>
        )}
        <button className="btn btn-sm" style={{ background: '#dc2626', color: 'white', border: 'none' }}
          onClick={() => { setShowResetModal(true); setResetConfirmText(''); setResetChecked(false) }}>
          🗑️ Remise à zéro des données de test
        </button>
      </div>

      {/* ── Modal confirmation reset ── */}
      {showResetModal && (
        <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
          <div className="modal-content" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: '2px solid #dc2626' }}>
              <h3 className="modal-title" style={{ color: '#dc2626' }}>⚠️ Confirmer la remise à zéro</h3>
              <button className="modal-close" onClick={() => setShowResetModal(false)}>×</button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#991b1b' }}>
                <strong>Cette action est irréversible.</strong> Assurez-vous d'avoir effectué une sauvegarde de la base de données avant de continuer.
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Tapez <strong>REMISE A ZERO</strong> pour confirmer :
                </label>
                <input
                  className="form-input"
                  value={resetConfirmText}
                  onChange={e => setResetConfirmText(e.target.value)}
                  placeholder="REMISE A ZERO"
                  style={{ fontFamily: 'monospace', letterSpacing: 1 }}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={resetChecked} onChange={e => setResetChecked(e.target.checked)}
                  style={{ marginTop: 2, accentColor: '#dc2626' }} />
                <span>J'ai sauvegardé la base de données et je comprends que cette action supprimera définitivement toutes les données de test.</span>
              </label>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline btn-sm" onClick={() => setShowResetModal(false)}>Annuler</button>
                <button
                  className="btn btn-sm"
                  style={{
                    background: resetConfirmText === 'REMISE A ZERO' && resetChecked ? '#dc2626' : '#9ca3af',
                    color: 'white', border: 'none', cursor: resetConfirmText === 'REMISE A ZERO' && resetChecked ? 'pointer' : 'not-allowed'
                  }}
                  onClick={doReset}
                  disabled={resetConfirmText !== 'REMISE A ZERO' || !resetChecked || resetLoading}
                >
                  {resetLoading ? 'Suppression...' : '🗑️ Confirmer la remise à zéro'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
