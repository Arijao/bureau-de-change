import { prisma } from '@/lib/prisma'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SaveAttestationInput {
  transactionId?:    string
  receiptNo:         string
  clientName:        string
  passportNo:        string
  passportIssuedAt:  string
  passportExpiresAt: string
  nationality:       string
  clientAddress?:    string
  destination?:      string
  travelNature?:     string
  transportTitle?:   string
  ticketNo?:         string
  departureDate?:    string
  returnDate?:       string
  currencyCode:      string
  currencyFlag:      string
  amount:            number
  rate:              number
  commission:        number
  totalMGA:          number
  createdBy?:        string
}

export interface AttestationFilters {
  dateFrom?: string
  dateTo?:   string
  search?:   string
  limit?:    number
  offset?:   number
}

// ── Génération du préfixe bureau ──────────────────────────────────────────────
// Priorité 1 : Settings.bureauPrefix (saisi manuellement par l'admin → ex: "TREX")
// Priorité 2 : extraction automatique depuis bureauName (fallback)

const STOP_WORDS = new Set(['de', 'du', 'des', 'le', 'la', 'les', 'et', 'en', 'au', 'aux', 'bureau', 'change'])

export function buildBureauPrefix(bureauName: string): string {
  const words = bureauName
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .split(/\s+/)
    .filter(w => w.length > 0 && !STOP_WORDS.has(w.toLowerCase()))

  if (words.length === 0) return 'BDC'
  if (words.length === 1) return words[0].slice(0, 4).padEnd(4, 'X')

  let prefix = words.map(w => w[0]).join('').slice(0, 4)
  if (prefix.length < 4) prefix = prefix.padEnd(4, words[0][1] ?? 'X')
  return prefix
}

// ── Génération du numéro séquentiel atomique ──────────────────────────────────
// Format : PREFIX/ATT/NNNN/MM/AA  (ex: TREX/ATT/0001/06/26)
// Le prefix vient de Settings.bureauPrefix en priorité, sinon calculé depuis bureauName.

async function generateAttestationNo(
  bureauName: string,
  bureauPrefix?: string | null,
): Promise<string> {
  const now    = new Date()
  const month  = now.getMonth() + 1
  const year   = now.getFullYear() % 100

  // [CORRIGÉ] : utiliser bureauPrefix (champ manuel) si défini et non vide
  const prefix = bureauPrefix?.trim().toUpperCase().slice(0, 4) || buildBureauPrefix(bureauName)

  const counter = await prisma.$transaction(async (tx) => {
    const existing = await tx.attestationCounter.findUnique({
      where: { bureauPrefix_month_year: { bureauPrefix: prefix, month, year } },
    })

    if (existing) {
      return tx.attestationCounter.update({
        where: { id: existing.id },
        data:  { lastSeq: { increment: 1 } },
      })
    } else {
      return tx.attestationCounter.create({
        data: { bureauPrefix: prefix, month, year, lastSeq: 1 },
      })
    }
  })

  const seq = String(counter.lastSeq).padStart(4, '0')
  const mm  = String(month).padStart(2, '0')
  const yy  = String(year).padStart(2, '0')

  return `${prefix}/ATT/${seq}/${mm}/${yy}`
}

// ── saveAttestation ───────────────────────────────────────────────────────────

