/**
 * lib/expense-roles.ts
 * Règles métier de saisie des dépenses par rôle.
 * Importable côté serveur (actions) ET client (composants).
 */

export interface ExpenseCategory {
  value: string
  label: string
}

/** Toutes les catégories disponibles dans le système */
export const ALL_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { value: 'LOYER',              label: '🏠 Loyer' },
  { value: 'ELECTRICITE',        label: '💡 Électricité' },
  { value: 'EAU',                label: '💧 Eau' },
  { value: 'INTERNET',           label: '🌐 Internet / Télécom' },
  { value: 'CARBURANT',          label: '⛽ Carburant' },
  { value: 'FOURNITURES',        label: '📎 Fournitures bureau' },
  { value: 'ENTRETIEN',          label: '🔧 Entretien' },
  { value: 'TRANSPORT',          label: '🚗 Transport / Déplacement' },
  { value: 'ASSURANCE',          label: '🛡️ Assurance' },
  { value: 'SERVICES_BANCAIRES', label: '🏦 Services bancaires' },
  { value: 'AUTRES',             label: '📋 Autres' },
]

/** Mapping catégorie → code de compte comptable */
export const CATEGORY_ACCOUNT_MAP: Record<string, string> = {
  LOYER:              '613000',
  ELECTRICITE:        '653000',
  EAU:                '654000',
  INTERNET:           '626000',
  CARBURANT:          '652000',
  FOURNITURES:        '651000',
  ENTRETIEN:          '615000',
  TRANSPORT:          '625000',
  ASSURANCE:          '616000',
  SERVICES_BANCAIRES: '627000',
  AUTRES:             '628000',
}

/**
 * Catégories autorisées pour le caissier.
 * Uniquement les dépenses opérationnelles payées depuis le tiroir-caisse.
 *
 * Exclues : LOYER, ELECTRICITE, EAU, INTERNET, CARBURANT,
 *           ENTRETIEN, ASSURANCE (charges administratives).
 */
export const CAISSIER_ALLOWED_CATEGORY_VALUES = [
  'FOURNITURES',
  'TRANSPORT',
  'SERVICES_BANCAIRES',
  'AUTRES',
] as const

export type CaissierExpenseCategory = typeof CAISSIER_ALLOWED_CATEGORY_VALUES[number]

// [MOD-6] CAISSIER_EXPENSE_CAP supprimé — aucun plafond de montant imposé au caissier.
// La responsabilité de contrôle est portée par la clôture de session (écart physique / théorique)
// et non par un seuil arbitraire à la saisie.