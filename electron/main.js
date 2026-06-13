const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')
const http = require('http')

// Désactiver accélération GPU (évite écran blanc sur Linux/Chromebook)
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-software-rasterizer')

let mainWindow
let nextServer

function getPaths() {
  if (app.isPackaged) {
    const userDb = path.join(app.getPath('userData'), 'bureau-de-change.db')
    const seedDb = path.join(process.resourcesPath, 'prisma', 'dev.db')

    // Copier la DB seed à la première installation
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
    }
  }
  return {
    serverPath:  path.join(__dirname, '..', '.next', 'standalone', 'server.js'),
    serverCwd:   path.join(__dirname, '..', '.next', 'standalone'),
    databaseUrl: process.env.DATABASE_URL || 'file:./prisma/dev.db',
  }
}

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
        // Permettre à Turbopack de trouver @prisma/client hashé
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    // PAS de show:false
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

app.whenReady().then(async () => {
  if (app.isPackaged) {
    try {
      await startNextServer()
    } catch (err) {
      console.error('[main] Server failed, continuing:', err)
    }
  } else {
    // En dev : attendre que Next.js soit prêt
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

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