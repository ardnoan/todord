export type AccountType = "cash" | "bank" | "credit_card" | "e_wallet";
export type CategoryType = "income" | "expense";
export type TransactionType = "income" | "expense" | "transfer" | "adjustment";
export type TransactionStatus = "pending" | "cleared" | "reconciled";
export type RecurringFrequency = "daily" | "weekly" | "monthly" | "yearly";

export interface FinanceAccount {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  opening_balance: number;
  color: string;
  icon: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinanceCategory {
  id: string;
  user_id: string;
  name: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceTransaction {
  id: string;
  user_id: string;
  account_id: string;
  transfer_account_id: string | null;
  category_id: string | null;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  reference_no: string | null;
  transaction_date: string;
  title: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceBudget {
  id: string;
  user_id: string;
  category_id: string;
  limit_amount: number;
  month: number;
  year: number;
  created_at: string;
  updated_at: string;
}

export interface FinanceRecurringTransaction {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  amount: number;
  type: CategoryType;
  title: string;
  frequency: RecurringFrequency;
  start_date: string;
  next_due_date: string;
  last_processed_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountBalanceSummary {
  account: FinanceAccount;
  openingBalance: number;
  currentBalance: number;
  totalInflow: number;
  totalOutflow: number;
  transactionCount: number;
}

export interface PeriodSummary {
  month: number;
  year: number;
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  transferVolume: number;
  adjustmentNet: number;
  transactionCount: number;
}

export interface BudgetProgress {
  budget: FinanceBudget;
  category: FinanceCategory | undefined;
  limitAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentage: number;
  isOverBudget: boolean;
  isWarning: boolean;
}

export interface MonthlyReportRow {
  month: number;
  label: string;
  income: number;
  expense: number;
  net: number;
}

export interface CategoryReportRow {
  categoryId: string | null;
  categoryName: string;
  type: CategoryType;
  total: number;
  count: number;
  sharePercent: number;
  color: string;
}

export interface AccountReportRow {
  accountId: string;
  accountName: string;
  accountType: AccountType;
  isActive: boolean;
  openingBalance: number;
  inflow: number;
  outflow: number;
  netChange: number;
  currentBalance: number;
}

export interface AppParameterSettings {
  currencyLocale: string;
  currencyCode: string;
  budgetWarningThresholdPercent: number;
  defaultTransactionStatus: TransactionStatus;
  defaultAccountColor: string;
  defaultAccountIcon: string;
  taskCategories: string[];
  defaultFinanceExpenseCategories: string[];
  defaultFinanceIncomeCategories: string[];
  enableFinanceModule: boolean;
}

export type CsvTableKey =
  "accounts" | "categories" | "transactions" | "budgets" | "recurring";

export interface CsvValidationError {
  table: CsvTableKey;
  row: number;
  field: string;
  message: string;
}

export interface CsvImportPayload {
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  transactions: FinanceTransaction[];
  budgets: FinanceBudget[];
  recurring: FinanceRecurringTransaction[];
}

export interface CsvImportPreview {
  payload: CsvImportPayload;
  counts: Record<CsvTableKey, number>;
  duplicateIds: Record<CsvTableKey, string[]>;
  errors: CsvValidationError[];
  hasFatalErrors: boolean;
  hasDuplicates: boolean;
}
