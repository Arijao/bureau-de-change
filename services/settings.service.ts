import { prisma } from '@/lib/prisma'

export async function getSettings() {
  return prisma.settings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      bureauName: 'Bureau de Change FX Mada',
      address: 'Antananarivo, Madagascar',
      phone: '+261 20 22 XXX XX',
      footer: 'Merci pour votre confiance',
    },
  })
}

export async function updateSettings(data: {
  bureauName?:      string
  address?:         string
  phone?:           string
  footer?:          string
  nif?:             string
  stat?:            string
  email?:           string
  rib?:             string
  bureauPrefix?:    string
  attestationRate?: number   // Tarif attestation en Ar par unité de devise
}) {
  return prisma.settings.update({ where: { id: 'singleton' }, data })
}

// ── GESTION DU LOGO ───────────────────────────────────────────────────────────

export async function updateLogo(data: {
  logoBase64: string | null
  logoName:   string | null
}) {
  return prisma.settings.update({
    where: { id: 'singleton' },
    data:  { logoBase64: data.logoBase64, logoName: data.logoName },
  })
}