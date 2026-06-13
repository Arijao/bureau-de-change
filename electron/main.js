const { app, BrowserWindow } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

let mainWindow
let nextServer

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // En production, charger localhost:3000 (servi par le serveur Next.js standalone)
  // En développement, charger localhost:3000 directement
  const startUrl = process.env.ELECTRON_START_URL || 'http://127.0.0.1:3000'
  mainWindow.loadURL(startUrl)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function startNextServer() {
  return new Promise((resolve, reject) => {
    try {
      // Chemin vers le serveur Next.js standalone
      const serverPath = path.join(__dirname, '..', '.next', 'standalone', 'server.js')
      
      console.log('Starting Next.js server from:', serverPath)
      
      nextServer = spawn('node', [serverPath], {
        env: { 
          ...process.env, 
          PORT: '3000', 
          HOSTNAME: '127.0.0.1',
          NODE_ENV: 'production'
        },
        cwd: path.join(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      })

      let serverStarted = false

      nextServer.stdout.on('data', (data) => {
        const output = data.toString()
        console.log('Next.js:', output)
        
        // Détecter quand le serveur est prêt
        if (output.includes('Local:') || output.includes('ready')) {
          if (!serverStarted) {
            serverStarted = true
            console.log('Server is ready!')
            resolve()
          }
        }
      })

      nextServer.stderr.on('data', (data) => {
        console.error('Next.js error:', data.toString())
      })

      nextServer.on('error', (err) => {
        console.error('Failed to start Next.js server:', err)
        reject(err)
      })

      nextServer.on('exit', (code) => {
        console.log('Next.js server exited with code:', code)
        if (!serverStarted) {
          reject(new Error(`Server exited with code ${code}`))
        }
      })

      // Timeout de sécurité
      setTimeout(() => {
        if (!serverStarted) {
          console.log('Server startup timeout, continuing anyway...')
          resolve()
        }
      }, 10000)
      
    } catch (error) {
      console.error('Error starting server:', error)
      reject(error)
    }
  })
}

app.whenReady().then(async () => {
  try {
    // En production, démarrer le serveur Next.js standalone
    if (process.env.NODE_ENV !== 'development') {
      console.log('Starting in production mode...')
      await startNextServer()
    }
    
    // Créer la fenêtre après un court délai
    setTimeout(() => {
      createWindow()
    }, 1000)
    
  } catch (error) {
    console.error('Failed to initialize app:', error)
    // Créer la fenêtre même en cas d'erreur
    createWindow()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (nextServer) {
    nextServer.kill()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (nextServer) {
    nextServer.kill()
  }
})