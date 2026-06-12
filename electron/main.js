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

  // Charger l'application Next.js
  mainWindow.loadURL('http://localhost:3000')

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function startNextServer() {
  const serverPath = path.join(__dirname, '..', '.next', 'standalone', 'server.js')
  
  nextServer = spawn('node', [serverPath], {
    env: { ...process.env, PORT: '3000', HOSTNAME: '0.0.0.0' },
    stdio: 'inherit',
  })

  nextServer.on('error', (err) => {
    console.error('Failed to start Next.js server:', err)
  })

  nextServer.on('exit', (code) => {
    console.log('Next.js server exited with code:', code)
  })
}

app.whenReady().then(() => {
  startNextServer()
  
  // Attendre que le serveur soit prêt
  setTimeout(() => {
    createWindow()
  }, 3000)

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