export async function saveAttestation(
  input: SaveAttestationInput,
  bureauName: string,
  bureauPrefix?: string | null,
) {
  // Idempotence : même reçu + même caissier + même jour → retourner l'existant
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999)

  const existing = await prisma.attestation.findFirst({
    where: {
      receiptNo: input.receiptNo,
      createdBy: input.createdBy ?? null,
      createdAt: { gte: todayStart, lte: todayEnd },
    },
  })
  if (existing) return existing

  const attestationNo = await generateAttestationNo(bureauName, bureauPrefix)

  return prisma.attestation.create({
    data: {
      attestationNo,
      transactionId:     input.transactionId     ?? null,
      receiptNo:         input.receiptNo,
      clientName:        input.clientName,
      passportNo:        input.passportNo,
      passportIssuedAt:  input.passportIssuedAt,
      passportExpiresAt: input.passportExpiresAt,
      nationality:       input.nationality,
      clientAddress:     input.clientAddress      ?? null,
      destination:       input.destination        ?? null,
      travelNature:      input.travelNature       ?? null,
      transportTitle:    input.transportTitle      ?? null,
      ticketNo:          input.ticketNo            ?? null,
      departureDate:     input.departureDate        ?? null,
      returnDate:        input.returnDate           ?? null,
      currencyCode:      input.currencyCode,
      currencyFlag:      input.currencyFlag,
      amount:            input.amount,
      rate:              input.rate,
      commission:        input.commission,
      totalMGA:          input.totalMGA,
      createdBy:         input.createdBy           ?? null,
    },
  })
}

// ── getAttestations ───────────────────────────────────────────────────────────

export async function getAttestations(filters: AttestationFilters = {}) {
  const { dateFrom, dateTo, search, limit = 100, offset = 0 } = filters

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {}

  if (dateFrom || dateTo) {
    const range: Record<string, Date> = {}
    if (dateFrom) range.gte = new Date(dateFrom)
    if (dateTo)   { const d = new Date(dateTo); d.setHours(23, 59, 59, 999); range.lte = d }
    where.createdAt = range
  }

  if (search?.trim()) {
    const q = search.trim()
    where.OR = [
      { attestationNo: { contains: q } },
      { receiptNo:     { contains: q } },
      { clientName:    { contains: q } },
      { passportNo:    { contains: q } },
    ]
  }

  const [attestations, total] = await Promise.all([
    prisma.attestation.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take:    limit,
      skip:    offset,
    }),
    prisma.attestation.count({ where }),
  ])

  return { attestations, total }
}

export async function getAttestationById(id: string) {
  return prisma.attestation.findUnique({
    where:   { id },
    include: { user: { select: { name: true } } },
  })
}

export async function getAttestationByNo(attestationNo: string) {
  return prisma.attestation.findUnique({
    where:   { attestationNo },
    include: { user: { select: { name: true } } },
  })
}

// ── getAttestationByTransactionId ─────────────────────────────────────────────
export async function getAttestationByTransactionId(transactionId: string) {
  return prisma.attestation.findUnique({
    where:   { transactionId },
    include: { user: { select: { name: true } } },
  })
}

// ── updateAttestation ─────────────────────────────────────────────────────────
export async function updateAttestation(
  id: string,
  data: Partial<SaveAttestationInput>,
) {
  return prisma.attestation.update({
    where: { id },
    data: {
      clientName:        data.clientName,
      passportNo:        data.passportNo,
      passportIssuedAt:  data.passportIssuedAt,
      passportExpiresAt: data.passportExpiresAt,
      nationality:       data.nationality,
      clientAddress:     data.clientAddress      ?? null,
      destination:       data.destination        ?? null,
      travelNature:      data.travelNature       ?? null,
      transportTitle:    data.transportTitle     ?? null,
      ticketNo:          data.ticketNo           ?? null,
      departureDate:     data.departureDate      ?? null,
      returnDate:        data.returnDate         ?? null,
    },
  })
}

// ── REVENUS DES ATTESTATIONS PAYANTES ─────────────────────────────────────────
/**
 * Calcule les revenus des attestations payantes (Type B : transactionId = null)
 * Formule : amount × attestationRate
 */
export async function getAttestationRevenues(from: Date, to: Date, attestationRate: number) {
  const attestations = await prisma.attestation.findMany({
    where: {
      transactionId: null,
      createdAt: { gte: from, lte: to },
    },
  })
  const totalRevenue = attestations.reduce((sum, att) => {
    return sum + att.totalMGA  // ✅ Utilise totalMGA déjà calculé
  }, 0)
  return {
    count: attestations.length,
    totalRevenue,
    attestations,
  }
}