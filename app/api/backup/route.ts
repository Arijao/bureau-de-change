import { getSessionUser } from '@/lib/auth'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // Lit le chemin réel depuis DATABASE_URL (ex: file:./prisma/prod.db → prisma/prod.db)
  const dbUrl = process.env.DATABASE_URL ?? 'file:./dev.db'
  const dbRelPath = dbUrl.replace(/^file:/, '')
  const dbPath = path.isAbsolute(dbRelPath)
    ? dbRelPath
    : path.join(process.cwd(), 'prisma', dbRelPath)

  if (!fs.existsSync(dbPath)) {
    return NextResponse.json({ error: 'Base de données introuvable' }, { status: 404 })
  }

  const data = fs.readFileSync(dbPath)
  const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', 'h')
  const filename = `bdc_backup_${timestamp}.db`

  return new NextResponse(data, {
    headers: {
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Type':        'application/octet-stream',
      'Content-Length':      String(data.length),
    },
  })
}
