const fs = require('fs')
const path = require('path')

/**
 * electron-builder applique sa logique de résolution de dépendances
 * à tout dossier "node_modules" rencontré dans extraResources, ce qui
 * fait disparaître le node_modules généré par Next.js (output: standalone).
 * On le recopie manuellement ici, après le packaging.
 */
exports.default = async function (context) {
  const { appOutDir, electronPlatformName, packager } = context

  const resourcesDir =
    electronPlatformName === 'darwin'
      ? path.join(appOutDir, `${packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
      : path.join(appOutDir, 'resources')

  const source = path.join(packager.projectDir, '.next', 'standalone', 'node_modules')
  const dest = path.join(resourcesDir, 'standalone', 'node_modules')

  if (!fs.existsSync(source)) {
    console.warn('[afterPack] Source introuvable, rien à copier:', source)
    return
  }

  console.log('[afterPack] Copie node_modules ->', dest)
  fs.cpSync(source, dest, { recursive: true })
  console.log('[afterPack] Terminé.')
}