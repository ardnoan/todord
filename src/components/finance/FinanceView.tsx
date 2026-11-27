import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FolderTree,
  Landmark,
  LayoutDashboard,
  Pencil,
  PiggyBank,
  Play,
  Plus,
  Power,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Smartphone,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useDialogA11y } from "../../hooks/useDialogA11y";
import { formatRupiah, roundMoney } from "../../lib/finance/calculations";
import { getLocalDateString } from "../../lib/date";
import type {
  AccountBalanceSummary,
  AccountReportRow,
  AccountType,
  AppParameterSettings,
  BudgetProgress,
  CategoryReportRow,
  CategoryType,
  CsvImportPreview,
  FinanceAccount,
  FinanceBudget,
  FinanceCategory,
  FinanceRecurringTransaction,
  FinanceTransaction,
  MonthlyReportRow,
  PeriodSummary,
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
  deleteAccountPermanently,
  deleteFinanceBudget,
  deleteFinanceCategory,
  deleteFinanceRecurring,
  deleteFinanceTransaction,
  executeRecurringRule,
  fetchFinanceAggregates,
  fetchFinanceBundle,
  fetchFinanceTransactionsPage,
  setAccountActiveStatus,
  upsertFinanceAccount,
  upsertFinanceBudget,
  upsertFinanceCategory,
  upsertFinanceRecurring,
  upsertFinanceTransaction,
  type FinanceAggregates,
} from "../../services/financeService";
import { AppBarChart, AppDonutChart } from "./Charts";
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
  const isMobile = useIsMobile();
  const now = new Date();
  const [activeTab, setActiveTab] = useState<FinanceTab>("dashboard");
  const [selectedMonth, setSelectedMonth] = useState<number>(
    now.getMonth() + 1
  );
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [periodSheetOpen, setPeriodSheetOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const tabsRef = useRef<HTMLElement | null>(null);
  const periodSheetRef = useRef<HTMLDivElement>(null);
  const filterSheetRef = useRef<HTMLDivElement>(null);
  const confirmDialogRef = useRef<HTMLDivElement>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  const [undoTx, setUndoTx] = useState<FinanceTransaction | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [txHasMore, setTxHasMore] = useState(false);
  const [loadingMoreTx, setLoadingMoreTx] = useState(false);
  const [budgets, setBudgets] = useState<FinanceBudget[]>([]);
  const [recurring, setRecurring] = useState<FinanceRecurringTransaction[]>([]);
  const [aggregates, setAggregates] = useState<FinanceAggregates | null>(null);
  const [processingCatchUp, setProcessingCatchUp] = useState(false);

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
  const [txModal, setTxModal] = useState<FinanceTransaction | null | undefined>(
    undefined
  );
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

  const fetchSnapshot = useCallback(async () => {
    const [bundle, txPage, aggs] = await Promise.all([
      fetchFinanceBundle(userId),
      fetchFinanceTransactionsPage(userId, {
        month: selectedMonth,
        year: selectedYear,
        limit: 50,
        offset: 0,
      }),
      fetchFinanceAggregates(selectedMonth, selectedYear),
    ]);

    // Seed default finance categories from Admin Parameters on first open
    const seedFlagKey = `ruang.finance.categories.seeded.${userId}`;
    let nextCategories = bundle.categories;
    if (
      nextCategories.length === 0 &&
      !localStorage.getItem(seedFlagKey) &&
      (parameters.defaultFinanceExpenseCategories.length > 0 ||
        parameters.defaultFinanceIncomeCategories.length > 0)
    ) {
      const seeded: FinanceCategory[] = [];
      for (const name of parameters.defaultFinanceExpenseCategories) {
        if (!name.trim()) continue;
        const created = await upsertFinanceCategory(userId, {
          name: name.trim(),
          type: "expense",
          icon: null,
          color: "#dc2626",
          parent_id: null,
        });
        seeded.push(created);
      }
      for (const name of parameters.defaultFinanceIncomeCategories) {
        if (!name.trim()) continue;
        const created = await upsertFinanceCategory(userId, {
          name: name.trim(),
          type: "income",
          icon: null,
          color: "#16a34a",
          parent_id: null,
        });
        seeded.push(created);
      }
      if (seeded.length > 0) {
        nextCategories = seeded;
      }
      localStorage.setItem(seedFlagKey, "1");
    }

    return {
      accounts: bundle.accounts,
      categories: nextCategories,
      budgets: bundle.budgets,
      recurring: bundle.recurring,
      txRows: txPage.rows,
      txHasMore: txPage.hasMore,
      aggregates: aggs,
    };
  }, [
    userId,
    selectedMonth,
    selectedYear,
    parameters.defaultFinanceExpenseCategories,
    parameters.defaultFinanceIncomeCategories,
  ]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const snap = await fetchSnapshot();
      setAccounts(snap.accounts);
      setCategories(snap.categories);
      setBudgets(snap.budgets);
      setRecurring(snap.recurring);
      setTransactions(snap.txRows);
      setTxHasMore(snap.txHasMore);
      setAggregates(snap.aggregates);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal memuat data keuangan dari Supabase. Pastikan migrasi SQL sudah dijalankan."
      );
    } finally {
      setLoading(false);
    }
  }, [fetchSnapshot]);

  useEffect(() => {
    let cancelled = false;
    fetchSnapshot()
      .then((snap) => {
        if (cancelled) return;
        setAccounts(snap.accounts);
        setCategories(snap.categories);
        setBudgets(snap.budgets);
        setRecurring(snap.recurring);
        setTransactions(snap.txRows);
        setTxHasMore(snap.txHasMore);
        setAggregates(snap.aggregates);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Gagal memuat data keuangan dari Supabase. Pastikan migrasi SQL sudah dijalankan."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchSnapshot]);

  async function handleLoadMoreTransactions() {
    if (loadingMoreTx || !txHasMore) return;
    setLoadingMoreTx(true);
    try {
      const nextPage = await fetchFinanceTransactionsPage(userId, {
        month: selectedMonth,
        year: selectedYear,
        limit: 50,
        offset: transactions.length,
      });
      setTransactions((prev) => [...prev, ...nextPage.rows]);
      setTxHasMore(nextPage.hasMore);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal memuat transaksi berikutnya."
      );
    } finally {
      setLoadingMoreTx(false);
    }
  }

  useEffect(() => {
    function handleOpenNewTx() {
      if (accounts.length > 0) {
        setTxModal(null);
      }
    }
    window.addEventListener("ruang:finance-new-tx", handleOpenNewTx);
    return () =>
      window.removeEventListener("ruang:finance-new-tx", handleOpenNewTx);
  }, [accounts.length]);

  useEffect(() => {
    if (!isMobile || !tabsRef.current) return;
    const activeEl = tabsRef.current.querySelector(".finance-tab.active");
    if (activeEl && typeof activeEl.scrollIntoView === "function") {
      activeEl.scrollIntoView({
        inline: "center",
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [activeTab, isMobile]);

  const yearOptions = useMemo(() => {
    const base = new Date().getFullYear();
    const list: number[] = [];
    for (let y = base - 5; y <= base + 5; y += 1) {
      list.push(y);
    }
    if (!list.includes(selectedYear)) {
      list.push(selectedYear);
      list.sort((a, b) => a - b);
    }
    return list;
  }, [selectedYear]);

  const activeTxFilterCount = useMemo(() => {
    let count = 0;
    if (txTypeFilter !== "all") count += 1;
    if (txStatusFilter !== "all") count += 1;
    if (txAccountFilter !== "all") count += 1;
    if (txCategoryFilter !== "all") count += 1;
    return count;
  }, [txTypeFilter, txStatusFilter, txAccountFilter, txCategoryFilter]);

  function handlePrevPeriod() {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  }

  function handleNextPeriod() {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  }

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
      if (undoTimerRef.current !== null) {
        window.clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  useDialogA11y(
    periodSheetOpen,
    () => setPeriodSheetOpen(false),
    periodSheetRef
  );
  useDialogA11y(
    filterSheetOpen,
    () => setFilterSheetOpen(false),
    filterSheetRef
  );
  useDialogA11y(
    Boolean(confirmAction),
    () => {
      if (!confirmBusy) setConfirmAction(null);
    },
    confirmDialogRef
  );

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice("");
      noticeTimerRef.current = null;
    }, 3500);
  }, []);

  function triggerUndoTx(deleted: FinanceTransaction) {
    setUndoTx(deleted);
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
    }
    undoTimerRef.current = window.setTimeout(() => {
      setUndoTx(null);
      undoTimerRef.current = null;
    }, 5000);
  }

  async function handleUndoDeleteTx() {
    if (!undoTx) return;
    const txToRestore = undoTx;
    setUndoTx(null);
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    try {
      await upsertFinanceTransaction(userId, {
        account_id: txToRestore.account_id,
        transfer_account_id: txToRestore.transfer_account_id,
        category_id: txToRestore.category_id,
        amount: txToRestore.amount,
        type: txToRestore.type,
        status: txToRestore.status,
        reference_no: txToRestore.reference_no,
        transaction_date: txToRestore.transaction_date,
        title: txToRestore.title,
        notes: txToRestore.notes,
      });
      await loadData();
      showNotice(`Transaksi "${txToRestore.title}" dipulihkan.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memulihkan transaksi."
      );
    }
  }

  // Derived calculations from server-side SQL aggregates (no 1000-row client cap)
  const accountBalances: AccountBalanceSummary[] = useMemo(() => {
    const balMap = new Map(
      (aggregates?.accountBalances ?? []).map((b) => [b.account_id, b])
    );
    return accounts.map((account) => {
      const b = balMap.get(account.id);
      const openingBalance = roundMoney(Number(account.opening_balance) || 0);
      const totalInflow = roundMoney(b?.total_inflow ?? 0);
      const totalOutflow = roundMoney(b?.total_outflow ?? 0);
      const currentBalance = b ? roundMoney(b.current_balance) : openingBalance;
      return {
        account,
        openingBalance,
        currentBalance,
        totalInflow,
        totalOutflow,
        transactionCount: b?.transaction_count ?? 0,
      };
    });
  }, [accounts, aggregates]);

  const totalNetBalance = useMemo(
    () =>
      roundMoney(
        accountBalances
          .filter((s) => s.account.is_active)
          .reduce((acc, s) => acc + s.currentBalance, 0)
      ),
    [accountBalances]
  );

  const periodSummary: PeriodSummary = useMemo(
    () =>
      aggregates?.periodSummary ?? {
        month: selectedMonth,
        year: selectedYear,
        totalIncome: 0,
        totalExpense: 0,
        netCashflow: 0,
        transferVolume: 0,
        adjustmentNet: 0,
        transactionCount: 0,
      },
    [aggregates, selectedMonth, selectedYear]
  );

  const budgetProgressList: BudgetProgress[] = useMemo(() => {
    const catMap = new Map(categories.map((c) => [c.id, c]));
    const spentMap = aggregates?.budgetSpentMap ?? {};
    return budgets
      .filter((b) => b.month === selectedMonth && b.year === selectedYear)
      .map((budget) => {
        const category = catMap.get(budget.category_id);
        const limitAmount = roundMoney(Number(budget.limit_amount) || 0);
        const spentAmount = roundMoney(spentMap[budget.category_id] ?? 0);
        const remainingAmount = roundMoney(limitAmount - spentAmount);
        const percentage =
          limitAmount > 0
            ? Math.round((spentAmount / limitAmount) * 1000) / 10
            : spentAmount > 0
              ? 100
              : 0;
        return {
          budget,
          category,
          limitAmount,
          spentAmount,
          remainingAmount,
          percentage,
          isOverBudget: spentAmount > limitAmount,
          isWarning:
            spentAmount <= limitAmount &&
            percentage >= parameters.budgetWarningThresholdPercent,
        };
      });
  }, [
    budgets,
    categories,
    aggregates,
    selectedMonth,
    selectedYear,
    parameters.budgetWarningThresholdPercent,
  ]);

  const monthlyReport: MonthlyReportRow[] = useMemo(
    () => aggregates?.monthlyReport ?? [],
    [aggregates]
  );

  const expenseCategoryReport: CategoryReportRow[] = useMemo(() => {
    const rows = aggregates?.expenseCategoryReport ?? [];
    const grandTotal = rows.reduce((acc, r) => acc + r.total, 0);
    return rows.map((r) => ({
      categoryId: r.category_id,
      categoryName: r.category_name,
      type: "expense",
      total: roundMoney(r.total),
      count: r.count,
      sharePercent:
        grandTotal > 0 ? Math.round((r.total / grandTotal) * 1000) / 10 : 0,
      color: r.color,
    }));
  }, [aggregates]);

  const incomeCategoryReport: CategoryReportRow[] = useMemo(() => {
    const rows = aggregates?.incomeCategoryReport ?? [];
    const grandTotal = rows.reduce((acc, r) => acc + r.total, 0);
    return rows.map((r) => ({
      categoryId: r.category_id,
      categoryName: r.category_name,
      type: "income",
      total: roundMoney(r.total),
      count: r.count,
      sharePercent:
        grandTotal > 0 ? Math.round((r.total / grandTotal) * 1000) / 10 : 0,
      color: r.color,
    }));
  }, [aggregates]);

  const accountReport: AccountReportRow[] = useMemo(
    () =>
      accountBalances.map((s) => ({
        accountId: s.account.id,
        accountName: s.account.name,
        accountType: s.account.type,
        isActive: s.account.is_active,
        openingBalance: s.openingBalance,
        inflow: s.totalInflow,
        outflow: s.totalOutflow,
        netChange: roundMoney(s.totalInflow - s.totalOutflow),
        currentBalance: s.currentBalance,
      })),
    [accountBalances]
  );

  const dueRecurringRules = useMemo(() => {
    const todayIso = getLocalDateString();
    return recurring.filter((r) => r.is_active && r.next_due_date <= todayIso);
  }, [recurring]);

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
      if (txStatusFilter !== "all" && tx.status !== txStatusFilter)
        return false;
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
    {
      id: "dashboard",
      label: "Ringkasan",
      icon: <LayoutDashboard size={15} />,
    },
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
    const todayIso = getLocalDateString();
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

  async function handleCatchUpAllRecurring() {
    if (processingCatchUp || dueRecurringRules.length === 0) return;
    setProcessingCatchUp(true);
    setError("");
    const todayIso = getLocalDateString();
    let executedCount = 0;
    const MAX_ITERATIONS_PER_RULE = 24;

    try {
      for (const rule of dueRecurringRules) {
        let currentRule = { ...rule };
        for (let iter = 0; iter < MAX_ITERATIONS_PER_RULE; iter += 1) {
          const res = await executeRecurringRule(userId, currentRule, todayIso);
          if (!res.executed) break;
          executedCount += 1;
          if (res.next_due_date) {
            currentRule = { ...currentRule, next_due_date: res.next_due_date };
            if (currentRule.next_due_date > todayIso) break;
          } else {
            break;
          }
        }
      }
      await loadData();
      showNotice(
        executedCount > 0
          ? `${executedCount} transaksi berulang yang jatuh tempo berhasil diproses.`
          : "Tidak ada jadwal jatuh tempo yang perlu diproses."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal memproses jadwal berulang yang jatuh tempo."
      );
    } finally {
      setProcessingCatchUp(false);
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
          {isMobile ? (
            <div className="finance-period-mobile">
              <button
                type="button"
                className="icon-btn"
                aria-label="Bulan sebelumnya"
                onClick={handlePrevPeriod}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className="finance-period-label-btn"
                onClick={() => setPeriodSheetOpen(true)}
                aria-label="Pilih bulan dan tahun"
              >
                {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Bulan berikutnya"
                onClick={handleNextPeriod}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          ) : (
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
              <select
                aria-label="Pilih Tahun"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            className="button-quiet"
            onClick={loadData}
            title="Muat ulang data"
            aria-label="Muat ulang data keuangan"
          >
            <RefreshCw size={15} />
          </button>

          <button
            type="button"
            className="button-primary finance-hero-cta"
            onClick={() => setTxModal(null)}
            disabled={accounts.length === 0}
          >
            <Plus size={16} /> Catat Transaksi
          </button>
        </div>
      </div>

      {/* Sub-navigation tabs */}
      <nav ref={tabsRef} className="finance-tabs" aria-label="Menu Keuangan">
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
      {undoTx && (
        <div className="undo-toast-banner" role="status">
          <span>Transaksi &ldquo;{undoTx.title}&rdquo; dihapus.</span>
          <button
            type="button"
            className="button-quiet btn-xs"
            onClick={handleUndoDeleteTx}
          >
            Urungkan
          </button>
        </div>
      )}
      {dueRecurringRules.length > 0 && (
        <div className="finance-catchup-banner" role="status">
          <span>
            <CalendarClock size={16} />{" "}
            <strong>
              {dueRecurringRules.length} jadwal berulang jatuh tempo
            </strong>{" "}
            siap diproses.
          </span>
          <button
            type="button"
            className="button-primary btn-xs"
            onClick={handleCatchUpAllRecurring}
            disabled={processingCatchUp}
          >
            {processingCatchUp ? "Memproses..." : "Proses semua"}
          </button>
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
                    Kelola akun kas, bank, atau e-wallet. Akun yang nonaktif
                    tetap dapat diubah atau diaktifkan kembali.
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
                          <td
                            data-label="Nama Akun"
                            className="card-primary-cell"
                          >
                            <div className="account-cell">
                              <span
                                className="account-dot"
                                style={{ backgroundColor: item.account.color }}
                              />
                              <strong>{item.account.name}</strong>
                            </div>
                          </td>
                          <td data-label="Tipe">
                            {ACCOUNT_TYPE_LABELS[item.account.type]}
                          </td>
                          <td data-label="Status">
                            <span
                              className={`pill ${
                                item.account.is_active
                                  ? "pill-ok"
                                  : "pill-muted"
                              }`}
                            >
                              {item.account.is_active ? "Aktif" : "Nonaktif"}
                            </span>
                          </td>
                          <td data-label="Saldo Awal">
                            {fmt(item.openingBalance)}
                          </td>
                          <td
                            data-label="Saldo Berjalan"
                            className="card-amount-cell"
                          >
                            <strong>{fmt(item.currentBalance)}</strong>
                          </td>
                          <td data-label="Aksi" className="actions-cell">
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
                              className="icon-btn"
                              title={
                                item.account.is_active
                                  ? "Nonaktifkan akun"
                                  : "Aktifkan akun"
                              }
                              onClick={() =>
                                setConfirmAction({
                                  title: item.account.is_active
                                    ? "Nonaktifkan Akun?"
                                    : "Aktifkan Akun?",
                                  message: item.account.is_active
                                    ? `Nonaktifkan akun "${item.account.name}"? Akun nonaktif tetap bisa diubah atau diaktifkan kembali nanti.`
                                    : `Aktifkan kembali akun "${item.account.name}"?`,
                                  confirmLabel: item.account.is_active
                                    ? "Nonaktifkan"
                                    : "Aktifkan",
                                  onConfirm: async () => {
                                    const nextActive = !item.account.is_active;
                                    await setAccountActiveStatus(
                                      userId,
                                      item.account.id,
                                      nextActive
                                    );
                                    await loadData();
                                    showNotice(
                                      nextActive
                                        ? "Akun diaktifkan kembali."
                                        : "Akun dinonaktifkan."
                                    );
                                  },
                                })
                              }
                            >
                              <Power size={14} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn danger"
                              title="Hapus permanen akun"
                              onClick={() =>
                                setConfirmAction({
                                  title: "Hapus Akun?",
                                  message:
                                    item.transactionCount > 0
                                      ? `Akun "${item.account.name}" memiliki ${item.transactionCount} transaksi. Menghapus akun ini akan ikut menghapus seluruh transaksi dan jadwal berulang terkait secara permanen.`
                                      : `Hapus permanen akun "${item.account.name}"?`,
                                  confirmLabel: "Hapus Permanen",
                                  onConfirm: async () => {
                                    await deleteAccountPermanently(
                                      userId,
                                      item.account.id
                                    );
                                    await loadData();
                                    showNotice("Akun berhasil dihapus.");
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
                                        onClick={() => {
                                          if (children.length > 0) {
                                            setError(
                                              `Kategori "${parent.name}" masih memiliki ${children.length} sub-kategori. Hapus atau pindahkan sub-kategori terlebih dahulu.`
                                            );
                                            return;
                                          }
                                          setConfirmAction({
                                            title: "Hapus Kategori?",
                                            message: `Hapus kategori "${parent.name}"? Perhatian: semua budget yang terhubung dengan kategori ini juga akan ikut terhapus.`,
                                            confirmLabel: "Hapus",
                                            onConfirm: async () => {
                                              await deleteFinanceCategory(
                                                userId,
                                                parent.id
                                              );
                                              await loadData();
                                              showNotice("Kategori dihapus.");
                                            },
                                          });
                                        }}
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
                                          onClick={() =>
                                            setCategoryModal(child)
                                          }
                                        >
                                          <Pencil size={13} />
                                        </button>
                                        <button
                                          type="button"
                                          className="icon-btn danger"
                                          onClick={() =>
                                            setConfirmAction({
                                              title: "Hapus Kategori Anak?",
                                              message: `Hapus kategori "${child.name}"? Perhatian: semua budget yang terhubung dengan kategori ini juga akan ikut terhapus.`,
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

                {isMobile ? (
                  <button
                    type="button"
                    className="button-quiet finance-filter-trigger"
                    onClick={() => setFilterSheetOpen(true)}
                  >
                    <SlidersHorizontal size={15} />
                    <span>Filter</span>
                    {activeTxFilterCount > 0 && (
                      <span className="filter-badge">
                        {activeTxFilterCount}
                      </span>
                    )}
                  </button>
                ) : (
                  <>
                    <select
                      aria-label="Filter tipe transaksi"
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
                      aria-label="Filter status transaksi"
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
                      aria-label="Filter akun"
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
                      aria-label="Filter kategori"
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
                  </>
                )}
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
                            <td data-label="Tanggal">
                              {new Date(tx.transaction_date).toLocaleDateString(
                                "id-ID"
                              )}
                            </td>
                            <td
                              data-label="Judul"
                              className="card-primary-cell"
                            >
                              <strong>{tx.title}</strong>
                              {tx.reference_no && (
                                <span className="finance-muted">
                                  {" "}
                                  ({tx.reference_no})
                                </span>
                              )}
                            </td>
                            <td data-label="Tipe">{TX_TYPE_LABELS[tx.type]}</td>
                            <td data-label="Akun">
                              {acc?.name ?? "-"}
                              {targetAcc ? ` → ${targetAcc.name}` : ""}
                            </td>
                            <td data-label="Kategori">{cat?.name ?? "-"}</td>
                            <td data-label="Status">
                              <span className={`tx-status status-${tx.status}`}>
                                {STATUS_LABELS[tx.status]}
                              </span>
                            </td>
                            <td
                              data-label="Nominal"
                              className="card-amount-cell"
                            >
                              <strong className={`tx-amount ${tx.type}`}>
                                {tx.type === "expense" ? "-" : ""}
                                {tx.type === "income" ? "+" : ""}
                                {fmt(tx.amount)}
                              </strong>
                            </td>
                            <td data-label="Aksi" className="actions-cell">
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
                                      triggerUndoTx(tx);
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
                  {txHasMore && (
                    <div className="finance-load-more">
                      <button
                        type="button"
                        className="button-quiet"
                        onClick={handleLoadMoreTransactions}
                        disabled={loadingMoreTx}
                      >
                        {loadingMoreTx ? "Memuat..." : "Muat lebih banyak"}
                      </button>
                    </div>
                  )}
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
                          <td data-label="Judul" className="card-primary-cell">
                            <strong>{rule.title}</strong>
                          </td>
                          <td data-label="Frekuensi">
                            {FREQ_LABELS[rule.frequency]}
                          </td>
                          <td data-label="Akun">
                            {accountMap.get(rule.account_id)?.name ?? "-"}
                          </td>
                          <td data-label="Nominal" className="card-amount-cell">
                            <strong className={`tx-amount ${rule.type}`}>
                              {rule.type === "expense" ? "-" : "+"}
                              {fmt(rule.amount)}
                            </strong>
                          </td>
                          <td data-label="Jatuh Tempo">{rule.next_due_date}</td>
                          <td data-label="Terakhir Diproses">
                            {rule.last_processed_date ?? "-"}
                          </td>
                          <td data-label="Status">
                            <span
                              className={`pill ${
                                rule.is_active ? "pill-ok" : "pill-muted"
                              }`}
                            >
                              {rule.is_active ? "Aktif" : "Nonaktif"}
                            </span>
                          </td>
                          <td data-label="Aksi" className="actions-cell">
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
                <AppBarChart
                  height={280}
                  categories={monthlyReport.map((r) => r.label)}
                  series={[
                    {
                      name: "Pemasukan",
                      data: monthlyReport.map((r) => r.income),
                      color: "#16a34a",
                    },
                    {
                      name: "Pengeluaran",
                      data: monthlyReport.map((r) => r.expense),
                      color: "#dc2626",
                    },
                  ]}
                  formatValue={(val) => fmt(val)}
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
                          <td data-label="Bulan" className="card-primary-cell">
                            <strong>{row.label}</strong>
                          </td>
                          <td
                            data-label="Pemasukan"
                            className="tx-amount income"
                          >
                            {fmt(row.income)}
                          </td>
                          <td
                            data-label="Pengeluaran"
                            className="tx-amount expense"
                          >
                            {fmt(row.expense)}
                          </td>
                          <td data-label="Bersih" className="card-amount-cell">
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
                      <AppDonutChart
                        height={260}
                        slices={expenseCategoryReport.map((i) => ({
                          name: `${i.categoryName} (${i.count}x)`,
                          value: i.total,
                          color: i.color,
                        }))}
                        totalLabel="Total"
                        formatValue={(val) => fmt(val)}
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
                      <AppDonutChart
                        height={260}
                        slices={incomeCategoryReport.map((i) => ({
                          name: `${i.categoryName} (${i.count}x)`,
                          value: i.total,
                          color: i.color,
                        }))}
                        totalLabel="Total"
                        formatValue={(val) => fmt(val)}
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
                          <td data-label="Akun" className="card-primary-cell">
                            <strong>{row.accountName}</strong>
                            {!row.isActive && " (Nonaktif)"}
                          </td>
                          <td data-label="Saldo Awal">
                            {fmt(row.openingBalance)}
                          </td>
                          <td
                            data-label="Total Masuk"
                            className="tx-amount income"
                          >
                            {fmt(row.inflow)}
                          </td>
                          <td
                            data-label="Total Keluar"
                            className="tx-amount expense"
                          >
                            {fmt(row.outflow)}
                          </td>
                          <td
                            data-label="Saldo Berjalan"
                            className="card-amount-cell"
                          >
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
              budgets={budgets}
              recurring={recurring}
              onCommitImport={handleCommitCsvImport}
            />
          )}
        </>
      )}

      {/* MODALS */}
      {periodSheetOpen && (
        <div
          className="finance-modal-backdrop"
          onClick={() => setPeriodSheetOpen(false)}
        >
          <div
            ref={periodSheetRef}
            className="finance-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="period-sheet-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="finance-modal-header">
              <h3 id="period-sheet-title">Pilih Periode</h3>
              <button
                type="button"
                className="icon-btn"
                aria-label="Tutup"
                onClick={() => setPeriodSheetOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="finance-form">
              <label className="finance-field">
                <span>Bulan</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={name} value={idx + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="finance-field">
                <span>Tahun</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <div className="finance-modal-actions">
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => setPeriodSheetOpen(false)}
                >
                  Terapkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {filterSheetOpen && (
        <div
          className="finance-modal-backdrop"
          onClick={() => setFilterSheetOpen(false)}
        >
          <div
            ref={filterSheetRef}
            className="finance-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="filter-sheet-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="finance-modal-header">
              <h3 id="filter-sheet-title">Filter Transaksi</h3>
              <button
                type="button"
                className="icon-btn"
                aria-label="Tutup"
                onClick={() => setFilterSheetOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="finance-form">
              <label className="finance-field">
                <span>Tipe</span>
                <select
                  value={txTypeFilter}
                  onChange={(e) =>
                    setTxTypeFilter(e.target.value as TransactionType | "all")
                  }
                >
                  <option value="all">Semua Tipe</option>
                  <option value="income">Pemasukan</option>
                  <option value="expense">Pengeluaran</option>
                  <option value="transfer">Transfer</option>
                  <option value="adjustment">Penyesuaian</option>
                </select>
              </label>
              <label className="finance-field">
                <span>Status</span>
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
              </label>
              <label className="finance-field">
                <span>Akun</span>
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
              </label>
              <label className="finance-field">
                <span>Kategori</span>
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
              </label>
              <div className="finance-modal-actions">
                <button
                  type="button"
                  className="button-quiet"
                  onClick={() => {
                    setTxTypeFilter("all");
                    setTxStatusFilter("all");
                    setTxAccountFilter("all");
                    setTxCategoryFilter("all");
                  }}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => setFilterSheetOpen(false)}
                >
                  Terapkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
          aria-labelledby="finance-confirm-title"
          onClick={() => {
            if (!confirmBusy) setConfirmAction(null);
          }}
        >
          <div
            ref={confirmDialogRef}
            className="finance-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="finance-modal-header">
              <h3 id="finance-confirm-title">{confirmAction.title}</h3>
              <button
                type="button"
                className="icon-btn"
                aria-label="Tutup"
                disabled={confirmBusy}
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
                disabled={confirmBusy}
                onClick={() => setConfirmAction(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="button-danger"
                disabled={confirmBusy}
                onClick={async () => {
                  if (confirmBusy) return;
                  setConfirmBusy(true);
                  try {
                    await confirmAction.onConfirm();
                    setConfirmAction(null);
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Gagal memproses aksi."
                    );
                    setConfirmAction(null);
                  } finally {
                    setConfirmBusy(false);
                  }
                }}
              >
                {confirmBusy ? "Memproses..." : confirmAction.confirmLabel}
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
  const [opening, setOpening] = useState(String(account?.opening_balance ?? 0));
  const [color, setColor] = useState(account?.color ?? defaultColor);
  const [isActive, setIsActive] = useState(account?.is_active ?? true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useDialogA11y(true, onClose, formRef);

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
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
      onClick={onClose}
    >
      <form
        ref={formRef}
        className="finance-modal"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="finance-modal-header">
          <h3 id="account-modal-title">
            {account ? "Edit Akun" : "Tambah Akun"}
          </h3>
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
            <CurrencyInput value={opening} onChangeValue={setOpening} />
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
  const formRef = useRef<HTMLFormElement>(null);
  useDialogA11y(true, onClose, formRef);

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
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="category-modal-title"
      onClick={onClose}
    >
      <form
        ref={formRef}
        className="finance-modal"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="finance-modal-header">
          <h3 id="category-modal-title">
            {category ? "Edit Kategori" : "Tambah Kategori"}
          </h3>
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
  const formRef = useRef<HTMLFormElement>(null);
  useDialogA11y(true, onClose, formRef);
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
      : getLocalDateString()
  );
  const [referenceNo, setReferenceNo] = useState(
    transaction?.reference_no ?? ""
  );
  const [notes, setNotes] = useState(transaction?.notes ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const matchingCategories = categories.filter((c) =>
    type === "income" || type === "expense" ? c.type === type : true
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = Number(amount);
    const resolvedTransfer =
      type === "transfer" ? transferAccountId || null : null;
    const resolvedCategory = type === "transfer" ? null : categoryId || null;

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
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-modal-title"
      onClick={onClose}
    >
      <form
        ref={formRef}
        className="finance-modal"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="finance-modal-header">
          <h3 id="tx-modal-title">
            {transaction ? "Edit Transaksi" : "Catat Transaksi"}
          </h3>
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
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
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
  const formRef = useRef<HTMLFormElement>(null);
  useDialogA11y(true, onClose, formRef);

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
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="budget-modal-title"
      onClick={onClose}
    >
      <form
        ref={formRef}
        className="finance-modal"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="finance-modal-header">
          <h3 id="budget-modal-title">
            {budget ? "Edit Budget" : "Tambah Budget"}
          </h3>
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
  const todayIso = getLocalDateString();
  const formRef = useRef<HTMLFormElement>(null);
  useDialogA11y(true, onClose, formRef);
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
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recurring-modal-title"
      onClick={onClose}
    >
      <form
        ref={formRef}
        className="finance-modal"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="finance-modal-header">
          <h3 id="recurring-modal-title">
            {rule ? "Edit Jadwal Berulang" : "Tambah Jadwal Berulang"}
          </h3>
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
            <CurrencyInput value={amount} onChangeValue={setAmount} required />
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
