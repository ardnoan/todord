import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { User } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock3,
  Cloud,
  Folder,
  Layers,
  LockKeyhole,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./supabase";
import type {
  Database,
  Json,
  Priority,
  StickyNote as StickyNoteType,
  Subtask,
  Task,
  TaskDraft,
} from "./types";
import { useThemePreferences } from "./hooks/useThemePreferences";
import { useStickyNotes } from "./hooks/useStickyNotes";
import { isAdminUser, useAppParameters } from "./hooks/useAppParameters";
import { useDialogA11y } from "./hooks/useDialogA11y";
import { ThemeDashboardMenu } from "./components/ThemeDashboardMenu";
import { DraggableNoteModal } from "./components/DraggableNoteModal";
import { ActionListModal } from "./components/ActionListModal";
import { LogoutConfirmModal } from "./components/LogoutConfirmModal";
import { EmailVerificationView } from "./components/EmailVerificationView";
import { DashboardView } from "./components/DashboardView";
import { ErrorBoundary } from "./components/ErrorBoundary";

const FinanceView = lazy(() =>
  import("./components/finance/FinanceView").then((m) => ({
    default: m.FinanceView,
  }))
);
const AdminParametersView = lazy(() =>
  import("./components/AdminParametersView").then((m) => ({
    default: m.AdminParametersView,
  }))
);

function WorkspaceSkeleton({ label }: { label: string }) {
  return (
    <div className="workspace-skeleton" role="status" aria-live="polite">
      <span className="loader" />
      <span>{label}</span>
    </div>
  );
}

type CloudState = "connecting" | "synced" | "syncing" | "error";
type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

const categories = ["Personal", "Work", "Study"];

const emptyDraft: TaskDraft = {
  title: "",
  notes: "",
  dueDate: "",
  category: "Personal",
  priority: "medium",
  completed: false,
  subtasks: [],
};

import { formatLocalDateString, getLocalDateString } from "./lib/date";

function parseSubtasks(value: Json): Subtask[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        if (!("id" in item) || !("title" in item) || !("completed" in item))
          return [];
        if (typeof item.id !== "string" || typeof item.title !== "string")
          return [];
        return [
          {
            id: item.id,
            title: item.title,
            completed: item.completed === true,
          },
        ];
      })
    : [];
}

function parseTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    dueDate: row.due_date ?? "",
    category: row.category,
    priority: row.priority,
    completed: row.completed,
    subtasks: parseSubtasks(row.subtasks),
    createdAt: Date.parse(row.created_at),
  };
}

