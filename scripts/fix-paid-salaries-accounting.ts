/**
Script de réparation : régénère les écritures comptables pour les salaires déjà payés
Usage : npx tsx scripts/fix-paid-salaries-accounting.ts
*/
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
console.log('🔧 Réparation des écritures comptables pour salaires payés...\n')

// Auto-création des comptes RH
const { ensureHrAccounts } = await import('@/services/accounting.service')
await ensureHrAccounts()

// Trouver tous les salaires payés sans écriture comptable
const paidSalaries = await prisma.salary.findMany({
where: {
paidAt: { not: null },
},
include: {
employee: true,
},
})

console.log(`📊 ${paidSalaries.length} salaire(s) payé(s) trouvé(s)\n`)

let repaired = 0
let skipped = 0
let errors = 0

for (const salary of paidSalaries) {
// Vérifier si une écriture existe déjà
const existingEntry = await prisma.journalEntry.findFirst({
where: {
description: { contains: `Salaire ${salary.employee.firstName} ${salary.employee.lastName}` },
},
})

if (existingEntry) {
console.log(`⏭️  ${salary.employee.firstName} ${salary.employee.lastName} - ${salary.month}/${salary.year} (déjà comptabilisé)`)
skipped++
continue
}

try {
// Générer l'écriture comptable
const { generateSalaryAccountingEntry } = await import('@/services/hr.service')
await generateSalaryAccountingEntry(salary.id, prisma)

console.log(`✅ ${salary.employee.firstName} ${salary.employee.lastName} - ${salary.month}/${salary.year} (comptabilisé)`)
repaired++
} catch (error: any) {
console.error(`❌ ${salary.employee.firstName} ${salary.employee.lastName} - ${salary.month}/${salary.year}: ${error.message}`)
errors++
}
}

console.log('\n' + '='.repeat(70))
console.log('📊 Résumé :')
console.log(`✅ Réparés : ${repaired}`)
console.log(`⏭️ Déjà comptabilisés : ${skipped}`)
console.log(`❌ Erreurs : ${errors}`)
console.log('='.repeat(70))
console.log('\n✅ Réparation terminée !')
}

main()
.catch((e) => { console.error('❌ Erreur :', e); process.exit(1) })
.finally(async () => { await prisma.$disconnect() })