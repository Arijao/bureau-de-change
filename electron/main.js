const { app, BrowserWindow, shell, dialog } = require('electron')
const path = require('path')
const { spawn, execFileSync } = require('child_process')
const fs = require('fs')
const http = require('http')

// Désactiver accélération GPU (évite écran blanc sur Linux/Chromebook)
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-software-rasterizer')

let mainWindow
let nextServer

// ── Auto-updater (production uniquement) ────────────────────────────────────
// electron-updater lit "publish" dans electron-builder.json pour savoir
// où chercher les mises à jour (GitHub Releases dans notre cas)
let autoUpdater = null
if (app.isPackaged) {
  try {
    autoUpdater = require('electron-updater').autoUpdater
    autoUpdater.autoDownload = true         // télécharge en arrière-plan
    autoUpdater.autoInstallOnAppQuit = true // installe à la fermeture si non redémarré
  } catch (e) {
    console.warn('[updater] electron-updater non disponible:', e.message)
  }
}

function setupAutoUpdater() {
  if (!autoUpdater) return

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] Vérification des mises à jour...')
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] Mise à jour disponible:', info.version)
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] Application à jour.')
  })

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[updater] Téléchargement: ${Math.round(progress.percent)}%`)
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[updater] Mise à jour téléchargée:', info.version)
    // Proposer le redémarrage à l'utilisateur
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Mise à jour disponible',
      message: `La version ${info.version} est prête.`,
      detail: 'Redémarrer maintenant pour appliquer la mise à jour ?',
      buttons: ['Redémarrer', 'Plus tard'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall()
      }
    })
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] Erreur:', err.message)
    // Ne jamais bloquer le démarrage sur une erreur de mise à jour
  })

  // Vérifier au démarrage, puis toutes les 2 heures
  autoUpdater.checkForUpdates().catch((e) => {
    console.warn('[updater] Vérification échouée (mode offline ?):', e.message)
  })
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 2 * 60 * 60 * 1000)
}

// ── Chemins et initialisation de la DB ──────────────────────────────────────
function getPaths() {
  if (app.isPackaged) {
    const userDb = path.join(app.getPath('userData'), 'bureau-de-change.db')
    const seedDb = path.join(process.resourcesPath, 'prisma', 'prisma', 'dev.db')

    // Copier la DB seed à la première installation uniquement
    if (!fs.existsSync(userDb) && fs.existsSync(seedDb)) {
      try {
        fs.mkdirSync(path.dirname(userDb), { recursive: true })
        fs.copyFileSync(seedDb, userDb)
        console.log('[main] DB initialisée depuis seed:', userDb)
      } catch (e) {
        console.error('[main] Erreur copie DB:', e.message)
      }
    }

    return {
      serverPath:  path.join(process.resourcesPath, 'standalone', 'server.js'),
      serverCwd:   path.join(process.resourcesPath, 'standalone'),
      databaseUrl: `file:${userDb}`,
      userDb,
    }
  }
  return {
    serverPath:  path.join(__dirname, '..', '.next', 'standalone', 'server.js'),
    serverCwd:   path.join(__dirname, '..', '.next', 'standalone'),
    databaseUrl: process.env.DATABASE_URL || 'file:./prisma/dev.db',
    userDb:      null,
  }
}

// ── Migrations Prisma ────────────────────────────────────────────────────────
// Applique les migrations manquantes sur la DB utilisateur à chaque démarrage.
// Prisma compare _prisma_migrations et n'applique que ce qui manque.
// Les données existantes ne sont jamais effacées.
async function runMigrations() {
  if (!app.isPackaged) return // en dev, les migrations sont gérées manuellement

  const { databaseUrl } = getPaths()

  // Chemin vers le binaire prisma embarqué dans les ressources
  const prismaBin = path.join(
    process.resourcesPath,
    'standalone',
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'prisma.cmd' : 'prisma'
  )

  // Dossier des migrations embarquées dans le package
  const migrationsDir = path.join(process.resourcesPath, 'prisma', 'migrations')

  if (!fs.existsSync(prismaBin)) {
    console.warn('[migrations] prisma binaire introuvable, migrations ignorées:', prismaBin)
    return
  }

  if (!fs.existsSync(migrationsDir)) {
    console.warn('[migrations] dossier migrations introuvable:', migrationsDir)
    return
  }

  // Sauvegarde préventive avant chaque migration
  backupDatabase()

  try {
    console.log('[migrations] Application des migrations Prisma...')
    execFileSync(prismaBin, ['migrate', 'deploy'], {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        // Prisma cherche schema.prisma relativement à son CWD
      },
      cwd: path.join(process.resourcesPath, 'prisma'),
      stdio: 'pipe',
    })
    console.log('[migrations] Migrations appliquées avec succès.')
  } catch (err) {
    // Logger mais ne jamais bloquer le démarrage de l'app
    console.error('[migrations] Erreur lors des migrations:', err.message)
    if (err.stdout) console.error('[migrations] stdout:', err.stdout.toString())
    if (err.stderr) console.error('[migrations] stderr:', err.stderr.toString())
  }
}

// ── Sauvegarde de la DB ──────────────────────────────────────────────────────
function backupDatabase() {
  if (!app.isPackaged) return

  const { userDb } = getPaths()
  if (!userDb || !fs.existsSync(userDb)) return

  try {
    const backupDir = path.join(app.getPath('userData'), 'backups')
    fs.mkdirSync(backupDir, { recursive: true })

    // Garder les 5 dernières sauvegardes seulement
    const backups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('bureau-de-change-backup-'))
      .sort()
    if (backups.length >= 5) {
      fs.unlinkSync(path.join(backupDir, backups[0]))
    }

    const backupPath = path.join(
      backupDir,
      `bureau-de-change-backup-${Date.now()}.db`
    )
    fs.copyFileSync(userDb, backupPath)
    console.log('[backup] DB sauvegardée:', backupPath)
  } catch (e) {
    console.error('[backup] Erreur sauvegarde:', e.message)
  }
}

// ── Démarrage du serveur Next.js ─────────────────────────────────────────────
function startNextServer() {
  return new Promise((resolve, reject) => {
    const { serverPath, serverCwd, databaseUrl } = getPaths()

    console.log('[main] Starting Next.js from:', serverPath)
    console.log('[main] execPath:', process.execPath)

    if (!fs.existsSync(serverPath)) {
      console.error('[main] server.js introuvable:', serverPath)
      try {
        const standaloneDir = path.dirname(serverPath)
        if (fs.existsSync(standaloneDir)) {
          console.log('[main] Contenu de standalone/:', fs.readdirSync(standaloneDir))
        } else {
          console.error('[main] Dossier standalone introuvable:', standaloneDir)
          const resourcesDir = process.resourcesPath
          console.log('[main] Contenu de resources/:', fs.existsSync(resourcesDir) ? fs.readdirSync(resourcesDir) : 'ABSENT')
        }
      } catch (e) {
        console.error('[main] Erreur listing:', e.message)
      }
      return reject(new Error('server.js not found'))
    }

    nextServer = spawn(process.execPath, [serverPath], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        PORT:                 '3000',
        HOSTNAME:             '127.0.0.1',
        NODE_ENV:             'production',
        DATABASE_URL:         databaseUrl,
        NODE_PATH:            path.join(process.resourcesPath, 'standalone', 'node_modules'),
      },
      cwd: serverCwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let resolved = false
    const done = () => { if (!resolved) { resolved = true; resolve() } }

    nextServer.stdout.on('data', (data) => {
      console.log('[next]', data.toString().trimEnd())
    })

    nextServer.stderr.on('data', (data) => {
      console.error('[next:err]', data.toString().trimEnd())
    })

    nextServer.on('error', (err) => {
      console.error('[main] spawn error:', err)
      if (!resolved) reject(err)
    })

    nextServer.on('exit', (code) => {
      console.log('[next] exited with code', code)
      if (!resolved) reject(new Error(`Server exited early (code ${code})`))
    })

    // Polling TCP : attend que le port 3000 soit réellement en écoute
    const startTime = Date.now()
    const MAX_WAIT_MS = 20_000
    const POLL_INTERVAL_MS = 300

    const poll = () => {
      const req = http.get('http://127.0.0.1:3000', () => {
        console.log('[main] Server ready on port 3000')
        done()
      })
      req.on('error', () => {
        if (Date.now() - startTime > MAX_WAIT_MS) {
          console.warn('[main] Timeout — opening window anyway')
          done()
          return
        }
        setTimeout(poll, POLL_INTERVAL_MS)
      })
      req.setTimeout(500, () => {
        req.destroy()
        setTimeout(poll, POLL_INTERVAL_MS)
      })
    }

    setTimeout(poll, 500)
  })
}

// ── Fenêtre principale ───────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const url = 'http://127.0.0.1:3000'

  mainWindow.webContents.on('did-fail-load', (_event, errorCode) => {
    if (errorCode === -102) {
      setTimeout(() => { if (mainWindow) mainWindow.loadURL(url) }, 1000)
    }
  })

  mainWindow.loadURL(url)
  mainWindow.on('closed', () => { mainWindow = null })
}

// ── Point d'entrée ───────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  if (app.isPackaged) {
    // Ordre impératif :
    // 1. Migrations d'abord (avant que Next.js accède à la DB)
    // 2. Démarrage du serveur Next.js
    // 3. Ouverture de la fenêtre
    // 4. Vérification des mises à jour (en dernier, non bloquant)
    try {
      await runMigrations()
    } catch (err) {
      console.error('[main] Migrations échouées, on continue:', err)
    }

    try {
      await startNextServer()
    } catch (err) {
      console.error('[main] Server failed, continuing:', err)
    }
  } else {
    // En dev : attendre que Next.js soit prêt (lancé séparément)
    await new Promise((resolve) => {
      const startTime = Date.now()
      const poll = () => {
        const req = http.get('http://127.0.0.1:3000', () => resolve())
        req.on('error', () => {
          if (Date.now() - startTime > 30_000) return resolve()
          setTimeout(poll, 500)
        })
        req.setTimeout(500, () => { req.destroy(); setTimeout(poll, 500) })
      }
      poll()
    })
  }

  createWindow()

  // Vérifier les mises à jour après ouverture de la fenêtre (non bloquant)
  setupAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// ── Nettoyage ────────────────────────────────────────────────────────────────
function cleanup() {
  if (nextServer) {
    nextServer.kill()
    nextServer = null
  }
}

app.on('window-all-closed', () => {
  cleanup()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', cleanup)