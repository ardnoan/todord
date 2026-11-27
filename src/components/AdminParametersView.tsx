import { useState } from "react";
import { RotateCcw, Save, ShieldCheck, Sliders } from "lucide-react";
import type {
  AppParameterSettings,
  TransactionStatus,
} from "../lib/finance/types";

interface AdminParametersViewProps {
  parameters: AppParameterSettings;
  onUpdate: (patch: Partial<AppParameterSettings>) => void;
  onReset: () => void;
  adminEmail: string | undefined;
}

export function AdminParametersView({
  parameters,
  onUpdate,
  onReset,
  adminEmail,
}: AdminParametersViewProps) {
  const [threshold, setThreshold] = useState(
    String(parameters.budgetWarningThresholdPercent)
  );
  const [defaultStatus, setDefaultStatus] = useState<TransactionStatus>(
    parameters.defaultTransactionStatus
  );
  const [defaultColor, setDefaultColor] = useState(
    parameters.defaultAccountColor
  );
  const [taskCatsText, setTaskCatsText] = useState(
    parameters.taskCategories.join(", ")
  );
  const [expenseCatsText, setExpenseCatsText] = useState(
    parameters.defaultFinanceExpenseCategories.join(", ")
  );
  const [incomeCatsText, setIncomeCatsText] = useState(
    parameters.defaultFinanceIncomeCategories.join(", ")
  );
  const [enableFinance, setEnableFinance] = useState(
    parameters.enableFinanceModule
  );
  const [savedNotice, setSavedNotice] = useState("");

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const parsedThreshold = Math.min(
      100,
      Math.max(10, Number(threshold) || 80)
    );
    const parseList = (raw: string, fallback: string[]) => {
      const items = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return items.length > 0 ? items : fallback;
    };

    onUpdate({
      budgetWarningThresholdPercent: parsedThreshold,
      defaultTransactionStatus: defaultStatus,
      defaultAccountColor: defaultColor,
      taskCategories: parseList(taskCatsText, parameters.taskCategories),
      defaultFinanceExpenseCategories: parseList(
        expenseCatsText,
        parameters.defaultFinanceExpenseCategories
      ),
      defaultFinanceIncomeCategories: parseList(
        incomeCatsText,
        parameters.defaultFinanceIncomeCategories
      ),
      enableFinanceModule: enableFinance,
    });
    setSavedNotice("Parameter aplikasi berhasil disimpan.");
    setTimeout(() => setSavedNotice(""), 3000);
  }

  function handleReset() {
    onReset();
    setSavedNotice("Parameter dikembalikan ke nilai default.");
    setTimeout(() => setSavedNotice(""), 3000);
  }

  return (
    <section className="finance-shell">
      <div className="finance-hero-card">
        <div>
          <span className="eyebrow">ADMIN · PARAMETER VALUE</span>
          <h1>Pengaturan Parameter Aplikasi</h1>
          <p className="finance-subtitle">
            Kelola parameter default untuk modul Tugas &amp; Keuangan. Pengguna
            biasa hanya melihat tampilan Dashboard yang ringkas.
          </p>
        </div>
        <div className="admin-badge">
          <ShieldCheck size={16} />
          <span>Admin: {adminEmail ?? "Aktif"}</span>
        </div>
      </div>

      {savedNotice && (
        <div className="success-banner" role="status">
          {savedNotice}
        </div>
      )}

      <form className="finance-card admin-form" onSubmit={handleSave}>
        <div className="finance-card-header">
          <div className="finance-card-title">
            <Sliders size={18} />
            <h2>Konfigurasi Parameter</h2>
          </div>
          <button type="button" className="button-quiet" onClick={handleReset}>
            <RotateCcw size={14} /> Reset Default
          </button>
        </div>

        <div className="finance-form-grid">
          <label className="finance-field">
            <span>Ambang Peringatan Budget (%)</span>
            <input
              type="number"
              min={10}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
            <small>
              Menampilkan indikator peringatan saat pemakaian budget mencapai
              persentase ini.
            </small>
          </label>

          <label className="finance-field">
            <span>Status Transaksi Default</span>
            <select
              value={defaultStatus}
              onChange={(e) =>
                setDefaultStatus(e.target.value as TransactionStatus)
              }
            >
              <option value="cleared">Cleared</option>
              <option value="pending">Pending</option>
              <option value="reconciled">Reconciled</option>
            </select>
          </label>

          <label className="finance-field">
            <span>Warna Akun Default</span>
            <input
              type="color"
              value={defaultColor}
              onChange={(e) => setDefaultColor(e.target.value)}
            />
          </label>

          <label className="finance-field finance-checkbox-field">
            <input
              type="checkbox"
              checked={enableFinance}
              onChange={(e) => setEnableFinance(e.target.checked)}
            />
            <span>Aktifkan Dashboard Keuangan untuk Pengguna</span>
          </label>
        </div>

        <div className="finance-form-stack">
          <label className="finance-field">
            <span>Kategori Tugas (pisahkan dengan koma)</span>
            <input
              type="text"
              value={taskCatsText}
              onChange={(e) => setTaskCatsText(e.target.value)}
            />
          </label>

          <label className="finance-field">
            <span>Preset Kategori Pengeluaran (pisahkan dengan koma)</span>
            <input
              type="text"
              value={expenseCatsText}
              onChange={(e) => setExpenseCatsText(e.target.value)}
            />
          </label>

          <label className="finance-field">
            <span>Preset Kategori Pemasukan (pisahkan dengan koma)</span>
            <input
              type="text"
              value={incomeCatsText}
              onChange={(e) => setIncomeCatsText(e.target.value)}
            />
          </label>
        </div>

        <div className="finance-form-actions">
          <button type="submit" className="button-primary">
            <Save size={16} /> Simpan Parameter
          </button>
        </div>
      </form>
    </section>
  );
}
