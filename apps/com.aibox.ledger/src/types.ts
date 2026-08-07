export type TransactionKind = 'expense' | 'income' | 'transferOut' | 'transferIn' | 'adjustment'
export type FlowKind = 'expense' | 'income'
export type AccountKind = 'cash' | 'debit' | 'credit' | 'ewallet' | 'prepaid' | 'investment'
export type SplitMode = 'equal' | 'exact' | 'shares' | 'percent'
export type StoreState = 'unopened' | 'ready' | 'degradedMemory' | 'readOnly'
export type TransactionSource = 'manual' | 'settlement' | 'import' | 'ai' | string

export interface Account {
  id: string
  name: string
  kind: AccountKind
  currency: string
  initialBalanceMinor: number
  includeInNetWorth: boolean
  creditLimitMinor: number
  iconName: string
  colorHex: string
  sortOrder: number
  isArchived: boolean
  createdAt: number
}

export interface Category {
  id: string
  name: string
  systemImage: string
  kind: FlowKind
  parentID: string | null
  colorHex: string
  sortOrder: number
  isArchived: boolean
  isSeed: boolean
}

export interface CurrencyRow {
  code: string
  symbol: string
  decimals: number
  rateToBase: number
  isBase: boolean
  manualRate: boolean
  rateConfigured: boolean
  sortOrder: number
  updatedAt: number
}

export interface Budget {
  id: string
  monthKey: number
  categoryID: string | null
  limitMinor: number
  carryover: boolean
}

export interface Project {
  id: string
  name: string
  note: string
  systemImage: string
  colorHex: string
  startOn: number | null
  endOn: number | null
  budgetMinor: number
  isActive: boolean
  isArchived: boolean
  sortOrder: number
  createdAt: number
}

export interface Member {
  id: string
  projectID: string
  name: string
  isMe: boolean
  colorHex: string
  sortOrder: number
  createdAt: number
}

export interface Settlement {
  id: string
  projectID: string
  fromMemberID: string
  toMemberID: string
  amountBaseMinor: number
  occurredOn: number
  createdAt: number
  linkedTransactionID: string | null
}

export interface BalanceSnapshot {
  id: string
  accountID: string
  date: number
  balanceMinor: number
  source: 'manual' | 'calibration'
}

export interface LedgerMeta {
  id: string
  version: number
  seededAt: number
  seedLocale: string
}

export interface SplitShare {
  memberID: string
  value?: number
}

export interface TransactionSplit {
  mode: SplitMode
  shares: SplitShare[]
}

export interface LedgerTransaction {
  id: string
  kind: TransactionKind
  amountMinor: number
  currency: string
  baseAmountMinorAtPosting: number | null
  baseCurrencyAtPosting: string | null
  fxRateToBaseAtPosting: number | null
  fxRateDate: number | null
  calculationExpression: string | null
  idempotencyKey: string | null
  batchID: string | null
  sourceFingerprint: string | null
  occurredOn: number
  createdAt: number
  categoryID: string | null
  accountID: string | null
  transferPeerID: string | null
  merchant: string | null
  note: string
  tags: string[]
  reimbursable: boolean
  refundOfID: string | null
  source: TransactionSource
  bookID: null
  projectID: string | null
  payerMemberID: string | null
  split: TransactionSplit | null
  deletedAt: number | null
  signedAdjustment: number
}

export interface LedgerTables {
  accounts: Account[]
  categories: Category[]
  currencies: CurrencyRow[]
  budgets: Budget[]
  projects: Project[]
  members: Member[]
  settlements: Settlement[]
  snapshots: BalanceSnapshot[]
  meta: LedgerMeta[]
}

export type TableName = keyof LedgerTables

export interface DatabasePutOperation {
  c: 'tables' | 'tx'
  id: string
  rows: LedgerTables[TableName] | LedgerTransaction[]
  del?: false
}

export interface DatabaseDeleteOperation {
  c: 'tx'
  id: string
  del: true
}

export type DatabaseOperation = DatabasePutOperation | DatabaseDeleteOperation

export interface TransactionInput {
  id?: string
  kind?: TransactionKind
  amountMinor?: number
  currency?: string
  calculationExpression?: string | null
  idempotencyKey?: string | null
  batchID?: string | null
  sourceFingerprint?: string | null
  occurredOn?: number
  createdAt?: number
  categoryID?: string | null
  accountID?: string | null
  transferPeerID?: string | null
  merchant?: string | null
  note?: string
  tags?: readonly unknown[] | null
  reimbursable?: boolean
  refundOfID?: string | null
  source?: TransactionSource
  projectID?: string | null
  payerMemberID?: string | null
  split?: TransactionSplit | null
  signedAdjustment?: number
}

