import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  CreditCard,
  FolderTree,
  Landmark,
  LayoutDashboard,
  Pencil,
  PiggyBank,
  Play,
  Plus,
  RefreshCw,
  Search,
  Smartphone,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import {
  calculateAccountReport,
  calculateAllAccountBalances,
  calculateBudgetProgress,
  calculateCategoryReport,
  calculateMonthlyReport,
  calculatePeriodSummary,
  calculateTotalNetBalance,
  formatRupiah,
} from "../../lib/finance/calculations";
import type {
  AccountType,
  AppParameterSettings,
  CategoryType,
  CsvImportPreview,
  FinanceAccount,
  FinanceBudget,
  FinanceCategory,
  FinanceRecurringTransaction,
  FinanceTransaction,
  RecurringFrequency,
  TransactionStatus,
  TransactionType,
} from "../../lib/finance/types";
import {
  validateBudgetInput,
  validateCategoryHierarchy,
  validateTransactionInput,
} from "../../lib/finance/validation";
import {
  commitCsvImport,
  deactivateOrDeleteAccount,
  deleteFinanceBudget,
  deleteFinanceCategory,
  deleteFinanceRecurring,
  deleteFinanceTransaction,
  executeRecurringRule,
  fetchFinanceBundle,
  upsertFinanceAccount,
  upsertFinanceBudget,
  upsertFinanceCategory,
  upsertFinanceRecurring,
  upsertFinanceTransaction,
} from "../../services/financeService";
import { ApexChart } from "./ApexChart";
import { CurrencyInput } from "./CurrencyInput";
import { FinanceCsvTab } from "./FinanceCsvTab";

type FinanceTab =
  | "dashboard"
  | "accounts"
  | "categories"
  | "transactions"
  | "budgets"
  | "recurring"
  | "reports"
  | "csv";

interface FinanceViewProps {
  userId: string;
  userName: string;
  parameters: AppParameterSettings;
}

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: "Tunai",
  bank: "Bank",
  credit_card: "Kartu Kredit",
  e_wallet: "E-Wallet",
};

const TX_TYPE_LABELS: Record<TransactionType, string> = {
  income: "Pemasukan",
  expense: "Pengeluaran",
  transfer: "Transfer",
  adjustment: "Penyesuaian",
};

const STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: "Pending",
  cleared: "Cleared",
  reconciled: "Reconciled",
};

const FREQ_LABELS: Record<RecurringFrequency, string> = {
  daily: "Harian",
  weekly: "Mingguan",
  monthly: "Bulanan",
  yearly: "Tahunan",
};

function AccountIcon({ type }: { type: AccountType }) {
  if (type === "bank") return <Landmark size={18} />;
  if (type === "credit_card") return <CreditCard size={18} />;
  if (type === "e_wallet") return <Smartphone size={18} />;
  return <Wallet size={18} />;
}

