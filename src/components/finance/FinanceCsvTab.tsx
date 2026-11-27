import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import {
  CSV_FILENAMES,
  exportFinanceCsvBundle,
  prepareCsvImportPreview,
} from "../../lib/finance/csv";
import { fetchAllFinanceTransactions } from "../../services/financeService";
import type {
  CsvImportPreview,
  CsvTableKey,
  FinanceAccount,
  FinanceBudget,
  FinanceCategory,
  FinanceRecurringTransaction,
} from "../../lib/finance/types";

interface FinanceCsvTabProps {
  userId: string;
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  budgets: FinanceBudget[];
  recurring: FinanceRecurringTransaction[];
  onCommitImport: (
    payload: CsvImportPreview["payload"],
    allowUpsert: boolean
  ) => Promise<void>;
}

const TABLE_LABELS: Record<CsvTableKey, string> = {
  accounts: "Akun (finance_accounts.csv)",
  categories: "Kategori (finance_categories.csv)",
  transactions: "Transaksi (finance_transactions.csv)",
  budgets: "Budget (finance_budgets.csv)",
  recurring: "Berulang (finance_recurring_transactions.csv)",
};

const TABLE_ORDER: CsvTableKey[] = [
  "accounts",
  "categories",
  "transactions",
  "budgets",
  "recurring",
];

