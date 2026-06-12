// ── Domain types mirroring Prisma schema ──────────────────
export type Role = 'ADMIN' | 'CAISSIER'
export type TxType = 'ACHAT' | 'VENTE'
export type StockOperation = 'ACHAT' | 'VENTE' | 'DEPOT' | 'RETRAIT' | 'AJUSTEMENT'

export interface Currency {
  id: number
  code: string
  name: string
  symbol: string | null
  flag: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ExchangeCategoryRate {
  id: number
  exchangeRateId: number
  categoryId: number
  buyRate: number
}

export interface ExchangeRate {
  id: number
  currencyId: number
  buyRate: number
  sellRate: number
  note: string | null
  createdAt: Date
  createdBy: string | null
  categoryRates?: ExchangeCategoryRate[]
}

export interface DenominationCategory {
  id: number
  currencyId: number
  name: string
  denominations: string
  active: boolean
}

export interface CashStock {
  id: number
  currencyId: number
  amount: number
  alertLevel: number
  updatedAt: Date
}

export interface StockLogDetail {
  id: number
  stockLogId: number
  denomination: number
  quantity: number
}

export interface StockLog {
  id: number
  stockId: number
  operation: StockOperation
  delta: number
  balanceBefore: number
  balanceAfter: number
  note: string | null
  createdAt: Date
  transactionId: string | null
  userId: string | null
  details?: StockLogDetail[]
}

export interface TransactionDetail {
  id: number
  transactionId: string
  categoryName: string
  denomination: number
  quantity: number
  rateApplied: number
  subtotalAmount: number
  subtotalMGA: number
}

export interface Transaction {
  id: string
  receiptNo: string
  type: TxType
  currencyId: number
  amount: number
  rate: number
  commission: number
  totalMGA: number
  note: string | null
  createdAt: Date
  userId: string | null
  exchangeRateId: number | null
  details?: TransactionDetail[]
}

// ── Composed / view types ─────────────────────────────────
export interface CurrencyWithDetails extends Currency {
  currentRate: ExchangeRate | null
  stock: CashStock | null
  denominationCategories?: DenominationCategory[]
}

export interface TransactionWithRelations extends Transaction {
  currency: Currency
  user: { name: string } | null
  exchangeRate: ExchangeRate | null
}

export interface StockAlert {
  currency: Currency
  stock: CashStock
  isLow: boolean
  percentage: number
}

// ── Accounting types ──────────────────────────────────────
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'

export interface LedgerAccount {
  id: number
  code: string
  name: string
  type: AccountType
  description: string | null
  active: boolean
  createdAt: Date
}

export interface JournalEntry {
  id: number
  date: Date
  description: string
  reference: string | null
  createdAt: Date
  transactionId: string | null
  userId: string | null
}

export interface JournalEntryLine {
  id: number
  journalEntryId: number
  accountId: number
  debit: number
  credit: number
  description: string | null
}

export interface JournalEntryWithLines extends JournalEntry {
  lines: (JournalEntryLine & { account: LedgerAccount })[]
  transaction?: { receiptNo: string; type: string; amount: number } | null
  user?: { name: string } | null
}

export interface JournalFilters {
  dateFrom?: string
  dateTo?: string
  accountId?: number
  reference?: string
  limit?: number
  offset?: number
}

export interface LedgerFilters {
  dateFrom?: string
  dateTo?: string
  limit?: number
  offset?: number
}

export interface AccountBalance {
  accountId: number
  code: string
  name: string
  type: AccountType
  totalDebit: number
  totalCredit: number
  balance: number
}

export interface TrialBalanceResult {
  from: Date
  to: Date
  accounts: AccountBalance[]
  totals: {
    totalDebit: number
    totalCredit: number
    isBalanced: boolean
  }
}

// ═══════════════════════════════════════════════════════════
// ── RESSOURCES HUMAINES (RH) ─────────────────────────────
// ═══════════════════════════════════════════════════════════

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE'
export type AdvanceStatus = 'PENDING' | 'APPROVED' | 'DEDUCTED' | 'CANCELLED'
export type SanctionType = 'WARNING' | 'SUSPENSION' | 'FINANCIAL'
export type LeaveType = 'PAID' | 'UNPAID' | 'SICK'
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface Employee {
  id: number
  firstName: string
  lastName: string
  cin: string | null
  phone: string | null
  email: string | null
  department: string | null
  position: string | null
  bankAccount: string | null
  baseSalary: number
  active: boolean
  hiredAt: Date
  createdAt: Date
  updatedAt: Date
  userId: string | null
}

export interface Attendance {
  id: number
  employeeId: number
  date: Date
  checkIn: Date | null
  checkOut: Date | null
  hours: number | null
  status: AttendanceStatus
  note: string | null
  createdAt: Date
}

export interface Salary {
  id: number
  employeeId: number
  month: number // 1-12
  year: number
  baseSalary: number
  bonuses: number
  deductions: number
  netSalary: number
  paidAt: Date | null
  note: string | null
  createdAt: Date
}

export interface Advance {
  id: number
  employeeId: number
  amount: number
  date: Date
  status: AdvanceStatus
  note: string | null
  createdAt: Date
}

export interface Sanction {
  id: number
  employeeId: number
  type: SanctionType
  amount: number
  date: Date
  reason: string
  note: string | null
  createdAt: Date
}

export interface Leave {
  id: number
  employeeId: number
  type: LeaveType
  startDate: Date
  endDate: Date
  days: number
  status: LeaveStatus
  note: string | null
  createdAt: Date
}

// ─ Composed / view types ─────────────────────────────────
export interface EmployeeWithRelations extends Employee {
  attendances?: Attendance[]
  salaries?: Salary[]
  advances?: Advance[]
  sanctions?: Sanction[]
  leaves?: Leave[]
  user?: { name: string; username: string } | null
}

export interface HrDashboardStats {
  totalEmployees: number
  activeEmployees: number
  totalPayroll: number // Masse salariale du mois en cours
  pendingAdvances: number
  pendingLeaves: number
}

// ═══════════════════════════════════════════════════════════
// ── SESSIONS DE CAISSE ────────────────────────────────────
// ═══════════════════════════════════════════════════════════

export type CashSessionStatus      = 'OPEN' | 'CLOSED'
export type CashSessionBalanceType = 'OPENING' | 'CLOSING_THEORETICAL' | 'PHYSICAL_COUNT'

// ── Détail par coupure (comptage physique) ────────────────
export interface CashSessionCountDetail {
  id:           number
  balanceId:    number
  denomination: number
  quantity:     number
}

// ── Solde par devise et par type ─────────────────────────
export interface CashSessionBalance {
  id:          number
  sessionId:   string
  currencyId:  number
  balanceType: CashSessionBalanceType
  amount:      number
  currency?:   Currency
  countDetails?: CashSessionCountDetail[]
}

// ── Session brute (miroir du modèle Prisma) ──────────────
export interface CashSession {
  id:                string
  sessionNo:         string
  status:            CashSessionStatus
  openedAt:          Date
  closedAt:          Date | null
  openingNote:       string | null
  closingNote:       string | null
  userId:            string
  previousSessionId: string | null
}

// ── Bandeau Navbar (données minimales) ───────────────────
export interface CashSessionBanner {
  id:        string
  sessionNo: string
  status:    CashSessionStatus
  openedAt:  Date
  userName:  string
}

// ── Session enrichie avec ses relations ──────────────────
export interface CashSessionWithRelations extends CashSession {
  user: { name: string; role: string }
  balances: (CashSessionBalance & {
    currency: Currency
    countDetails: CashSessionCountDetail[]
  })[]
  previousSession?: { sessionNo: string; closedAt: Date | null } | null
  nextSession?:     { sessionNo: string } | null
  _count?: {
    transactions: number
    expenses:     number
  }
}

// ── Expense (type de base manquant dans types.ts) ────────
// Miroir du modèle Prisma — inclut cashSessionId
export interface Expense {
  id:            number
  date:          Date
  amount:        number
  accountId:     number
  category:      string
  supplier:      string | null
  description:   string
  reference:     string | null
  period:        string | null
  note:          string | null
  cashSessionId: string | null
  createdAt:     Date
  updatedAt:     Date
}

// ── Mouvement par devise dans une session ────────────────
export interface SessionMovementByCurrency {
  currencyId:  number
  currencyCode: string
  currencyFlag: string
  achatCount:  number
  achatAmount: number  // montant en devise étrangère
  achatMGA:    number  // contrepartie MGA
  venteCount:  number
  venteAmount: number
  venteMGA:    number
}

// ── Écart à la clôture (physique vs théorique) ───────────
export interface SessionDiscrepancy {
  currency:    Currency
  theoretical: number
  physical:    number
  diff:        number   // physical − theoretical (négatif = manque)
}

// ── Mouvement RH (hors transaction, par plage horaire) ───
export interface SessionHrMovement {
  id:            number
  operation:     string
  delta:         number
  balanceBefore: number
  balanceAfter:  number
  note:          string | null
  createdAt:     Date
  user:          { name: string } | null
}

// ── Rapport complet de clôture ───────────────────────────
export interface CashSessionReport {
  session:             CashSessionWithRelations
  movementsByCurrency: SessionMovementByCurrency[]
  // Listes détaillées
  achats:              TransactionWithRelations[]
  ventes:              TransactionWithRelations[]
  expenses:            Expense[]
  hrMovements:         SessionHrMovement[]
  // Soldes (depuis CashSessionBalance)
  openingBalances:     (CashSessionBalance & { currency: Currency; countDetails: CashSessionCountDetail[] })[]
  theoreticalBalances: (CashSessionBalance & { currency: Currency })[]
  physicalBalances:    (CashSessionBalance & { currency: Currency; countDetails: CashSessionCountDetail[] })[]
  discrepancies:       SessionDiscrepancy[]
  // Totaux récapitulatifs
  totalTransactions: number
  totalExpensesMGA:  number
  totalHrDelta:      number   // delta net MGA des mouvements RH
  sessionDuration:   number   // durée en minutes
}

// ── Input pour ouverture de session ──────────────────────
export interface OpenSessionInput {
  userId:       string
  openingNote?: string
  previousSessionId?: string
  openingBalances: Array<{
    currencyId: number
    amount:     number
    denominations?: Array<{ denomination: number; quantity: number }>
  }>
}

// ── Input pour clôture de session ────────────────────────
export interface CloseSessionInput {
  sessionId:    string
  closingNote?: string
  physicalCounts: Array<{
    currencyId: number
    denominations: Array<{ denomination: number; quantity: number }>
  }>
}
