const fs = require('fs')
const path = require('path')

function copyDir(src, dest, label) {
  if (!fs.existsSync(src)) {
    console.warn(`[copy-standalone-assets] Introuvable, ignoré: ${src}`)
    return
  }
  fs.cpSync(src, dest, { recursive: true })
  console.log(`[copy-standalone-assets] ${label} copié -> ${dest}`)
}

const root = path.join(__dirname, '..')

copyDir(
  path.join(root, '.next', 'static'),
  path.join(root, '.next', 'standalone', '.next', 'static'),
  '.next/static'
)

copyDir(
  path.join(root, 'public'),
  path.join(root, '.next', 'standalone', 'public'),
  'public'
)