export type TransactionPatch = Partial<Omit<LedgerTransaction, 'id' | 'createdAt' | 'bookID'>> & {
  transferAmountMinor?: number
}

export interface QueryFilter {
  kinds?: TransactionKind[]
  dateFrom?: number | null
  dateTo?: number | null
  includeNonFlow?: boolean
  tag?: string | null
  accountID?: string | null
  projectID?: string | null
  categoryID?: string | null
  reimbursable?: boolean | null
  minAmountMinor?: number | null
  maxAmountMinor?: number | null
  keyword?: string | null
}

export type BucketDimension = 'byCategory' | 'bySubcategory' | 'byAccount' | 'byTag' | 'byDay' | 'byMonth' | 'byProject'
export type BucketMetric = 'expense' | 'income' | 'net'

export interface BucketLabels {
  uncategorized?: string
  noTag?: string
  noProject?: string
}

export interface ReportBucket {
  key: string
  label: string
  amountMinor: number
  count: number
  colorHex: string | null
}

export interface LedgerActionContext {
  store: import('./lib/store.js').LedgerStore
  locale: string
  labels: BucketLabels
}

export type Translate = (key: string, ...args: Array<string | number>) => string

export interface MenuItem {
  id: string
  label: string
  icon?: string
  destructive?: boolean
  disabled?: boolean
  onSelect: () => void | Promise<void> | Promise<boolean>
}

export interface EntryEditorPayload {
  type: 'expense' | 'income' | 'transfer'
  amountMinor: number
  calculationExpression: string | null
  categoryID: string | null
  accountID: string
  toAccountID?: string | null
  projectID: string | null
  payerMemberID: string | null
  split: TransactionSplit | null
  merchant: string | null
  note: string
  occurredOn: number
  tags: string[]
  reimbursable: boolean
  refundOfID: string | null
}

export interface SplitEditorRequest {
  projectID: string
  totalBaseMinor: number
  payerMemberID: string | null
  split: TransactionSplit | null
  onDone: (split: TransactionSplit | null) => void
}

export interface SettlementPlanRow {
  fromMemberID: string
  toMemberID: string
  amountMinor: number
}

export interface LedgerUIActions {
  setQuery: (query: string) => void
  setMonthKey: (monthKey: number) => void
  showMenu: (items: MenuItem[]) => void
  editEntry: (transaction: LedgerTransaction) => void
  deleteEntry: (transaction: LedgerTransaction) => Promise<void>
  restoreEntry: (transaction: LedgerTransaction) => Promise<void>
  purgeEntry: (transaction: LedgerTransaction) => Promise<void>
  clearCurrentProject: () => Promise<void>
  activateProject: (project: Project) => Promise<void>
  archiveProject: (project: Project, archived: boolean) => Promise<void>
  editProject: (project: Project) => void
  openProject: (project: Project) => void
  recordIntoProject: (project: Project) => Promise<void>
  openAccount: (account: Account) => void
  editAccount: (account: Account) => void
  archiveAccount: (account: Account) => Promise<void>
  reconcileAccount: (account: Account) => void
  openCurrencies: () => void
  openAddCurrency: () => void
  addCurrency: (code: string) => Promise<void>
  editRate: (code: string) => void
  setBaseCurrency: (code: string) => Promise<void>
  refreshRates: () => Promise<boolean>
  editBudget: (categoryID: string | null) => void
  addMember: (project: Project) => Promise<void>
  editMember: (member: Member) => void
  removeMember: (member: Member) => Promise<void>
  settleUp: (project: Project, row: SettlementPlanRow) => Promise<void>
  openSplitEditor: (request: SplitEditorRequest) => void
  saveEntry: (payload: EntryEditorPayload, editing: LedgerTransaction | null) => Promise<boolean>
}

export interface LedgerUIContext {
  store: import('./lib/store.js').LedgerStore
  t: Translate
  locale: string
  query: string
  monthKey: number
  canMutate: boolean
  actions: LedgerUIActions
  labels: BucketLabels
  storeRevision: number
}

export type LedgerSheetState =
  | { kind: 'entry'; editing: LedgerTransaction | null }
  | { kind: 'account'; editing: Account | null }
  | { kind: 'project'; editing: Project | null }
  | { kind: 'budget'; categoryID: string | null }
  | { kind: 'member'; projectID: string; editing: Member | null }
  | { kind: 'reconcile'; account: Account }
  | { kind: 'rate'; code: string }
  | { kind: 'split'; request: SplitEditorRequest }
  | { kind: 'currencies' | 'addCurrency' | 'recentlyDeleted' | 'ai' }
  | { kind: 'csvPreview'; draft: import('./lib/csv.js').CSVImportDraft }