function formatDueDate(value: string) {
  if (!value) return "Tanpa tanggal";
  const date = new Date(`${value}T00:00:00`);
  const today = getLocalDateString();
  if (value === today) return "Hari ini";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (value === formatLocalDateString(tomorrow)) return "Besok";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function SupabaseSetup() {
  return (
    <main className="setup-screen">
      <div className="setup-card">
        <div className="brand-mark">
          <CheckCheck size={24} />
        </div>
        <span className="eyebrow">RUANG · SETUP</span>
        <h1>Hubungkan ruang kerjamu.</h1>
        <p>
          Tambahkan URL dan public key Supabase agar akun dan tugasmu tersimpan
          serta tersinkron di cloud.
        </p>
        <div className="setup-steps">
          <div>
            <span>01</span>
            <p>
              Buat proyek Supabase dan salin <strong>Project URL</strong> serta
              anon/publishable key.
            </p>
          </div>
          <div>
            <span>02</span>
            <p>
              Jalankan <code>supabase/schema.sql</code> di SQL Editor untuk
              membuat tabel, keamanan RLS, dan realtime.
            </p>
          </div>
          <div>
            <span>03</span>
            <p>
              Isi <code>.env</code> dengan <code>VITE_SUPABASE_URL</code> dan{" "}
              <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>.
            </p>
          </div>
        </div>
        <a
          className="setup-link"
          href="https://supabase.com/dashboard/"
          target="_blank"
          rel="noreferrer"
        >
          Buka Supabase Dashboard <ArrowRight size={16} />
        </a>
        <p className="setup-footnote">
          Jangan pernah memasukkan service_role key ke aplikasi web.
        </p>
      </div>
    </main>
  );
}

function AuthScreen() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(
    null
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError("Supabase belum dikonfigurasi.");
      return;
    }
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (isRegister) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (signUpError) throw signUpError;
        // If confirmation is required, show enhanced verification screen
        if (!data.session) {
          setVerificationEmail(email.trim());
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      if (
        message.includes("already registered") ||
        message.includes("already been registered")
      ) {
        setError("Email ini sudah terdaftar.");
      } else if (message.includes("Invalid login credentials")) {
        setError("Email atau kata sandi tidak cocok.");
      } else if (message.includes("Password should be at least")) {
        setError("Gunakan kata sandi minimal 6 karakter.");
      } else {
        setError(
          "Tidak dapat memproses akun. Periksa koneksi dan pengaturan Supabase."
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-aside">
        <div className="brand">
          <span className="brand-mark">
            <CheckCheck size={20} />
          </span>
          <span>
            ruang<span className="brand-period">.</span>
          </span>
        </div>
        <div className="auth-quote">
          <span className="eyebrow">RUANG UNTUK FOKUS</span>
          <h1>Satu hal dalam satu waktu.</h1>
          <p>Rencanakan dengan jernih. Selesaikan dengan tenang.</p>
          <div className="quote-decoration">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <span className="auth-copyright">
          Dirancang untuk hari yang lebih ringan.
        </span>
      </div>
      <section className="auth-form-wrap">
        <AnimatePresence mode="wait">
          {verificationEmail ? (
            <EmailVerificationView
              key="verify-email"
              email={verificationEmail}
              onBackToLogin={() => {
                setVerificationEmail(null);
                setIsRegister(false);
                setError("");
              }}
              onChangeEmail={() => {
                setVerificationEmail(null);
                setIsRegister(true);
                setError("");
              }}
            />
          ) : (
            <motion.form
              key="auth-form"
              className="auth-form"
              onSubmit={submit}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="auth-mobile-brand">
                <span className="brand-mark">
                  <CheckCheck size={20} />
                </span>{" "}
                ruang.
              </div>
              <span className="eyebrow">
                {isRegister
                  ? "MULAI DENGAN LANGKAH KECIL"
                  : "SENANG BERTEMU LAGI"}
              </span>
              <h2>{isRegister ? "Buat akunmu" : "Selamat datang kembali"}</h2>
              <p className="auth-description">
                {isRegister
                  ? "Semua rencanamu tersimpan aman dan tersinkron."
                  : "Masuk untuk melanjutkan rencanamu."}
              </p>
              {error && (
                <div className="error-banner" role="alert">
                  {error}
                </div>
              )}
              {notice && (
                <div className="success-banner" role="status">
                  {notice}
                </div>
              )}
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nama@email.com"
                required
              />
              <label htmlFor="password">Kata sandi</label>
              <input
                id="password"
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimal 6 karakter"
                minLength={6}
                required
              />
              <button
                className="button-primary auth-submit"
                type="submit"
                disabled={busy}
              >
                {busy ? "Memproses..." : isRegister ? "Buat akun" : "Masuk"}
                {!busy && <ArrowRight size={17} />}
              </button>
              <p className="auth-toggle">
                {isRegister ? "Sudah punya akun?" : "Belum punya akun?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(!isRegister);
                    setError("");
                  }}
                >
                  {isRegister ? "Masuk" : "Daftar gratis"}
                </button>
              </p>
              <div className="auth-security">
                <LockKeyhole size={14} /> Data tugas tersimpan privat di akunmu.
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}

function TaskDialog({
  task,
  taskCategories,
  lockedCategory,
  onClose,
  onSave,
  onDelete,
}: {
  task: Task | null;
  taskCategories: string[];
  lockedCategory?: string | null;
  onClose: () => void;
  onSave: (draft: TaskDraft) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const modalRef = useRef<HTMLFormElement>(null);
  useDialogA11y(true, onClose, modalRef);
  const availableCategories =
    taskCategories.length > 0 ? taskCategories : categories;
  const [draft, setDraft] = useState<TaskDraft>(
    task
      ? {
          title: task.title,
          notes: task.notes,
          dueDate: task.dueDate,
          category: lockedCategory || task.category,
          priority: task.priority,
          completed: task.completed,
          subtasks: task.subtasks,
          color: task.color,
        }
      : {
          ...emptyDraft,
          category:
            lockedCategory || availableCategories[0] || emptyDraft.category,
        }
  );
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  function addSubtask() {
    const title = subtaskTitle.trim();
    if (!title) return;
    setDraft((current) => ({
      ...current,
      subtasks: [
        ...current.subtasks,
        { id: crypto.randomUUID(), title, completed: false },
      ],
    }));
    setSubtaskTitle("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave({ ...draft, title: draft.title.trim() });
      onClose();
    } catch {
      setError("Tugas belum tersimpan. Periksa koneksi lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTask() {
    setDeleting(true);
    setError("");
    try {
      await onDelete();
      onClose();
    } catch {
      setError("Tugas belum terhapus. Periksa koneksi lalu coba lagi.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-dialog-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.form
        ref={modalRef}
        className="task-modal"
        onSubmit={submit}
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", stiffness: 420, damping: 30 }}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">
              {task ? "DETAIL TUGAS" : "TUGAS BARU"}
            </span>
            <h2 id="task-dialog-title">
              {task ? "Atur detailnya." : "Apa yang ingin kamu selesaikan?"}
            </h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Tutup"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        <label className="field-label" htmlFor="task-title">
          Nama tugas
        </label>
        <input
          id="task-title"
          className="task-title-input"
          autoFocus
          value={draft.title}
          onChange={(event) =>
            setDraft({ ...draft, title: event.target.value })
          }
          placeholder="Contoh: Rapikan presentasi"
          required
        />
        <label className="field-label" htmlFor="task-notes">
          Catatan <span>OPSIONAL</span>
        </label>
        <textarea
          id="task-notes"
          rows={2}
          value={draft.notes}
          onChange={(event) =>
            setDraft({ ...draft, notes: event.target.value })
          }
          placeholder="Tambahkan konteks kecil..."
        />
        <div className="form-grid">
          <div>
            <label className="field-label" htmlFor="task-date">
              Tanggal
            </label>
            <input
              id="task-date"
              type="date"
              value={draft.dueDate}
              onChange={(event) =>
                setDraft({ ...draft, dueDate: event.target.value })
              }
            />
          </div>
          <div>
            <label className="field-label" htmlFor="task-category">
              Daftar
            </label>
            <select
              id="task-category"
              value={draft.category}
              disabled={Boolean(lockedCategory)}
              title={
                lockedCategory
                  ? `Kategori dikunci ke ${lockedCategory} sesuai tab aktif`
                  : undefined
              }
              onChange={(event) =>
                setDraft({ ...draft, category: event.target.value })
              }
            >
              {availableCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
              {!availableCategories.includes(draft.category) && (
                <option value={draft.category}>{draft.category}</option>
              )}
            </select>
          </div>
        </div>
        <label className="field-label" htmlFor="task-priority">
          Prioritas
        </label>
        <select
          id="task-priority"
          value={draft.priority}
          onChange={(event) =>
            setDraft({ ...draft, priority: event.target.value as Priority })
          }
        >
          <option value="low">Rendah</option>
          <option value="medium">Sedang</option>
          <option value="high">Tinggi</option>
        </select>
        <div className="subtasks-editor">
          <label className="field-label">
            Langkah kecil{" "}
            <span>
              {draft.subtasks.length
                ? `${draft.subtasks.length} LANGKAH`
                : "OPSIONAL"}
            </span>
          </label>
          {draft.subtasks.map((subtask) => (
            <div className="subtask-edit-row" key={subtask.id}>
              <button
                type="button"
                className={`subtask-check ${subtask.completed ? "checked" : ""}`}
                aria-label={
                  subtask.completed ? "Tandai belum selesai" : "Tandai selesai"
                }
                onClick={() =>
                  setDraft({
                    ...draft,
                    subtasks: draft.subtasks.map((item) =>
                      item.id === subtask.id
                        ? { ...item, completed: !item.completed }
                        : item
                    ),
                  })
                }
              >
                {subtask.completed && <Check size={12} />}
              </button>
              <span className={subtask.completed ? "subtask-done" : ""}>
                {subtask.title}
              </span>
              <button
                type="button"
                className="subtask-remove"
                aria-label={`Hapus ${subtask.title}`}
                onClick={() =>
                  setDraft({
                    ...draft,
                    subtasks: draft.subtasks.filter(
                      (item) => item.id !== subtask.id
                    ),
                  })
                }
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <div className="subtask-add">
            <input
              value={subtaskTitle}
              onChange={(event) => setSubtaskTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addSubtask();
                }
              }}
              placeholder="Tambah langkah..."
            />
            <button
              type="button"
              onClick={addSubtask}
              aria-label="Tambah langkah"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
        <div className="modal-actions">
          {task && (
            <button
              type="button"
              className="button-delete"
              onClick={deleteTask}
              disabled={deleting}
            >
              <Trash2 size={14} />
              {deleting ? "Menghapus..." : "Hapus"}
            </button>
          )}
          <button type="button" className="button-quiet" onClick={onClose}>
            Batal
          </button>
          <button
            type="submit"
            className="button-primary"
            disabled={busy || deleting}
          >
            {busy ? "Menyimpan..." : task ? "Simpan perubahan" : "Buat tugas"}{" "}
            <ArrowRight size={16} />
          </button>
        </div>
      </motion.form>
    </div>
  );
}

function loadCachedTaskOrder(userId?: string): string[] {
  if (!userId) return [];
  try {
    const cached = localStorage.getItem(`ruang.task.order.v2.${userId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed as string[];
    }
  } catch {
    // ignore
  }
  return [];
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [tasksState, setTasksState] = useState<{
    ownerId?: string;
    items: Task[];
  }>({
    ownerId: undefined,
    items: [],
  });
  const tasks = useMemo(
    () => (user && tasksState.ownerId === user.id ? tasksState.items : []),
    [user, tasksState]
  );
  const setTasks = useCallback(
    (updater: Task[] | ((prev: Task[]) => Task[])) => {
      setTasksState((prev) => {
        const current = user && prev.ownerId === user.id ? prev.items : [];
        const nextItems =
          typeof updater === "function" ? updater(current) : updater;
        return { ownerId: user?.id, items: nextItems };
      });
    },
    [user]
  );
  const [cloudState, setCloudState] = useState<CloudState>("connecting");
  const [syncError, setSyncError] = useState("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [dialogTask, setDialogTask] = useState<Task | null | undefined>(
    undefined
  );
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Theme Preferences & Menu (synced per-user)
  const { preferences, setTheme, setLayout, toggleMotto, resetPreferences } =
    useThemePreferences(user?.id);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

  // Pure Sticky Notes (Separated from Task Progress, synced per-user)
  const {
    notes: stickyNotes,
    addNote,
    updateNote,
    deleteNote,
  } = useStickyNotes(user?.id);
  const [activeStickyNote, setActiveStickyNote] =
    useState<StickyNoteType | null>(null);

  // In-Dashboard Action Pop-up Modal (Draggable & Minimizable)
  const [actionModal, setActionModal] = useState<{
    type:
      "today" | "active" | "completed" | "overdue" | "category" | "date" | null;
    categoryName?: string;
    dateKey?: string;
  }>({ type: null });

  // Mobile profile menu
  const [mobileProfileMenuOpen, setMobileProfileMenuOpen] = useState(false);

  // Undo toast for deleted task (5 seconds)
  const [undoTask, setUndoTask] = useState<Task | null>(null);
  const undoTaskTimerRef = useRef<number | null>(null);

  // Controlled Category Tab Filter on DashboardView
  const [dashboardCategoryFilter, setDashboardCategoryFilter] =
    useState<string>("all");

  // Persistent Custom Task Ordering (synced per-user via user_preferences)
  const [taskOrderState, setTaskOrderState] = useState<{
    ownerId?: string;
    order: string[];
  }>({
    ownerId: undefined,
    order: [],
  });

  const taskOrder = useMemo(() => {
    if (!user) return [];
    return taskOrderState.ownerId === user.id
      ? taskOrderState.order
      : loadCachedTaskOrder(user.id);
  }, [user, taskOrderState]);

  useEffect(() => {
    if (!user || !supabase) return;
    const cacheKey = `ruang.task.order.v2.${user.id}`;
    const client = supabase;
    let cancelled = false;
    client
      .from("user_preferences")
      .select("task_order")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (error || cancelled) return;
        const cloudOrder = Array.isArray(data?.task_order)
          ? (data.task_order as string[])
          : null;
        if (cloudOrder && cloudOrder.length > 0) {
          setTaskOrderState({ ownerId: user.id, order: cloudOrder });
          localStorage.setItem(cacheKey, JSON.stringify(cloudOrder));
          localStorage.removeItem("ruang.task.order.v1");
        } else {
          try {
            const legacyRaw = localStorage.getItem("ruang.task.order.v1");
            if (legacyRaw) {
              const legacy = JSON.parse(legacyRaw);
              if (Array.isArray(legacy) && legacy.length > 0) {
                setTaskOrderState({ ownerId: user.id, order: legacy });
                localStorage.setItem(cacheKey, JSON.stringify(legacy));
                await client.from("user_preferences").upsert({
                  user_id: user.id,
                  task_order: legacy as unknown as Json,
                });
              }
              localStorage.removeItem("ruang.task.order.v1");
            }
          } catch {
            // ignore
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const orderedTasks = useMemo(() => {
    if (taskOrder.length === 0) return tasks;
    const rankMap = new Map(taskOrder.map((id, idx) => [id, idx]));
    return [...tasks].sort((a, b) => {
      const ra = rankMap.get(a.id);
      const rb = rankMap.get(b.id);
      if (ra !== undefined && rb !== undefined) return ra - rb;
      if (ra !== undefined) return -1;
      if (rb !== undefined) return 1;
      return b.createdAt - a.createdAt;
    });
  }, [tasks, taskOrder]);

  function moveTaskOrder(
    taskId: string,
    direction: "up" | "down",
    visibleIds: string[]
  ) {
    const pos = visibleIds.indexOf(taskId);
    if (pos < 0) return;
    const swapPos = direction === "up" ? pos - 1 : pos + 1;
    if (swapPos < 0 || swapPos >= visibleIds.length) return;

    const neighborId = visibleIds[swapPos];
    const baseOrder = orderedTasks.map((t) => t.id);
    const idxA = baseOrder.indexOf(taskId);
    const idxB = baseOrder.indexOf(neighborId);
    if (idxA < 0 || idxB < 0) return;

    const next = [...baseOrder];
    [next[idxA], next[idxB]] = [next[idxB], next[idxA]];
    setTaskOrderState({ ownerId: user?.id, order: next });
    if (user) {
      try {
        localStorage.setItem(
          `ruang.task.order.v2.${user.id}`,
          JSON.stringify(next)
        );
      } catch {
        // ignore storage quota errors
      }
      if (supabase) {
        supabase
          .from("user_preferences")
          .upsert({
            user_id: user.id,
            task_order: next as unknown as Json,
          })
          .then(({ error }) => {
            if (error) console.error("task_order sync error:", error.message);
          });
      }
    }
  }

  // Logout Confirmation Modal
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Workspace Switcher & Admin Parameter Values
  const [activeWorkspace, setActiveWorkspace] = useState<
    "tasks" | "finance" | "admin"
  >(() => {
    try {
      const saved = localStorage.getItem("ruang.activeWorkspace.v1");
      if (saved === "finance" || saved === "admin" || saved === "tasks") {
        return saved;
      }
    } catch {
      // ignore
    }
    return "tasks";
  });

  useEffect(() => {
    try {
      localStorage.setItem("ruang.activeWorkspace.v1", activeWorkspace);
    } catch {
      // ignore
    }
  }, [activeWorkspace]);

  const { parameters, updateParameters, resetParameters } =
    useAppParameters(user);

  useEffect(() => {
    return () => {
      if (undoTaskTimerRef.current !== null) {
        window.clearTimeout(undoTaskTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        setTasksState({ ownerId: undefined, items: [] });
        setTaskOrderState({ ownerId: undefined, order: [] });
      }
      setCloudState("connecting");
      setSyncError("");
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!user || !supabase) return;
    const currentUser = user;
    const client = supabase;
    let active = true;
    async function loadTasks() {
      const { data, error } = await client
        .from("tasks")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) {
        setCloudState("error");
        setSyncError(
          "Tidak dapat memuat tugas. Periksa koneksi atau kebijakan RLS Supabase."
        );
        return;
      }
      setTasksState({ ownerId: currentUser.id, items: data.map(parseTask) });
      setSyncError("");
      setCloudState("synced");
    }

    void loadTasks();

    // Batch/debounce realtime payload updates (300ms) instead of full-table refetch
    const pendingEvents: Array<{
      eventType: "INSERT" | "UPDATE" | "DELETE";
      newRow?: TaskRow;
      oldId?: string;
    }> = [];
    let flushTimer: number | null = null;

    function flushRealtimeEvents() {
      flushTimer = null;
      if (!active || pendingEvents.length === 0) return;
      const batch = pendingEvents.splice(0, pendingEvents.length);
      setTasksState((prev) => {
        let next = prev.ownerId === currentUser.id ? [...prev.items] : [];
        for (const ev of batch) {
          if (ev.eventType === "INSERT" && ev.newRow) {
            const parsed = parseTask(ev.newRow);
            if (!next.some((t) => t.id === parsed.id)) {
              next = [parsed, ...next];
            }
          } else if (ev.eventType === "UPDATE" && ev.newRow) {
            const parsed = parseTask(ev.newRow);
            const idx = next.findIndex((t) => t.id === parsed.id);
            if (idx >= 0) {
              next[idx] = parsed;
            } else {
              next = [parsed, ...next];
            }
          } else if (ev.eventType === "DELETE" && ev.oldId) {
            next = next.filter((t) => t.id !== ev.oldId);
          }
        }
        return { ownerId: currentUser.id, items: next };
      });
      setCloudState("synced");
    }

    const channel = client
      .channel(`tasks:${currentUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `user_id=eq.${currentUser.id}`,
        },
        (payload) => {
          if (!active) return;
          setCloudState("syncing");
          pendingEvents.push({
            eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            newRow: payload.new as TaskRow | undefined,
            oldId: (payload.old as { id?: string } | undefined)?.id,
          });
          if (flushTimer !== null) {
            window.clearTimeout(flushTimer);
          }
          flushTimer = window.setTimeout(flushRealtimeEvents, 300);
        }
      )
      .subscribe((status) => {
        if (!active) return;
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setCloudState("error");
          setSyncError(
            "Live sync gagal. Pastikan Realtime aktif untuk tabel tasks."
          );
        }
      });

    return () => {
      active = false;
      if (flushTimer !== null) {
        window.clearTimeout(flushTimer);
      }
      void client.removeChannel(channel);
    };
  }, [user]);

  const today = getLocalDateString();

  const filteredTasks = useMemo(() => {
    let result = tasks;
    const normalizedSearch = search.trim().toLocaleLowerCase("id");
    if (normalizedSearch) {
      result = result.filter((task) =>
        `${task.title} ${task.notes} ${task.category}`
          .toLocaleLowerCase("id")
          .includes(normalizedSearch)
      );
    }
    return result;
  }, [tasks, search]);

  async function saveTask(draft: TaskDraft, task?: Task) {
    if (!supabase || !user) throw new Error("Akun atau database belum siap.");
    setCloudState("syncing");
    const payload = {
      title: draft.title,
      notes: draft.notes,
      due_date: draft.dueDate || null,
      category: draft.category,
      priority: draft.priority,
      completed: draft.completed,
      subtasks: draft.subtasks,
    };
    try {
      if (task) {
        const { data, error } = await supabase
          .from("tasks")
          .update(payload)
          .eq("id", task.id)
          .eq("user_id", user.id)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Tugas tidak ditemukan atau akses ditolak.");
      } else {
        const { data, error } = await supabase
          .from("tasks")
          .insert({ ...payload, user_id: user.id })
          .select()
          .single();
        if (error) throw error;
        if (data) {
          setTasks((prev) => [parseTask(data), ...prev]);
        }
      }
    } catch (error) {
      setCloudState("error");
      setSyncError(
        "Tugas belum tersimpan. Periksa koneksi atau kebijakan RLS Supabase."
      );
      throw error;
    }
  }

  async function toggleTask(task: Task) {
    if (!supabase || !user) return;
    setCloudState("syncing");
    const previousTasks = tasks;
    const nextCompleted = !task.completed;
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, completed: nextCompleted } : t
      )
    );
    try {
      const { data, error } = await supabase
        .from("tasks")
        .update({ completed: nextCompleted })
        .eq("id", task.id)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Tugas tidak ditemukan atau akses ditolak.");
      setCloudState("synced");
    } catch {
      // Rollback optimistic update on failure
      setTasks(previousTasks);
      setCloudState("error");
      setSyncError("Perubahan belum tersimpan. Coba lagi saat koneksi pulih.");
    }
  }

  async function removeTask(task: Task) {
    if (!supabase || !user) throw new Error("Akun atau database belum siap.");
    setCloudState("syncing");
    try {
      const { data, error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", task.id)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Tugas tidak ditemukan atau akses ditolak.");
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      setCloudState("synced");
      setUndoTask(task);
      if (undoTaskTimerRef.current !== null) {
        window.clearTimeout(undoTaskTimerRef.current);
      }
      undoTaskTimerRef.current = window.setTimeout(() => {
        setUndoTask(null);
        undoTaskTimerRef.current = null;
      }, 5000);
    } catch (error) {
      setCloudState("error");
      setSyncError(
        "Tugas belum terhapus. Periksa koneksi atau kebijakan RLS Supabase."
      );
      throw error;
    }
  }

  async function handleUndoDeleteTask() {
    if (!undoTask) return;
    const taskToRestore = undoTask;
    setUndoTask(null);
    if (undoTaskTimerRef.current !== null) {
      window.clearTimeout(undoTaskTimerRef.current);
      undoTaskTimerRef.current = null;
    }
    try {
      await saveTask({
        title: taskToRestore.title,
        notes: taskToRestore.notes,
        dueDate: taskToRestore.dueDate,
        category: taskToRestore.category,
        priority: taskToRestore.priority,
        completed: taskToRestore.completed,
        subtasks: taskToRestore.subtasks,
        color: taskToRestore.color,
      });
    } catch {
      setSyncError("Gagal memulihkan tugas yang dihapus.");
    }
  }

  async function handleConfirmLogout() {
    if (!supabase) return;
    setIsLoggingOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setCloudState("error");
        setSyncError("Tidak dapat keluar dari akun. Coba lagi.");
      } else {
        setShowLogoutConfirm(false);
      }
    } finally {
      setIsLoggingOut(false);
    }
  }

  if (!isSupabaseConfigured) return <SupabaseSetup />;
  if (!authReady)
    return (
      <div className="app-loading">
        <span className="loader" /> Menyiapkan ruang...
      </div>
    );
  if (!user) return <AuthScreen />;

  const greetingName = user.email?.split("@")[0] ?? "Kamu";
  const isAdmin = isAdminUser(user);

  return (
    <div className="app-shell">
      {/* Main Panel - Full Width Dashboard Focus */}
      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <div className="brand">
              <span className="brand-mark">
                <CheckCheck size={19} />
              </span>
              <span>
                ruang<span className="brand-period">.</span>
              </span>
            </div>
            <div
              className={`topbar-sync-status sync-${cloudState}`}
              title={
                cloudState === "synced"
                  ? "Tersinkron ke cloud Supabase"
                  : cloudState === "syncing"
                    ? "Menyinkronkan data..."
                    : cloudState === "error"
                      ? "Sync bermasalah"
                      : "Menghubungkan..."
              }
            >
              <span className={`sync-dot ${cloudState}`} />
              <Cloud size={13} />
              <span className="sync-text">
                {cloudState === "synced"
                  ? "Tersinkron"
                  : cloudState === "syncing"
                    ? "Menyinkronkan..."
                    : cloudState === "error"
                      ? "Sync error"
                      : "Menghubungkan"}
              </span>
            </div>

            <nav className="workspace-switcher" aria-label="Pilih Dashboard">
              <button
                type="button"
                className={`workspace-switch-btn ${activeWorkspace === "tasks" ? "active" : ""}`}
                onClick={() => setActiveWorkspace("tasks")}
              >
                <CheckCheck size={14} />
                <span>Tugas</span>
              </button>
              {parameters.enableFinanceModule && (
                <button
                  type="button"
                  className={`workspace-switch-btn ${activeWorkspace === "finance" ? "active" : ""}`}
                  onClick={() => setActiveWorkspace("finance")}
                >
                  <Wallet size={14} />
                  <span>Keuangan</span>
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  className={`workspace-switch-btn ${activeWorkspace === "admin" ? "active" : ""}`}
                  onClick={() => setActiveWorkspace("admin")}
                >
                  <ShieldCheck size={14} />
                  <span>Admin</span>
                </button>
              )}
            </nav>
          </div>

          <div className="topbar-actions">
            {/* Dashboard Menu Trigger (Theme & Layout) */}
            <button
              type="button"
              className={`theme-menu-trigger ${isThemeMenuOpen ? "active" : ""}`}
              onClick={() => setIsThemeMenuOpen(true)}
              title="Atur tema warna, tata letak & widget"
              aria-label="Atur tampilan dan tema"
            >
              <SlidersHorizontal size={14} />
              <span>Tampilan</span>
            </button>

            {/* Quick Search (scoped to Tasks workspace) */}
            {activeWorkspace === "tasks" && (
              <>
                <label
                  className={`search-box ${searchOpen ? "mobile-open" : ""}`}
                >
                  <Search size={16} />
                  <input
                    ref={searchInputRef}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Cari tugas di ruang..."
                  />
                  <kbd>⌘ K</kbd>
                  {searchOpen && (
                    <button
                      type="button"
                      className="search-close"
                      onClick={() => {
                        setSearchOpen(false);
                        setSearch("");
                      }}
                      aria-label="Tutup pencarian"
                    >
                      <X size={15} />
                    </button>
                  )}
                </label>
                <button
                  type="button"
                  className="mobile-search-trigger"
                  aria-label="Cari tugas"
                  onClick={() => {
                    setSearchOpen(true);
                    setTimeout(() => searchInputRef.current?.focus(), 0);
                  }}
                >
                  <Search size={17} />
                </button>
              </>
            )}

            <span className="date-stamp">
              {new Intl.DateTimeFormat("id-ID", {
                weekday: "short",
                day: "numeric",
                month: "short",
              }).format(new Date())}
            </span>

            <div className="header-divider" />

            {/* User Profile & Logout Handled in Header */}
            <div className="header-profile-wrap">
              <button
                type="button"
                className="header-profile-chip"
                title={`Akun: ${user.email}`}
                aria-label="Menu profil"
                aria-expanded={mobileProfileMenuOpen}
                onClick={() => setMobileProfileMenuOpen((prev) => !prev)}
              >
                <span className="header-avatar">
                  {greetingName.charAt(0).toUpperCase()}
                </span>
                <span className="header-user-name">{greetingName}</span>
              </button>
              <button
                type="button"
                className="header-logout-btn"
                onClick={() => setShowLogoutConfirm(true)}
                title="Keluar akun"
                aria-label="Keluar akun"
              >
                <LogOut size={15} />
                <span className="logout-label">Keluar</span>
              </button>

              {mobileProfileMenuOpen && (
                <>
                  <div
                    className="mobile-profile-backdrop"
                    onClick={() => setMobileProfileMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="mobile-profile-dropdown" role="menu">
                    <div className="mobile-profile-info">
                      <strong>{greetingName}</strong>
                      <span>{user.email}</span>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMobileProfileMenuOpen(false);
                        setIsThemeMenuOpen(true);
                      }}
                    >
                      <SlidersHorizontal size={15} />
                      <span>Tampilan</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="danger"
                      onClick={() => {
                        setMobileProfileMenuOpen(false);
                        setShowLogoutConfirm(true);
                      }}
                    >
                      <LogOut size={15} />
                      <span>Keluar</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="content-scroll">
          {syncError && (
            <div className="sync-error" role="alert">
              <Cloud size={16} />
              {syncError}
              <button
                type="button"
                aria-label="Tutup pesan"
                onClick={() => setSyncError("")}
              >
                <X size={15} />
              </button>
            </div>
          )}

          {undoTask && (
            <div className="undo-toast-banner" role="status">
              <span>Tugas &ldquo;{undoTask.title}&rdquo; dihapus.</span>
              <button
                type="button"
                className="button-quiet btn-xs"
                onClick={handleUndoDeleteTask}
              >
                Urungkan
              </button>
            </div>
          )}

          {activeWorkspace === "tasks" && search.trim() ? (
            <section className="search-results-section">
              <div className="search-results-header">
                <div>
                  <h2>Hasil Pencarian</h2>
                  <p>
                    Ditemukan {filteredTasks.length} tugas untuk &ldquo;{search}
                    &rdquo;
                  </p>
                </div>
                <button
                  type="button"
                  className="button-quiet"
                  onClick={() => setSearch("")}
                >
                  <X size={14} /> Tutup Pencarian
                </button>
              </div>

              {filteredTasks.length > 0 ? (
                <div className={`task-list layout-${preferences.layout}`}>
                  <AnimatePresence initial={false}>
                    {filteredTasks.map((task) => (
                      <motion.article
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.18 }}
                        className={`task-row ${task.completed ? "task-completed" : ""}`}
                        key={task.id}
                      >
                        <button
                          type="button"
                          className={`task-check ${task.completed ? "checked" : ""}`}
                          aria-label={
                            task.completed
                              ? "Tandai belum selesai"
                              : "Tandai selesai"
                          }
                          onClick={() => toggleTask(task)}
                        >
                          {task.completed && <Check size={14} />}
                        </button>
                        <button
                          type="button"
                          className="task-content"
                          onClick={() => setDialogTask(task)}
                        >
                          <span className="task-title">{task.title}</span>
                          {task.notes && (
                            <span className="task-notes">{task.notes}</span>
                          )}
                          <span className="task-meta">
                            <span
                              className={`task-date ${task.dueDate && task.dueDate < today && !task.completed ? "overdue" : ""}`}
                            >
                              <Clock3 size={12} />
                              {formatDueDate(task.dueDate)}
                            </span>
                            <span
                              className={`task-category cat-${categories.indexOf(task.category) >= 0 ? categories.indexOf(task.category) : 0}`}
                            >
                              <span className="task-cat-dot" />
                              {task.category}
                            </span>
                            {task.priority === "high" && (
                              <span className="priority-label">
                                Prioritas tinggi
                              </span>
                            )}
                          </span>
                        </button>
                        <button
                          className="task-edit"
                          type="button"
                          onClick={() => setDialogTask(task)}
                          aria-label={`Edit ${task.title}`}
                        >
                          <ArrowRight size={16} />
                        </button>
                      </motion.article>
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">
                    <Search size={24} />
                  </div>
                  <h3>Tidak ada tugas yang cocok.</h3>
                  <p>
                    Coba kata kunci lain atau hapus pencarian untuk kembali ke
                    dashboard.
                  </p>
                </div>
              )}
            </section>
          ) : activeWorkspace === "finance" &&
            parameters.enableFinanceModule ? (
            <ErrorBoundary title="Gagal memuat modul Keuangan">
              <Suspense
                fallback={
                  <WorkspaceSkeleton label="Memuat modul Keuangan..." />
                }
              >
                <FinanceView
                  userId={user.id}
                  userName={greetingName}
                  parameters={parameters}
                />
              </Suspense>
            </ErrorBoundary>
          ) : activeWorkspace === "admin" && isAdmin ? (
            <ErrorBoundary title="Gagal memuat modul Admin">
              <Suspense
                fallback={<WorkspaceSkeleton label="Memuat modul Admin..." />}
              >
                <AdminParametersView
                  parameters={parameters}
                  onUpdate={updateParameters}
                  onReset={resetParameters}
                  adminEmail={user.email}
                />
              </Suspense>
            </ErrorBoundary>
          ) : (
            <ErrorBoundary title="Gagal memuat Dashboard Tugas">
              <DashboardView
                tasks={orderedTasks}
                stickyNotes={stickyNotes}
                userName={greetingName}
                taskCategories={parameters.taskCategories}
                taskLayout={preferences.layout}
                categoryFilter={dashboardCategoryFilter}
                onCategoryFilterChange={setDashboardCategoryFilter}
                onCreateTask={() => setDialogTask(null)}
                onOpenActionModal={(type, cat, dateKey) => {
                  setActionModal({ type, categoryName: cat, dateKey });
                }}
                onOpenStickyNote={(note) => setActiveStickyNote(note)}
                onCreateStickyNote={() => {
                  const newNote = addNote();
                  setActiveStickyNote(newNote);
                }}
                onOpenTaskDetail={(task) => setDialogTask(task)}
                onToggleTask={toggleTask}
                onMoveTask={moveTaskOrder}
              />
            </ErrorBoundary>
          )}

          <footer className="content-footer">
            <span>
              <span className={`footer-dot ${cloudState}`} />
              {cloudState === "synced"
                ? "Semua perubahan tersimpan di cloud"
                : cloudState === "syncing"
                  ? "Menyinkronkan perubahan..."
                  : cloudState === "error"
                    ? "Ada perubahan yang perlu disinkronkan"
                    : "Menghubungkan ke cloud..."}
            </span>
            {preferences.showMotto && <span>Pelan-pelan juga sampai.</span>}
          </footer>
        </div>
      </main>

      {/* Contextual Mobile FAB */}
      {activeWorkspace !== "admin" && (
        <button
          type="button"
          className="mobile-fab"
          aria-label={
            activeWorkspace === "finance"
              ? "Catat Transaksi"
              : "Tambah Tugas Baru"
          }
          onClick={() => {
            if (activeWorkspace === "finance") {
              window.dispatchEvent(new CustomEvent("ruang:finance-new-tx"));
            } else {
              setDialogTask(null);
            }
          }}
        >
          <Plus size={22} />
        </button>
      )}

      {/* Task Details Modal (Full Form) */}
      {dialogTask !== undefined && (
        <TaskDialog
          task={dialogTask}
          taskCategories={parameters.taskCategories}
          lockedCategory={
            activeWorkspace === "tasks" && dashboardCategoryFilter !== "all"
              ? dashboardCategoryFilter
              : null
          }
          onClose={() => setDialogTask(undefined)}
          onSave={(draft) => saveTask(draft, dialogTask ?? undefined)}
          onDelete={() =>
            dialogTask ? removeTask(dialogTask) : Promise.resolve()
          }
        />
      )}

      {/* Draggable & Minimizable Sticky Note Modal (Pure Note, No Progress) */}
      {activeStickyNote && (
        <DraggableNoteModal
          key={activeStickyNote.id}
          note={{
            id: activeStickyNote.id,
            title: activeStickyNote.title,
            content: activeStickyNote.content,
            color: activeStickyNote.color,
            pinned: activeStickyNote.pinned,
          }}
          onClose={() => setActiveStickyNote(null)}
          onSave={(updates) => {
            updateNote(activeStickyNote.id, updates);
            setActiveStickyNote((prev) =>
              prev ? { ...prev, ...updates } : null
            );
          }}
          onDelete={() => {
            deleteNote(activeStickyNote.id);
            setActiveStickyNote(null);
          }}
        />
      )}

      {/* In-Dashboard Action Card Pop-up (Draggable & Minimizable) */}
      {actionModal.type && (
        <ActionListModal
          key={`${actionModal.type}-${actionModal.categoryName ?? ""}-${actionModal.dateKey ?? ""}`}
          isOpen={true}
          taskCategories={parameters.taskCategories}
          taskLayout={preferences.layout}
          title={
            actionModal.type === "today"
              ? actionModal.categoryName
                ? `Tugas Hari Ini (${actionModal.categoryName})`
                : "Tugas Hari Ini"
              : actionModal.type === "overdue"
                ? actionModal.categoryName
                  ? `Tugas Terlambat (${actionModal.categoryName})`
                  : "Tugas Terlambat"
                : actionModal.type === "active"
                  ? actionModal.categoryName
                    ? `Tugas Aktif (${actionModal.categoryName})`
                    : "Semua Tugas Aktif"
                  : actionModal.type === "completed"
                    ? actionModal.categoryName
                      ? `Tugas Selesai (${actionModal.categoryName})`
                      : "Tugas Terselesaikan"
                    : actionModal.type === "date"
                      ? `Tugas Tanggal ${actionModal.dateKey ? formatDueDate(actionModal.dateKey) : ""}`
                      : `Kategori: ${actionModal.categoryName}`
          }
          subtitle={
            actionModal.type === "today"
              ? `Fokus selesaikan tugas ${actionModal.categoryName ? `(${actionModal.categoryName}) ` : ""}dengan tenggat hari ini`
              : actionModal.type === "overdue"
                ? `Tugas aktif yang melewati tenggat waktu${actionModal.categoryName ? ` (${actionModal.categoryName})` : ""}`
                : actionModal.type === "active"
                  ? `Kumpulan seluruh tugas yang sedang berjalan ${actionModal.categoryName ? `kategori ${actionModal.categoryName}` : ""}`
                  : actionModal.type === "completed"
                    ? `Riwayat tugas ${actionModal.categoryName ? `kategori ${actionModal.categoryName} ` : ""}yang telah berhasil kamu selesaikan`
                    : actionModal.type === "date"
                      ? `Semua tugas pada ${actionModal.dateKey ?? ""} (lintas semua kategori)`
                      : `Semua tugas dalam daftar ${actionModal.categoryName}`
          }
          icon={
            actionModal.type === "today"
              ? Sun
              : actionModal.type === "overdue"
                ? AlertTriangle
                : actionModal.type === "active"
                  ? Layers
                  : actionModal.type === "completed"
                    ? CheckCircle2
                    : Folder
          }
          defaultCategory={
            actionModal.categoryName || parameters.taskCategories[0] || "Work"
          }
          isCategoryLocked={Boolean(actionModal.categoryName)}
          onMoveTask={
            actionModal.type === "completed" ? undefined : moveTaskOrder
          }
          tasks={
            actionModal.type === "today"
              ? orderedTasks.filter(
                  (t) =>
                    !t.completed &&
                    t.dueDate === today &&
                    (!actionModal.categoryName ||
                      t.category === actionModal.categoryName)
                )
              : actionModal.type === "overdue"
                ? orderedTasks.filter(
                    (t) =>
                      !t.completed &&
                      Boolean(t.dueDate && t.dueDate < today) &&
                      (!actionModal.categoryName ||
                        t.category === actionModal.categoryName)
                  )
                : actionModal.type === "active"
                  ? orderedTasks.filter(
                      (t) =>
                        !t.completed &&
                        (!actionModal.categoryName ||
                          t.category === actionModal.categoryName)
                    )
                  : actionModal.type === "date"
                    ? orderedTasks.filter(
                        (t) => t.dueDate === actionModal.dateKey
                      )
                    : actionModal.type === "completed"
                      ? orderedTasks.filter(
                          (t) =>
                            t.completed &&
                            (!actionModal.categoryName ||
                              t.category === actionModal.categoryName)
                        )
                      : orderedTasks.filter(
                          (t) => t.category === actionModal.categoryName
                        )
          }
          onToggleTask={toggleTask}
          onOpenTaskDetail={(task) => setDialogTask(task)}
          onAddTask={
            actionModal.type !== "completed" && actionModal.type !== "overdue"
              ? async (title, selectedCategory) => {
                  const dueDate = actionModal.type === "today" ? today : "";
                  const category =
                    selectedCategory ||
                    actionModal.categoryName ||
                    parameters.taskCategories[0] ||
                    "Work";
                  await saveTask({
                    ...emptyDraft,
                    title,
                    dueDate,
                    category,
                  });
                }
              : undefined
          }
          onClose={() => setActionModal({ type: null })}
        />
      )}

      {/* Theme & Layout Dashboard Menu */}
      <ThemeDashboardMenu
        isOpen={isThemeMenuOpen}
        onClose={() => setIsThemeMenuOpen(false)}
        preferences={preferences}
        onSelectTheme={setTheme}
        onSelectLayout={setLayout}
        onToggleMotto={toggleMotto}
        onReset={resetPreferences}
      />

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={showLogoutConfirm}
        userEmail={user.email ?? undefined}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={handleConfirmLogout}
        isLoggingOut={isLoggingOut}
      />
    </div>
  );
}

export default App;