export function FinanceView({
  userId,
  userName,
  parameters,
}: FinanceViewProps) {
  const now = new Date();
  const [activeTab, setActiveTab] = useState<FinanceTab>("dashboard");
  const [selectedMonth, setSelectedMonth] = useState<number>(
    now.getMonth() + 1
  );
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [budgets, setBudgets] = useState<FinanceBudget[]>([]);
  const [recurring, setRecurring] = useState<FinanceRecurringTransaction[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Transaction filters
  const [txSearch, setTxSearch] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState<TransactionType | "all">(
    "all"
  );
  const [txStatusFilter, setTxStatusFilter] = useState<
    TransactionStatus | "all"
  >("all");
  const [txAccountFilter, setTxAccountFilter] = useState<string>("all");
  const [txCategoryFilter, setTxCategoryFilter] = useState<string>("all");

  // Modal states
  const [accountModal, setAccountModal] = useState<
    FinanceAccount | null | undefined
  >(undefined);
  const [categoryModal, setCategoryModal] = useState<
    FinanceCategory | null | undefined
  >(undefined);
  const [txModal, setTxModal] = useState<
    FinanceTransaction | null | undefined
  >(undefined);
  const [budgetModal, setBudgetModal] = useState<
    FinanceBudget | null | undefined
  >(undefined);
  const [recurringModal, setRecurringModal] = useState<
    FinanceRecurringTransaction | null | undefined
  >(undefined);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const bundle = await fetchFinanceBundle(userId);
      setAccounts(bundle.accounts);
      setCategories(bundle.categories);
      setTransactions(bundle.transactions);
      setBudgets(bundle.budgets);
      setRecurring(bundle.recurring);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal memuat data keuangan dari Supabase. Pastikan migrasi SQL sudah dijalankan."
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3500);
  };

  // Derived calculations
  const accountBalances = useMemo(
    () => calculateAllAccountBalances(accounts, transactions),
    [accounts, transactions]
  );

  const totalNetBalance = useMemo(
    () => calculateTotalNetBalance(accounts, transactions, false),
    [accounts, transactions]
  );

  const periodSummary = useMemo(
    () => calculatePeriodSummary(transactions, selectedMonth, selectedYear),
    [transactions, selectedMonth, selectedYear]
  );

  const budgetProgressList = useMemo(
    () =>
      calculateBudgetProgress(
        budgets,
        categories,
        transactions,
        selectedMonth,
        selectedYear,
        parameters.budgetWarningThresholdPercent
      ),
    [
      budgets,
      categories,
      transactions,
      selectedMonth,
      selectedYear,
      parameters.budgetWarningThresholdPercent,
    ]
  );

  const monthlyReport = useMemo(
    () => calculateMonthlyReport(transactions, selectedYear),
    [transactions, selectedYear]
  );

  const expenseCategoryReport = useMemo(
    () =>
      calculateCategoryReport(
        transactions,
        categories,
        "expense",
        selectedMonth,
        selectedYear
      ),
    [transactions, categories, selectedMonth, selectedYear]
  );

  const incomeCategoryReport = useMemo(
    () =>
      calculateCategoryReport(
        transactions,
        categories,
        "income",
        selectedMonth,
        selectedYear
      ),
    [transactions, categories, selectedMonth, selectedYear]
  );

  const accountReport = useMemo(
    () => calculateAccountReport(accounts, transactions),
    [accounts, transactions]
  );

  const filteredTransactions = useMemo(() => {
    const q = txSearch.trim().toLowerCase();
    return transactions.filter((tx) => {
      const dt = new Date(tx.transaction_date);
      if (
        dt.getUTCFullYear() !== selectedYear ||
        dt.getUTCMonth() + 1 !== selectedMonth
      ) {
        return false;
      }
      if (txTypeFilter !== "all" && tx.type !== txTypeFilter) return false;
      if (txStatusFilter !== "all" && tx.status !== txStatusFilter) return false;
      if (
        txAccountFilter !== "all" &&
        tx.account_id !== txAccountFilter &&
        tx.transfer_account_id !== txAccountFilter
      ) {
        return false;
      }
      if (txCategoryFilter !== "all" && tx.category_id !== txCategoryFilter) {
        return false;
      }
      if (q) {
        const hay = `${tx.title} ${tx.notes ?? ""} ${
          tx.reference_no ?? ""
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    transactions,
    selectedMonth,
    selectedYear,
    txTypeFilter,
    txStatusFilter,
    txAccountFilter,
    txCategoryFilter,
    txSearch,
  ]);

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const fmt = (amount: number) =>
    formatRupiah(amount, parameters.currencyLocale, parameters.currencyCode);

  const tabs: { id: FinanceTab; label: string; icon: JSX.Element }[] = [
    { id: "dashboard", label: "Ringkasan", icon: <LayoutDashboard size={15} /> },
    { id: "accounts", label: "Akun", icon: <Wallet size={15} /> },
    { id: "categories", label: "Kategori", icon: <FolderTree size={15} /> },
    {
      id: "transactions",
      label: "Transaksi",
      icon: <ArrowLeftRight size={15} />,
    },
    { id: "budgets", label: "Budget", icon: <PiggyBank size={15} /> },
    { id: "recurring", label: "Berulang", icon: <CalendarClock size={15} /> },
    { id: "reports", label: "Laporan", icon: <BarChart3 size={15} /> },
    { id: "csv", label: "Impor / Ekspor", icon: <Upload size={15} /> },
  ];

  async function handleExecuteRecurring(rule: FinanceRecurringTransaction) {
    const todayIso = new Date().toISOString().slice(0, 10);
    try {
      const res = await executeRecurringRule(userId, rule, todayIso);
      if (res.executed) {
        showNotice(`Transaksi berulang "${rule.title}" berhasil dieksekusi.`);
        await loadData();
      } else {
        showNotice(
          res.reason === "not_due"
            ? `Belum jatuh tempo (berikutnya: ${rule.next_due_date}).`
            : res.reason === "already_processed"
            ? "Sudah diproses untuk periode ini (tidak digandakan)."
            : "Aturan berulang tidak aktif."
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal mengeksekusi transaksi."
      );
    }
  }

  async function handleCommitCsvImport(
    payload: CsvImportPreview["payload"],
    allowUpsert: boolean
  ) {
    await commitCsvImport(payload, allowUpsert);
    await loadData();
    showNotice("Impor CSV selesai dan saldo telah dihitung ulang.");
  }

  return (
    <section className="finance-shell">
      {/* Top Hero & Period Selector */}
      <div className="finance-hero-card">
        <div>
          <span className="eyebrow">FINANCE MANAGER · PERSONAL</span>
          <h1>Keuangan {userName}</h1>
          <p className="finance-subtitle">
            Saldo dihitung langsung dari <code>opening_balance</code> + seluruh
            transaksi.
          </p>
        </div>

        <div className="finance-hero-controls">
          <div className="finance-period-picker">
            <select
              aria-label="Pilih Bulan"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
            <input
              type="number"
              aria-label="Pilih Tahun"
              min={2000}
              max={2100}
              value={selectedYear}
              onChange={(e) =>
                setSelectedYear(Number(e.target.value) || now.getFullYear())
              }
            />
          </div>

          <button
            type="button"
            className="button-quiet"
            onClick={loadData}
            title="Muat ulang data"
          >
            <RefreshCw size={15} />
          </button>

          <button
            type="button"
            className="button-primary"
            onClick={() => setTxModal(null)}
            disabled={accounts.length === 0}
          >
            <Plus size={16} /> Catat Transaksi
          </button>
        </div>
      </div>

      {/* Sub-navigation tabs */}
      <nav className="finance-tabs" aria-label="Menu Keuangan">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`finance-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {error && (
        <div className="error-banner" role="alert">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {notice && (
        <div className="success-banner" role="status">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="finance-loading">
          <span className="loader" /> Memuat data keuangan...
        </div>
      ) : (
        <>
          {/* 1. DASHBOARD TAB */}
          {activeTab === "dashboard" && (
            <div className="finance-stack">
              <div className="finance-kpi-grid">
                <div className="finance-kpi-card highlight">
                  <span className="kpi-label">Total Saldo Aktif</span>
                  <strong className="kpi-value">{fmt(totalNetBalance)}</strong>
                  <span className="kpi-meta">
                    {accounts.filter((a) => a.is_active).length} akun aktif
                  </span>
                </div>
                <div className="finance-kpi-card">
                  <span className="kpi-label">
                    Pemasukan ({MONTH_NAMES[selectedMonth - 1]})
                  </span>
                  <strong className="kpi-value income">
                    <TrendingUp size={18} /> {fmt(periodSummary.totalIncome)}
                  </strong>
                  <span className="kpi-meta">
                    {periodSummary.transactionCount} transaksi periode ini
                  </span>
                </div>
                <div className="finance-kpi-card">
                  <span className="kpi-label">
                    Pengeluaran ({MONTH_NAMES[selectedMonth - 1]})
                  </span>
                  <strong className="kpi-value expense">
                    <TrendingDown size={18} /> {fmt(periodSummary.totalExpense)}
                  </strong>
                  <span className="kpi-meta">
                    Transfer: {fmt(periodSummary.transferVolume)}
                  </span>
                </div>
                <div className="finance-kpi-card">
                  <span className="kpi-label">Arus Kas Bersih</span>
                  <strong
                    className={`kpi-value ${
                      periodSummary.netCashflow >= 0 ? "income" : "expense"
                    }`}
                  >
                    {fmt(periodSummary.netCashflow)}
                  </strong>
                  <span className="kpi-meta">Pemasukan - Pengeluaran</span>
                </div>
              </div>

              <div className="finance-two-col">
                {/* Per-Account Balances */}
                <div className="finance-card">
                  <div className="finance-card-header">
                    <h3>Saldo per Akun</h3>
                    <button
                      type="button"
                      className="button-quiet"
                      onClick={() => setActiveTab("accounts")}
                    >
                      Kelola <ArrowUpRight size={14} />
                    </button>
                  </div>
                  {accountBalances.length === 0 ? (
                    <div className="finance-empty">
                      <p>Belum ada akun keuangan.</p>
                      <button
                        type="button"
                        className="button-primary"
                        onClick={() => setAccountModal(null)}
                      >
                        <Plus size={15} /> Tambah Akun Pertama
                      </button>
                    </div>
                  ) : (
                    <div className="finance-account-list">
                      {accountBalances.map((item) => (
                        <div
                          key={item.account.id}
                          className={`finance-account-row ${
                            !item.account.is_active ? "inactive" : ""
                          }`}
                        >
                          <div className="account-row-left">
                            <span
                              className="account-badge"
                              style={{ backgroundColor: item.account.color }}
                            >
                              <AccountIcon type={item.account.type} />
                            </span>
                            <div>
                              <strong>{item.account.name}</strong>
                              <span className="finance-muted">
                                {ACCOUNT_TYPE_LABELS[item.account.type]}
                                {!item.account.is_active && " · Nonaktif"}
                              </span>
                            </div>
                          </div>
                          <div className="account-row-right">
                            <strong>{fmt(item.currentBalance)}</strong>
                            <span className="finance-muted">
                              Awal: {fmt(item.openingBalance)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Budget Progress */}
                <div className="finance-card">
                  <div className="finance-card-header">
                    <h3>
                      Progres Budget ({MONTH_NAMES[selectedMonth - 1]}{" "}
                      {selectedYear})
                    </h3>
                    <button
                      type="button"
                      className="button-quiet"
                      onClick={() => setActiveTab("budgets")}
                    >
                      Atur <ArrowUpRight size={14} />
                    </button>
                  </div>
                  {budgetProgressList.length === 0 ? (
                    <div className="finance-empty">
                      <p>Belum ada budget untuk periode ini.</p>
                      <button
                        type="button"
                        className="button-quiet"
                        onClick={() => setActiveTab("budgets")}
                      >
                        Buat Budget
                      </button>
                    </div>
                  ) : (
                    <div className="finance-budget-list">
                      {budgetProgressList.map((bp) => (
                        <div key={bp.budget.id} className="budget-item">
                          <div className="budget-item-top">
                            <strong>
                              {bp.category?.name ?? "Kategori Dihapus"}
                            </strong>
                            <span>
                              {fmt(bp.spentAmount)} / {fmt(bp.limitAmount)} (
                              {bp.percentage}%)
                            </span>
                          </div>
                          <div className="budget-bar-track">
                            <div
                              className={`budget-bar-fill ${
                                bp.isOverBudget
                                  ? "over"
                                  : bp.isWarning
                                  ? "warn"
                                  : "ok"
                              }`}
                              style={{
                                width: `${Math.min(100, bp.percentage)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="finance-card">
                <div className="finance-card-header">
                  <h3>Transaksi Terbaru</h3>
                  <button
                    type="button"
                    className="button-quiet"
                    onClick={() => setActiveTab("transactions")}
                  >
                    Lihat Semua <ArrowUpRight size={14} />
                  </button>
                </div>
                {transactions.length === 0 ? (
                  <div className="finance-empty">
                    <p>Belum ada transaksi tercatat.</p>
                  </div>
                ) : (
                  <div className="finance-tx-list">
                    {transactions.slice(0, 6).map((tx) => {
                      const acc = accountMap.get(tx.account_id);
                      const targetAcc = tx.transfer_account_id
                        ? accountMap.get(tx.transfer_account_id)
                        : undefined;
                      const cat = tx.category_id
                        ? categoryMap.get(tx.category_id)
                        : undefined;
                      return (
                        <div key={tx.id} className="finance-tx-row">
                          <div>
                            <strong>{tx.title}</strong>
                            <span className="finance-muted">
                              {acc?.name ?? "Akun"}
                              {targetAcc ? ` → ${targetAcc.name}` : ""}
                              {cat ? ` · ${cat.name}` : ""} ·{" "}
                              {new Date(tx.transaction_date).toLocaleDateString(
                                "id-ID"
                              )}
                            </span>
                          </div>
                          <div className="tx-right">
                            <strong className={`tx-amount ${tx.type}`}>
                              {tx.type === "expense" ? "-" : ""}
                              {tx.type === "income" ? "+" : ""}
                              {fmt(tx.amount)}
                            </strong>
                            <span className={`tx-status status-${tx.status}`}>
                              {STATUS_LABELS[tx.status]}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. ACCOUNTS TAB */}
          {activeTab === "accounts" && (
            <div className="finance-card">
              <div className="finance-card-header">
                <div>
                  <h3>Daftar Akun Keuangan</h3>
                  <p className="finance-muted">
                    Akun yang sudah memiliki transaksi akan dinonaktifkan
                    (soft-delete) agar riwayat saldo tetap terjaga.
                  </p>
                </div>
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => setAccountModal(null)}
                >
                  <Plus size={15} /> Tambah Akun
                </button>
              </div>

              {accountBalances.length === 0 ? (
                <div className="finance-empty">
                  <p>Belum ada akun. Buat akun kas, bank, atau e-wallet.</p>
                </div>
              ) : (
                <div className="finance-table-wrap">
                  <table className="finance-table">
                    <thead>
                      <tr>
                        <th>Nama Akun</th>
                        <th>Tipe</th>
                        <th>Status</th>
                        <th>Saldo Awal</th>
                        <th>Saldo Berjalan</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountBalances.map((item) => (
                        <tr key={item.account.id}>
                          <td>
                            <div className="account-cell">
                              <span
                                className="account-dot"
                                style={{ backgroundColor: item.account.color }}
                              />
                              <strong>{item.account.name}</strong>
                            </div>
                          </td>
                          <td>{ACCOUNT_TYPE_LABELS[item.account.type]}</td>
                          <td>
                            <span
                              className={`pill ${
                                item.account.is_active ? "pill-ok" : "pill-muted"
                              }`}
                            >
                              {item.account.is_active ? "Aktif" : "Nonaktif"}
                            </span>
                          </td>
                          <td>{fmt(item.openingBalance)}</td>
                          <td>
                            <strong>{fmt(item.currentBalance)}</strong>
                          </td>
                          <td className="actions-cell">
                            <button
                              type="button"
                              className="icon-btn"
                              title="Edit akun"
                              onClick={() => setAccountModal(item.account)}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn danger"
                              title={
                                item.transactionCount > 0
                                  ? "Nonaktifkan akun"
                                  : "Hapus akun"
                              }
                              onClick={() =>
                                setConfirmAction({
                                  title:
                                    item.transactionCount > 0
                                      ? "Nonaktifkan Akun?"
                                      : "Hapus Akun?",
                                  message:
                                    item.transactionCount > 0
                                      ? `Akun "${item.account.name}" memiliki ${item.transactionCount} transaksi dan akan dinonaktifkan agar histori tidak hilang.`
                                      : `Hapus permanen akun "${item.account.name}"?`,
                                  confirmLabel:
                                    item.transactionCount > 0
                                      ? "Nonaktifkan"
                                      : "Hapus",
                                  onConfirm: async () => {
                                    await deactivateOrDeleteAccount(
                                      userId,
                                      item.account.id,
                                      item.transactionCount > 0
                                    );
                                    await loadData();
                                    showNotice(
                                      item.transactionCount > 0
                                        ? "Akun dinonaktifkan."
                                        : "Akun dihapus."
                                    );
                                  },
                                })
                              }
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 3. CATEGORIES TAB */}
          {activeTab === "categories" && (
            <div className="finance-card">
              <div className="finance-card-header">
                <div>
                  <h3>Kategori Pemasukan &amp; Pengeluaran</h3>
                  <p className="finance-muted">
                    Mendukung kategori induk-anak dengan tipe yang sama.
                  </p>
                </div>
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => setCategoryModal(null)}
                >
                  <Plus size={15} /> Tambah Kategori
                </button>
              </div>

              {categories.length === 0 ? (
                <div className="finance-empty">
                  <p>Belum ada kategori.</p>
                </div>
              ) : (
                <div className="finance-two-col">
                  {(["expense", "income"] as CategoryType[]).map((catType) => {
                    const list = categories.filter((c) => c.type === catType);
                    const parents = list.filter((c) => !c.parent_id);
                    return (
                      <div key={catType} className="category-group-box">
                        <h4>
                          {catType === "expense"
                            ? "Kategori Pengeluaran"
                            : "Kategori Pemasukan"}
                        </h4>
                        {list.length === 0 ? (
                          <p className="finance-muted">Belum ada kategori.</p>
                        ) : (
                          <div className="category-tree">
                            {parents.map((parent) => {
                              const children = list.filter(
                                (c) => c.parent_id === parent.id
                              );
                              return (
                                <div key={parent.id} className="cat-branch">
                                  <div className="cat-row">
                                    <span>
                                      <span
                                        className="account-dot"
                                        style={{
                                          backgroundColor:
                                            parent.color ?? "#397a60",
                                        }}
                                      />
                                      <strong>{parent.name}</strong>
                                    </span>
                                    <span className="actions-cell">
                                      <button
                                        type="button"
                                        className="icon-btn"
                                        onClick={() => setCategoryModal(parent)}
                                      >
                                        <Pencil size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        className="icon-btn danger"
                                        onClick={() =>
                                          setConfirmAction({
                                            title: "Hapus Kategori?",
                                            message: `Hapus kategori "${parent.name}"?`,
                                            confirmLabel: "Hapus",
                                            onConfirm: async () => {
                                              await deleteFinanceCategory(
                                                userId,
                                                parent.id
                                              );
                                              await loadData();
                                              showNotice("Kategori dihapus.");
                                            },
                                          })
                                        }
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </span>
                                  </div>
                                  {children.map((child) => (
                                    <div
                                      key={child.id}
                                      className="cat-row cat-child"
                                    >
                                      <span>↳ {child.name}</span>
                                      <span className="actions-cell">
                                        <button
                                          type="button"
                                          className="icon-btn"
                                          onClick={() => setCategoryModal(child)}
                                        >
                                          <Pencil size={13} />
                                        </button>
                                        <button
                                          type="button"
                                          className="icon-btn danger"
                                          onClick={() =>
                                            setConfirmAction({
                                              title: "Hapus Kategori Anak?",
                                              message: `Hapus kategori "${child.name}"?`,
                                              confirmLabel: "Hapus",
                                              onConfirm: async () => {
                                                await deleteFinanceCategory(
                                                  userId,
                                                  child.id
                                                );
                                                await loadData();
                                                showNotice("Kategori dihapus.");
                                              },
                                            })
                                          }
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 4. TRANSACTIONS TAB */}
          {activeTab === "transactions" && (
            <div className="finance-card">
              <div className="finance-card-header">
                <h3>
                  Transaksi ({MONTH_NAMES[selectedMonth - 1]} {selectedYear})
                </h3>
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => setTxModal(null)}
                  disabled={accounts.length === 0}
                >
                  <Plus size={15} /> Tambah Transaksi
                </button>
              </div>

              <div className="finance-filter-bar">
                <label className="finance-search-input">
                  <Search size={15} />
                  <input
                    type="text"
                    placeholder="Cari judul, catatan, referensi..."
                    value={txSearch}
                    onChange={(e) => setTxSearch(e.target.value)}
                  />
                </label>

                <select
                  value={txTypeFilter}
                  onChange={(e) =>
                    setTxTypeFilter(
                      e.target.value as TransactionType | "all"
                    )
                  }
                >
                  <option value="all">Semua Tipe</option>
                  <option value="income">Pemasukan</option>
                  <option value="expense">Pengeluaran</option>
                  <option value="transfer">Transfer</option>
                  <option value="adjustment">Penyesuaian</option>
                </select>

                <select
                  value={txStatusFilter}
                  onChange={(e) =>
                    setTxStatusFilter(
                      e.target.value as TransactionStatus | "all"
                    )
                  }
                >
                  <option value="all">Semua Status</option>
                  <option value="pending">Pending</option>
                  <option value="cleared">Cleared</option>
                  <option value="reconciled">Reconciled</option>
                </select>

                <select
                  value={txAccountFilter}
                  onChange={(e) => setTxAccountFilter(e.target.value)}
                >
                  <option value="all">Semua Akun</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>

                <select
                  value={txCategoryFilter}
                  onChange={(e) => setTxCategoryFilter(e.target.value)}
                >
                  <option value="all">Semua Kategori</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </div>

              {filteredTransactions.length === 0 ? (
                <div className="finance-empty">
                  <p>Tidak ada transaksi sesuai filter pada periode ini.</p>
                </div>
              ) : (
                <div className="finance-table-wrap">
                  <table className="finance-table">
                    <thead>
                      <tr>
                        <th>Tanggal</th>
                        <th>Judul</th>
                        <th>Tipe</th>
                        <th>Akun</th>
                        <th>Kategori</th>
                        <th>Status</th>
                        <th>Nominal</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((tx) => {
                        const acc = accountMap.get(tx.account_id);
                        const targetAcc = tx.transfer_account_id
                          ? accountMap.get(tx.transfer_account_id)
                          : undefined;
                        const cat = tx.category_id
                          ? categoryMap.get(tx.category_id)
                          : undefined;
                        return (
                          <tr key={tx.id}>
                            <td>
                              {new Date(tx.transaction_date).toLocaleDateString(
                                "id-ID"
                              )}
                            </td>
                            <td>
                              <strong>{tx.title}</strong>
                              {tx.reference_no && (
                                <span className="finance-muted">
                                  {" "}
                                  ({tx.reference_no})
                                </span>
                              )}
                            </td>
                            <td>{TX_TYPE_LABELS[tx.type]}</td>
                            <td>
                              {acc?.name ?? "-"}
                              {targetAcc ? ` → ${targetAcc.name}` : ""}
                            </td>
                            <td>{cat?.name ?? "-"}</td>
                            <td>
                              <span className={`tx-status status-${tx.status}`}>
                                {STATUS_LABELS[tx.status]}
                              </span>
                            </td>
                            <td>
                              <strong className={`tx-amount ${tx.type}`}>
                                {tx.type === "expense" ? "-" : ""}
                                {tx.type === "income" ? "+" : ""}
                                {fmt(tx.amount)}
                              </strong>
                            </td>
                            <td className="actions-cell">
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() => setTxModal(tx)}
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn danger"
                                onClick={() =>
                                  setConfirmAction({
                                    title: "Hapus Transaksi?",
                                    message: `Hapus transaksi "${tx.title}"? Saldo akun akan dihitung ulang otomatis.`,
                                    confirmLabel: "Hapus",
                                    onConfirm: async () => {
                                      await deleteFinanceTransaction(
                                        userId,
                                        tx.id
                                      );
                                      await loadData();
                                      showNotice("Transaksi dihapus.");
                                    },
                                  })
                                }
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 5. BUDGETS TAB */}
          {activeTab === "budgets" && (
            <div className="finance-card">
              <div className="finance-card-header">
                <div>
                  <h3>
                    Budget Pengeluaran ({MONTH_NAMES[selectedMonth - 1]}{" "}
                    {selectedYear})
                  </h3>
                  <p className="finance-muted">
                    <code>spent_amount</code> dihitung dari transaksi expense
                    pada kategori dan periode tersebut.
                  </p>
                </div>
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => setBudgetModal(null)}
                >
                  <Plus size={15} /> Tambah Budget
                </button>
              </div>

              {budgetProgressList.length === 0 ? (
                <div className="finance-empty">
                  <p>Belum ada budget untuk periode ini.</p>
                </div>
              ) : (
                <div className="finance-budget-list">
                  {budgetProgressList.map((bp) => (
                    <div key={bp.budget.id} className="budget-item detailed">
                      <div className="budget-item-top">
                        <div>
                          <strong>
                            {bp.category?.name ?? "Kategori Dihapus"}
                          </strong>
                          <span className="finance-muted">
                            {" "}
                            · Sisa: {fmt(bp.remainingAmount)}
                          </span>
                        </div>
                        <div className="actions-cell">
                          <span>
                            {fmt(bp.spentAmount)} / {fmt(bp.limitAmount)} (
                            {bp.percentage}%)
                          </span>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => setBudgetModal(bp.budget)}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn danger"
                            onClick={() =>
                              setConfirmAction({
                                title: "Hapus Budget?",
                                message: `Hapus budget untuk kategori "${
                                  bp.category?.name ?? ""
                                }"?`,
                                confirmLabel: "Hapus",
                                onConfirm: async () => {
                                  await deleteFinanceBudget(
                                    userId,
                                    bp.budget.id
                                  );
                                  await loadData();
                                  showNotice("Budget dihapus.");
                                },
                              })
                            }
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <div className="budget-bar-track">
                        <div
                          className={`budget-bar-fill ${
                            bp.isOverBudget
                              ? "over"
                              : bp.isWarning
                              ? "warn"
                              : "ok"
                          }`}
                          style={{
                            width: `${Math.min(100, bp.percentage)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 6. RECURRING TAB */}
          {activeTab === "recurring" && (
            <div className="finance-card">
              <div className="finance-card-header">
                <div>
                  <h3>Transaksi Berulang</h3>
                  <p className="finance-muted">
                    Eksekusi membuat 1 transaksi biasa dan memajukan{" "}
                    <code>next_due_date</code> secara idempoten.
                  </p>
                </div>
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => setRecurringModal(null)}
                  disabled={accounts.length === 0}
                >
                  <Plus size={15} /> Tambah Jadwal
                </button>
              </div>

              {recurring.length === 0 ? (
                <div className="finance-empty">
                  <p>Belum ada transaksi berulang.</p>
                </div>
              ) : (
                <div className="finance-table-wrap">
                  <table className="finance-table">
                    <thead>
                      <tr>
                        <th>Judul</th>
                        <th>Frekuensi</th>
                        <th>Akun</th>
                        <th>Nominal</th>
                        <th>Jatuh Tempo</th>
                        <th>Terakhir Diproses</th>
                        <th>Status</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recurring.map((rule) => (
                        <tr key={rule.id}>
                          <td>
                            <strong>{rule.title}</strong>
                          </td>
                          <td>{FREQ_LABELS[rule.frequency]}</td>
                          <td>{accountMap.get(rule.account_id)?.name ?? "-"}</td>
                          <td>
                            <strong className={`tx-amount ${rule.type}`}>
                              {rule.type === "expense" ? "-" : "+"}
                              {fmt(rule.amount)}
                            </strong>
                          </td>
                          <td>{rule.next_due_date}</td>
                          <td>{rule.last_processed_date ?? "-"}</td>
                          <td>
                            <span
                              className={`pill ${
                                rule.is_active ? "pill-ok" : "pill-muted"
                              }`}
                            >
                              {rule.is_active ? "Aktif" : "Nonaktif"}
                            </span>
                          </td>
                          <td className="actions-cell">
                            <button
                              type="button"
                              className="button-quiet btn-xs"
                              onClick={() => handleExecuteRecurring(rule)}
                              title="Eksekusi jika jatuh tempo"
                            >
                              <Play size={12} /> Eksekusi
                            </button>
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => setRecurringModal(rule)}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn danger"
                              onClick={() =>
                                setConfirmAction({
                                  title: "Hapus Jadwal Berulang?",
                                  message: `Hapus aturan "${rule.title}"?`,
                                  confirmLabel: "Hapus",
                                  onConfirm: async () => {
                                    await deleteFinanceRecurring(
                                      userId,
                                      rule.id
                                    );
                                    await loadData();
                                    showNotice("Jadwal berulang dihapus.");
                                  },
                                })
                              }
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 7. REPORTS TAB */}
          {activeTab === "reports" && (
            <div className="finance-stack">
              <div className="finance-card">
                <h3>Ringkasan Bulanan ({selectedYear})</h3>
                <ApexChart
                  type="bar"
                  height={280}
                  series={[
                    {
                      name: "Pemasukan",
                      data: monthlyReport.map((r) => r.income),
                    },
                    {
                      name: "Pengeluaran",
                      data: monthlyReport.map((r) => r.expense),
                    },
                  ]}
                  options={{
                    colors: ["#16a34a", "#dc2626"],
                    plotOptions: {
                      bar: {
                        borderRadius: 6,
                        columnWidth: "52%",
                      },
                    },
                    dataLabels: { enabled: false },
                    xaxis: {
                      categories: monthlyReport.map((r) => r.label),
                    },
                    yaxis: {
                      labels: {
                        formatter: (val) => fmt(val),
                      },
                    },
                    tooltip: {
                      y: {
                        formatter: (val) => fmt(val ?? 0),
                      },
                    },
                    legend: { position: "top" },
                  }}
                />
                <div className="finance-table-wrap">
                  <table className="finance-table">
                    <thead>
                      <tr>
                        <th>Bulan</th>
                        <th>Pemasukan</th>
                        <th>Pengeluaran</th>
                        <th>Bersih</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyReport.map((row) => (
                        <tr key={row.month}>
                          <td>
                            <strong>{row.label}</strong>
                          </td>
                          <td className="tx-amount income">
                            {fmt(row.income)}
                          </td>
                          <td className="tx-amount expense">
                            {fmt(row.expense)}
                          </td>
                          <td>
                            <strong
                              className={
                                row.net >= 0
                                  ? "tx-amount income"
                                  : "tx-amount expense"
                              }
                            >
                              {fmt(row.net)}
                            </strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="finance-two-col">
                <div className="finance-card">
                  <h3>
                    Pengeluaran per Kategori ({MONTH_NAMES[selectedMonth - 1]}{" "}
                    {selectedYear})
                  </h3>
                  {expenseCategoryReport.length === 0 ? (
                    <div className="finance-empty">
                      <p>Belum ada pengeluaran pada periode ini.</p>
                    </div>
                  ) : (
                    <>
                      <ApexChart
                        type="donut"
                        height={260}
                        series={expenseCategoryReport.map((i) => i.total)}
                        options={{
                          labels: expenseCategoryReport.map(
                            (i) => `${i.categoryName} (${i.count}x)`
                          ),
                          colors: expenseCategoryReport.map((i) => i.color),
                          legend: { position: "bottom" },
                          dataLabels: {
                            enabled: true,
                            formatter: (val) =>
                              `${Number(val).toFixed(1)}%`,
                          },
                          tooltip: {
                            y: {
                              formatter: (val) => fmt(val ?? 0),
                            },
                          },
                          plotOptions: {
                            pie: {
                              donut: {
                                size: "65%",
                                labels: {
                                  show: true,
                                  total: {
                                    show: true,
                                    label: "Total",
                                    formatter: () =>
                                      fmt(
                                        expenseCategoryReport.reduce(
                                          (s, i) => s + i.total,
                                          0
                                        )
                                      ),
                                  },
                                },
                              },
                            },
                          },
                        }}
                      />
                      <div className="finance-report-list">
                        {expenseCategoryReport.map((item) => (
                          <div
                            key={item.categoryId ?? "none"}
                            className="report-summary-row"
                          >
                            <span className="account-cell">
                              <span
                                className="account-dot"
                                style={{ backgroundColor: item.color }}
                              />
                              {item.categoryName} ({item.count}x)
                            </span>
                            <strong>
                              {fmt(item.total)} ({item.sharePercent}%)
                            </strong>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="finance-card">
                  <h3>
                    Pemasukan per Kategori ({MONTH_NAMES[selectedMonth - 1]}{" "}
                    {selectedYear})
                  </h3>
                  {incomeCategoryReport.length === 0 ? (
                    <div className="finance-empty">
                      <p>Belum ada pemasukan pada periode ini.</p>
                    </div>
                  ) : (
                    <>
                      <ApexChart
                        type="donut"
                        height={260}
                        series={incomeCategoryReport.map((i) => i.total)}
                        options={{
                          labels: incomeCategoryReport.map(
                            (i) => `${i.categoryName} (${i.count}x)`
                          ),
                          colors: incomeCategoryReport.map((i) => i.color),
                          legend: { position: "bottom" },
                          dataLabels: {
                            enabled: true,
                            formatter: (val) =>
                              `${Number(val).toFixed(1)}%`,
                          },
                          tooltip: {
                            y: {
                              formatter: (val) => fmt(val ?? 0),
                            },
                          },
                          plotOptions: {
                            pie: {
                              donut: {
                                size: "65%",
                                labels: {
                                  show: true,
                                  total: {
                                    show: true,
                                    label: "Total",
                                    formatter: () =>
                                      fmt(
                                        incomeCategoryReport.reduce(
                                          (s, i) => s + i.total,
                                          0
                                        )
                                      ),
                                  },
                                },
                              },
                            },
                          },
                        }}
                      />
                      <div className="finance-report-list">
                        {incomeCategoryReport.map((item) => (
                          <div
                            key={item.categoryId ?? "none"}
                            className="report-summary-row"
                          >
                            <span className="account-cell">
                              <span
                                className="account-dot"
                                style={{ backgroundColor: item.color }}
                              />
                              {item.categoryName} ({item.count}x)
                            </span>
                            <strong>
                              {fmt(item.total)} ({item.sharePercent}%)
                            </strong>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="finance-card">
                <h3>Ringkasan per Akun (Semua Periode)</h3>
                <div className="finance-table-wrap">
                  <table className="finance-table">
                    <thead>
                      <tr>
                        <th>Akun</th>
                        <th>Saldo Awal</th>
                        <th>Total Masuk</th>
                        <th>Total Keluar</th>
                        <th>Saldo Berjalan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountReport.map((row) => (
                        <tr key={row.accountId}>
                          <td>
                            <strong>{row.accountName}</strong>
                            {!row.isActive && " (Nonaktif)"}
                          </td>
                          <td>{fmt(row.openingBalance)}</td>
                          <td className="tx-amount income">
                            {fmt(row.inflow)}
                          </td>
                          <td className="tx-amount expense">
                            {fmt(row.outflow)}
                          </td>
                          <td>
                            <strong>{fmt(row.currentBalance)}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 8. CSV IMPORT/EXPORT TAB */}
          {activeTab === "csv" && (
            <FinanceCsvTab
              userId={userId}
              accounts={accounts}
              categories={categories}
              transactions={transactions}
              budgets={budgets}
              recurring={recurring}
              onCommitImport={handleCommitCsvImport}
            />
          )}
        </>
      )}

      {/* MODALS */}
      {accountModal !== undefined && (
        <AccountFormModal
          account={accountModal}
          defaultColor={parameters.defaultAccountColor}
          onClose={() => setAccountModal(undefined)}
          onSave={async (input) => {
            await upsertFinanceAccount(userId, input);
            await loadData();
            setAccountModal(undefined);
            showNotice("Akun berhasil disimpan.");
          }}
        />
      )}

      {categoryModal !== undefined && (
        <CategoryFormModal
          category={categoryModal}
          userId={userId}
          categories={categories}
          onClose={() => setCategoryModal(undefined)}
          onSave={async (input) => {
            await upsertFinanceCategory(userId, input);
            await loadData();
            setCategoryModal(undefined);
            showNotice("Kategori berhasil disimpan.");
          }}
        />
      )}

      {txModal !== undefined && (
        <TransactionFormModal
          transaction={txModal}
          userId={userId}
          accounts={accounts}
          categories={categories}
          defaultStatus={parameters.defaultTransactionStatus}
          onClose={() => setTxModal(undefined)}
          onSave={async (input) => {
            await upsertFinanceTransaction(userId, input);
            await loadData();
            setTxModal(undefined);
            showNotice("Transaksi berhasil disimpan.");
          }}
        />
      )}

      {budgetModal !== undefined && (
        <BudgetFormModal
          budget={budgetModal}
          userId={userId}
          categories={categories}
          defaultMonth={selectedMonth}
          defaultYear={selectedYear}
          onClose={() => setBudgetModal(undefined)}
          onSave={async (input) => {
            await upsertFinanceBudget(userId, input);
            await loadData();
            setBudgetModal(undefined);
            showNotice("Budget berhasil disimpan.");
          }}
        />
      )}

      {recurringModal !== undefined && (
        <RecurringFormModal
          rule={recurringModal}
          accounts={accounts}
          categories={categories}
          onClose={() => setRecurringModal(undefined)}
          onSave={async (input) => {
            await upsertFinanceRecurring(userId, input);
            await loadData();
            setRecurringModal(undefined);
            showNotice("Jadwal berulang berhasil disimpan.");
          }}
        />
      )}

      {confirmAction && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmAction(null)}
        >
          <div
            className="finance-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="finance-modal-header">
              <h3>{confirmAction.title}</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setConfirmAction(null)}
              >
                <X size={16} />
              </button>
            </div>
            <p className="finance-muted">{confirmAction.message}</p>
            <div className="finance-form-actions">
              <button
                type="button"
                className="button-quiet"
                onClick={() => setConfirmAction(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="button-danger"
                onClick={async () => {
                  await confirmAction.onConfirm();
                  setConfirmAction(null);
                }}
              >
                {confirmAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ============================================================================
 * Sub-modals
 * ========================================================================== */

function AccountFormModal({
  account,
  defaultColor,
  onClose,
  onSave,
}: {
  account: FinanceAccount | null;
  defaultColor: string;
  onClose: () => void;
  onSave: (input: {
    id?: string;
    name: string;
    type: AccountType;
    opening_balance: number;
    color: string;
    icon: string;
    is_active: boolean;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<AccountType>(account?.type ?? "bank");
  const [opening, setOpening] = useState(
    String(account?.opening_balance ?? 0)
  );
  const [color, setColor] = useState(account?.color ?? defaultColor);
  const [isActive, setIsActive] = useState(account?.is_active ?? true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErr("Nama akun wajib diisi.");
      return;
    }
    const parsedOpening = Number(opening);
    if (!Number.isFinite(parsedOpening)) {
      setErr("Saldo awal tidak valid.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await onSave({
        id: account?.id,
        name: name.trim(),
        type,
        opening_balance: parsedOpening,
        color,
        icon: type,
        is_active: isActive,
      });
    } catch (caught) {
      setErr(caught instanceof Error ? caught.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <form
        className="finance-modal"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="finance-modal-header">
          <h3>{account ? "Edit Akun" : "Tambah Akun"}</h3>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {err && <div className="error-banner">{err}</div>}
        <label className="finance-field">
          <span>Nama Akun</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Misal: BCA Utama, Dompet Tunai"
            required
          />
        </label>
        <div className="finance-form-grid">
          <label className="finance-field">
            <span>Tipe Akun</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
            >
              <option value="cash">Tunai</option>
              <option value="bank">Bank</option>
              <option value="credit_card">Kartu Kredit</option>
              <option value="e_wallet">E-Wallet</option>
            </select>
          </label>
          <label className="finance-field">
            <span>Saldo Awal (IDR)</span>
            <CurrencyInput
              value={opening}
              onChangeValue={setOpening}
            />
          </label>
        </div>
        <div className="finance-form-grid">
          <label className="finance-field">
            <span>Warna</span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </label>
          <label className="finance-field finance-checkbox-field">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span>Akun Aktif</span>
          </label>
        </div>
        <div className="finance-form-actions">
          <button type="button" className="button-quiet" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="button-primary" disabled={busy}>
            {busy ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}

function CategoryFormModal({
  category,
  userId,
  categories,
  onClose,
  onSave,
}: {
  category: FinanceCategory | null;
  userId: string;
  categories: FinanceCategory[];
  onClose: () => void;
  onSave: (input: {
    id?: string;
    name: string;
    type: CategoryType;
    icon: string | null;
    color: string | null;
    parent_id: string | null;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [type, setType] = useState<CategoryType>(category?.type ?? "expense");
  const [parentId, setParentId] = useState<string>(category?.parent_id ?? "");
  const [color, setColor] = useState(category?.color ?? "#397a60");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const parentCandidates = categories.filter(
    (c) => c.type === type && c.id !== category?.id && !c.parent_id
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const validationErr = validateCategoryHierarchy({
      id: category?.id,
      user_id: userId,
      type,
      parent_id: parentId || null,
      categories,
    });
    if (validationErr) {
      setErr(validationErr);
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await onSave({
        id: category?.id,
        name: name.trim(),
        type,
        icon: null,
        color,
        parent_id: parentId || null,
      });
    } catch (caught) {
      setErr(caught instanceof Error ? caught.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <form
        className="finance-modal"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="finance-modal-header">
          <h3>{category ? "Edit Kategori" : "Tambah Kategori"}</h3>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {err && <div className="error-banner">{err}</div>}
        <label className="finance-field">
          <span>Nama Kategori</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <div className="finance-form-grid">
          <label className="finance-field">
            <span>Tipe</span>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as CategoryType);
                setParentId("");
              }}
            >
              <option value="expense">Pengeluaran (Expense)</option>
              <option value="income">Pemasukan (Income)</option>
            </select>
          </label>
          <label className="finance-field">
            <span>Kategori Induk (Opsional)</span>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">-- Kategori Utama --</option>
              {parentCandidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="finance-field">
          <span>Warna</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </label>
        <div className="finance-form-actions">
          <button type="button" className="button-quiet" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="button-primary" disabled={busy}>
            {busy ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}

function TransactionFormModal({
  transaction,
  userId,
  accounts,
  categories,
  defaultStatus,
  onClose,
  onSave,
}: {
  transaction: FinanceTransaction | null;
  userId: string;
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  defaultStatus: TransactionStatus;
  onClose: () => void;
  onSave: (input: {
    id?: string;
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
  }) => Promise<void>;
}) {
  const [type, setType] = useState<TransactionType>(
    transaction?.type ?? "expense"
  );
  const [title, setTitle] = useState(transaction?.title ?? "");
  const [amount, setAmount] = useState(String(transaction?.amount ?? ""));
  const [accountId, setAccountId] = useState(
    transaction?.account_id ?? accounts[0]?.id ?? ""
  );
  const [transferAccountId, setTransferAccountId] = useState(
    transaction?.transfer_account_id ?? accounts[1]?.id ?? ""
  );
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? "");
  const [status, setStatus] = useState<TransactionStatus>(
    transaction?.status ?? defaultStatus
  );
  const [txDate, setTxDate] = useState(
    transaction?.transaction_date
      ? transaction.transaction_date.slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  const [referenceNo, setReferenceNo] = useState(
    transaction?.reference_no ?? ""
  );
  const [notes, setNotes] = useState(transaction?.notes ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const matchingCategories = categories.filter(
    (c) => type === "income" || type === "expense" ? c.type === type : true
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = Number(amount);
    const resolvedTransfer =
      type === "transfer" ? transferAccountId || null : null;
    const resolvedCategory =
      type === "transfer" ? null : categoryId || null;

    const validationErr = validateTransactionInput({
      user_id: userId,
      account_id: accountId,
      transfer_account_id: resolvedTransfer,
      category_id: resolvedCategory,
      amount: parsedAmount,
      type,
      status,
      title,
      accounts,
      categories,
    });
    if (validationErr) {
      setErr(validationErr);
      return;
    }

    setBusy(true);
    setErr("");
    try {
      await onSave({
        id: transaction?.id,
        account_id: accountId,
        transfer_account_id: resolvedTransfer,
        category_id: resolvedCategory,
        amount: parsedAmount,
        type,
        status,
        reference_no: referenceNo.trim() || null,
        transaction_date: `${txDate}T00:00:00.000Z`,
        title: title.trim(),
        notes: notes.trim() || null,
      });
    } catch (caught) {
      setErr(caught instanceof Error ? caught.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <form
        className="finance-modal"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="finance-modal-header">
          <h3>{transaction ? "Edit Transaksi" : "Catat Transaksi"}</h3>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {err && <div className="error-banner">{err}</div>}
        <div className="finance-form-grid">
          <label className="finance-field">
            <span>Tipe Transaksi</span>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as TransactionType);
                setCategoryId("");
              }}
            >
              <option value="expense">Pengeluaran</option>
              <option value="income">Pemasukan</option>
              <option value="transfer">Transfer Antar Akun</option>
              <option value="adjustment">Penyesuaian (+/-)</option>
            </select>
          </label>
          <label className="finance-field">
            <span>Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TransactionStatus)}
            >
              <option value="cleared">Cleared</option>
              <option value="pending">Pending</option>
              <option value="reconciled">Reconciled</option>
            </select>
          </label>
        </div>
        <label className="finance-field">
          <span>Judul</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Misal: Makan siang, Gaji bulanan, Transfer ke Tabungan"
            required
          />
        </label>
        <div className="finance-form-grid">
          <label className="finance-field">
            <span>
              Nominal (IDR){type === "adjustment" ? " — boleh negatif" : ""}
            </span>
            <CurrencyInput
              value={amount}
              onChangeValue={setAmount}
              allowNegative={type === "adjustment"}
              required
            />
          </label>
          <label className="finance-field">
            <span>Tanggal</span>
            <input
              type="date"
              value={txDate}
              onChange={(e) => setTxDate(e.target.value)}
              required
            />
          </label>
        </div>
        <div className="finance-form-grid">
          <label className="finance-field">
            <span>{type === "transfer" ? "Akun Asal" : "Akun"}</span>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          {type === "transfer" ? (
            <label className="finance-field">
              <span>Akun Tujuan</span>
              <select
                value={transferAccountId}
                onChange={(e) => setTransferAccountId(e.target.value)}
                required
              >
                <option value="">-- Pilih Akun Tujuan --</option>
                {accounts
                  .filter((a) => a.id !== accountId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </label>
          ) : (
            <label className="finance-field">
              <span>Kategori</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">-- Tanpa Kategori --</option>
                {matchingCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="finance-form-grid">
          <label className="finance-field">
            <span>No. Referensi (Opsional)</span>
            <input
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
            />
          </label>
          <label className="finance-field">
            <span>Catatan (Opsional)</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
        <div className="finance-form-actions">
          <button type="button" className="button-quiet" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="button-primary" disabled={busy}>
            {busy ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}

function BudgetFormModal({
  budget,
  userId,
  categories,
  defaultMonth,
  defaultYear,
  onClose,
  onSave,
}: {
  budget: FinanceBudget | null;
  userId: string;
  categories: FinanceCategory[];
  defaultMonth: number;
  defaultYear: number;
  onClose: () => void;
  onSave: (input: {
    id?: string;
    category_id: string;
    limit_amount: number;
    month: number;
    year: number;
  }) => Promise<void>;
}) {
  const expenseCategories = categories.filter((c) => c.type === "expense");
  const [categoryId, setCategoryId] = useState(
    budget?.category_id ?? expenseCategories[0]?.id ?? ""
  );
  const [limitAmount, setLimitAmount] = useState(
    String(budget?.limit_amount ?? "")
  );
  const [month, setMonth] = useState(budget?.month ?? defaultMonth);
  const [year, setYear] = useState(budget?.year ?? defaultYear);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsedLimit = Number(limitAmount);
    const validationErr = validateBudgetInput({
      user_id: userId,
      category_id: categoryId,
      limit_amount: parsedLimit,
      month,
      year,
      categories,
    });
    if (validationErr) {
      setErr(validationErr);
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await onSave({
        id: budget?.id,
        category_id: categoryId,
        limit_amount: parsedLimit,
        month,
        year,
      });
    } catch (caught) {
      setErr(caught instanceof Error ? caught.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <form
        className="finance-modal"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="finance-modal-header">
          <h3>{budget ? "Edit Budget" : "Tambah Budget"}</h3>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {err && <div className="error-banner">{err}</div>}
        <label className="finance-field">
          <span>Kategori Pengeluaran</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="finance-field">
          <span>Batas Pengeluaran (IDR)</span>
          <CurrencyInput
            value={limitAmount}
            onChangeValue={setLimitAmount}
            required
          />
        </label>
        <div className="finance-form-grid">
          <label className="finance-field">
            <span>Bulan</span>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="finance-field">
            <span>Tahun</span>
            <input
              type="number"
              min={1}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              required
            />
          </label>
        </div>
        <div className="finance-form-actions">
          <button type="button" className="button-quiet" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="button-primary" disabled={busy}>
            {busy ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}

function RecurringFormModal({
  rule,
  accounts,
  categories,
  onClose,
  onSave,
}: {
  rule: FinanceRecurringTransaction | null;
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  onClose: () => void;
  onSave: (input: {
    id?: string;
    account_id: string;
    category_id: string | null;
    amount: number;
    type: CategoryType;
    title: string;
    frequency: RecurringFrequency;
    start_date: string;
    next_due_date: string;
    is_active: boolean;
    notes: string | null;
  }) => Promise<void>;
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState(rule?.title ?? "");
  const [type, setType] = useState<CategoryType>(rule?.type ?? "expense");
  const [amount, setAmount] = useState(String(rule?.amount ?? ""));
  const [accountId, setAccountId] = useState(
    rule?.account_id ?? accounts[0]?.id ?? ""
  );
  const [categoryId, setCategoryId] = useState(rule?.category_id ?? "");
  const [frequency, setFrequency] = useState<RecurringFrequency>(
    rule?.frequency ?? "monthly"
  );
  const [startDate, setStartDate] = useState(rule?.start_date ?? todayIso);
  const [nextDueDate, setNextDueDate] = useState(
    rule?.next_due_date ?? todayIso
  );
  const [isActive, setIsActive] = useState(rule?.is_active ?? true);
  const [notes, setNotes] = useState(rule?.notes ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const matchingCategories = categories.filter((c) => c.type === type);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setErr("Nominal harus >= 0.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await onSave({
        id: rule?.id,
        account_id: accountId,
        category_id: categoryId || null,
        amount: parsedAmount,
        type,
        title: title.trim(),
        frequency,
        start_date: startDate,
        next_due_date: nextDueDate,
        is_active: isActive,
        notes: notes.trim() || null,
      });
    } catch (caught) {
      setErr(caught instanceof Error ? caught.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <form
        className="finance-modal"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="finance-modal-header">
          <h3>{rule ? "Edit Jadwal Berulang" : "Tambah Jadwal Berulang"}</h3>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {err && <div className="error-banner">{err}</div>}
        <label className="finance-field">
          <span>Judul</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <div className="finance-form-grid">
          <label className="finance-field">
            <span>Tipe</span>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as CategoryType);
                setCategoryId("");
              }}
            >
              <option value="expense">Pengeluaran</option>
              <option value="income">Pemasukan</option>
            </select>
          </label>
          <label className="finance-field">
            <span>Frekuensi</span>
            <select
              value={frequency}
              onChange={(e) =>
                setFrequency(e.target.value as RecurringFrequency)
              }
            >
              <option value="daily">Harian</option>
              <option value="weekly">Mingguan</option>
              <option value="monthly">Bulanan</option>
              <option value="yearly">Tahunan</option>
            </select>
          </label>
        </div>
        <div className="finance-form-grid">
          <label className="finance-field">
            <span>Nominal (IDR)</span>
            <CurrencyInput
              value={amount}
              onChangeValue={setAmount}
              required
            />
          </label>
          <label className="finance-field">
            <span>Akun</span>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="finance-form-grid">
          <label className="finance-field">
            <span>Kategori</span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">-- Tanpa Kategori --</option>
              {matchingCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="finance-field">
            <span>Jatuh Tempo Berikutnya</span>
            <input
              type="date"
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
              required
            />
          </label>
        </div>
        <div className="finance-form-grid">
          <label className="finance-field">
            <span>Tanggal Mulai</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </label>
          <label className="finance-field finance-checkbox-field">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span>Aktif</span>
          </label>
        </div>
        <label className="finance-field">
          <span>Catatan</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div className="finance-form-actions">
          <button type="button" className="button-quiet" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="button-primary" disabled={busy}>
            {busy ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}