function downloadCsvFile(filename: string, content: string) {
  const bom = "\uFEFF";
  const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function FinanceCsvTab({
  userId,
  accounts,
  categories,
  budgets,
  recurring,
  onCommitImport,
}: FinanceCsvTabProps) {
  const [csvTexts, setCsvTexts] = useState<
    Partial<Record<CsvTableKey, string>>
  >({});
  const [fileNames, setFileNames] = useState<
    Partial<Record<CsvTableKey, string>>
  >({});
  const [preview, setPreview] = useState<CsvImportPreview | null>(null);
  const [allowUpsert, setAllowUpsert] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleExportOne(table: CsvTableKey) {
    setExporting(true);
    setErrorMessage("");
    try {
      const allTransactions =
        table === "transactions"
          ? await fetchAllFinanceTransactions(userId)
          : [];
      const bundle = exportFinanceCsvBundle({
        currentUserId: userId,
        accounts,
        categories,
        transactions: allTransactions,
        budgets,
        recurring,
      });
      downloadCsvFile(CSV_FILENAMES[table], bundle[table]);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Gagal mengekspor CSV."
      );
    } finally {
      setExporting(false);
    }
  }

  async function handleExportAll() {
    setExporting(true);
    setErrorMessage("");
    try {
      const allTransactions = await fetchAllFinanceTransactions(userId);
      const bundle = exportFinanceCsvBundle({
        currentUserId: userId,
        accounts,
        categories,
        transactions: allTransactions,
        budgets,
        recurring,
      });
      TABLE_ORDER.forEach((key) => {
        downloadCsvFile(CSV_FILENAMES[key], bundle[key]);
      });
      setStatusMessage("Semua 5 file CSV berhasil diekspor (UTF-8).");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Gagal mengekspor CSV."
      );
    } finally {
      setExporting(false);
    }
  }

  async function handleFileSelect(
    table: CsvTableKey,
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvTexts((prev) => ({ ...prev, [table]: text }));
    setFileNames((prev) => ({ ...prev, [table]: file.name }));
    setPreview(null);
    setStatusMessage("");
    setErrorMessage("");
  }

  async function handlePreview() {
    setErrorMessage("");
    setStatusMessage("");
    try {
      const existingTransactions = csvTexts.transactions?.trim()
        ? await fetchAllFinanceTransactions(userId)
        : [];
      const result = prepareCsvImportPreview({
        currentUserId: userId,
        csvTexts,
        existingAccounts: accounts,
        existingCategories: categories,
        existingTransactions,
        existingBudgets: budgets,
        existingRecurring: recurring,
      });
      setPreview(result);
      setAllowUpsert(false);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Gagal memvalidasi pratinjau CSV."
      );
    }
  }

  async function handleCommit() {
    if (!preview || preview.hasFatalErrors) return;
    if (preview.hasDuplicates && !allowUpsert) {
      setErrorMessage(
        "Terdapat ID duplikat. Centang konfirmasi upsert sebelum melanjutkan."
      );
      return;
    }

    setImporting(true);
    setErrorMessage("");
    try {
      await onCommitImport(preview.payload, allowUpsert);
      setStatusMessage(
        "Impor CSV berhasil secara transaksional dan saldo telah dihitung ulang."
      );
      setPreview(null);
      setCsvTexts({});
      setFileNames({});
      setAllowUpsert(false);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Impor gagal dan seluruh perubahan dibatalkan (rollback)."
      );
    } finally {
      setImporting(false);
    }
  }

  const hasAnyFile = TABLE_ORDER.some((k) => Boolean(csvTexts[k]?.trim()));
  const totalDuplicates = preview
    ? Object.values(preview.duplicateIds).reduce((a, b) => a + b.length, 0)
    : 0;

  return (
    <div className="finance-stack">
      {/* Export Section */}
      <div className="finance-card">
        <div className="finance-card-header">
          <div className="finance-card-title">
            <Download size={18} />
            <div>
              <h3>Ekspor CSV (UTF-8)</h3>
              <p className="finance-muted">
                Ekspor hanya data milik akunmu dengan UUID stabil dan{" "}
                <code>opening_balance</code>. Data Supabase Auth tidak pernah
                diekspor.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="button-primary"
            onClick={handleExportAll}
            disabled={exporting}
          >
            <Download size={15} />{" "}
            {exporting ? "Mengekspor..." : "Ekspor Semua (5 CSV)"}
          </button>
        </div>

        <div className="csv-export-grid">
          {TABLE_ORDER.map((table) => (
            <button
              key={table}
              type="button"
              className="csv-export-item"
              onClick={() => handleExportOne(table)}
              disabled={exporting}
            >
              <FileSpreadsheet size={16} />
              <span>{CSV_FILENAMES[table]}</span>
              <Download size={14} />
            </button>
          ))}
        </div>
      </div>

      {/* Import Section */}
      <div className="finance-card">
        <div className="finance-card-header">
          <div className="finance-card-title">
            <Upload size={18} />
            <div>
              <h3>Impor CSV Transaksional</h3>
              <p className="finance-muted">
                Urutan impor: accounts → categories (induk lalu anak) →
                transactions → budgets → recurring. Semua <code>user_id</code>{" "}
                dipetakan otomatis ke akunmu saat ini.
              </p>
            </div>
          </div>
        </div>

        {statusMessage && (
          <div className="success-banner" role="status">
            <CheckCircle2 size={16} /> {statusMessage}
          </div>
        )}
        {errorMessage && (
          <div className="error-banner" role="alert">
            <AlertTriangle size={16} /> {errorMessage}
          </div>
        )}

        <div className="csv-upload-grid">
          {TABLE_ORDER.map((table) => (
            <label key={table} className="csv-upload-box">
              <span className="csv-upload-label">{TABLE_LABELS[table]}</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => handleFileSelect(table, e)}
              />
              <span className="csv-upload-status">
                {fileNames[table]
                  ? `Dipilih: ${fileNames[table]}`
                  : "Belum ada file dipilih"}
              </span>
            </label>
          ))}
        </div>

        <div className="finance-form-actions">
          <button
            type="button"
            className="button-quiet"
            disabled={!hasAnyFile}
            onClick={handlePreview}
          >
            Validasi &amp; Preview
          </button>
        </div>

        {preview && (
          <div className="csv-preview-panel">
            <h4>Hasil Preview &amp; Validasi</h4>
            <div className="csv-preview-counts">
              {TABLE_ORDER.map((t) => (
                <div key={t} className="csv-count-pill">
                  <span>{t}</span>
                  <strong>{preview.counts[t]} baris</strong>
                </div>
              ))}
            </div>

            {preview.errors.length > 0 ? (
              <div className="csv-error-list">
                <p className="csv-error-title">
                  <AlertTriangle size={15} /> Ditemukan {preview.errors.length}{" "}
                  kesalahan validasi (impor diblokir hingga diperbaiki):
                </p>
                <div className="finance-table-wrap">
                  <table className="finance-table">
                    <thead>
                      <tr>
                        <th>Tabel</th>
                        <th>Baris</th>
                        <th>Kolom</th>
                        <th>Pesan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.errors.map((err, idx) => (
                        <tr key={idx}>
                          <td>{err.table}</td>
                          <td>{err.row || "-"}</td>
                          <td>
                            <code>{err.field}</code>
                          </td>
                          <td>{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="success-banner">
                <CheckCircle2 size={16} /> Semua baris valid dan relasi
                akun/kategori terverifikasi.
              </div>
            )}

            {preview.hasDuplicates && (
              <label className="finance-checkbox-field csv-upsert-confirm">
                <input
                  type="checkbox"
                  checked={allowUpsert}
                  onChange={(e) => setAllowUpsert(e.target.checked)}
                />
                <span>
                  Ditemukan {totalDuplicates} ID duplikat yang sudah ada. Saya
                  konfirmasi untuk melakukan upsert (timpa baris dengan ID yang
                  sama).
                </span>
              </label>
            )}

            <div className="finance-form-actions">
              <button
                type="button"
                className="button-primary"
                disabled={
                  preview.hasFatalErrors ||
                  (preview.hasDuplicates && !allowUpsert) ||
                  importing
                }
                onClick={handleCommit}
              >
                {importing
                  ? "Mengimpor..."
                  : "Konfirmasi & Jalankan Impor Transaksional"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
