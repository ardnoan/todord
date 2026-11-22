import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import {
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
  SlidersHorizontal,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./supabase";
import type { Database, Json, Priority, StickyNote as StickyNoteType, Subtask, Task, TaskDraft } from "./types";
import { useThemePreferences } from "./hooks/useThemePreferences";
import { useStickyNotes } from "./hooks/useStickyNotes";
import { ThemeDashboardMenu } from "./components/ThemeDashboardMenu";
import { DraggableNoteModal } from "./components/DraggableNoteModal";
import { ActionListModal } from "./components/ActionListModal";
import { LogoutConfirmModal } from "./components/LogoutConfirmModal";
import { EmailVerificationView } from "./components/EmailVerificationView";
import { DashboardView } from "./components/DashboardView";

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

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseSubtasks(value: Json): Subtask[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        if (!("id" in item) || !("title" in item) || !("completed" in item)) return [];
        if (typeof item.id !== "string" || typeof item.title !== "string") return [];
        return [{ id: item.id, title: item.title, completed: item.completed === true }];
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
  const today = localDateString(new Date());
  if (value === today) return "Hari ini";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (value === localDateString(tomorrow)) return "Besok";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function SupabaseSetup() {
  return (
    <main className="setup-screen">
      <div className="setup-card">
        <div className="brand-mark"><CheckCheck size={24} /></div>
        <span className="eyebrow">RUANG · SETUP</span>
        <h1>Hubungkan ruang kerjamu.</h1>
        <p>Tambahkan URL dan public key Supabase agar akun dan tugasmu tersimpan serta tersinkron di cloud.</p>
        <div className="setup-steps">
          <div><span>01</span><p>Buat proyek Supabase dan salin <strong>Project URL</strong> serta anon/publishable key.</p></div>
          <div><span>02</span><p>Jalankan <code>supabase/schema.sql</code> di SQL Editor untuk membuat tabel, keamanan RLS, dan realtime.</p></div>
          <div><span>03</span><p>Isi <code>.env</code> dengan <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_ANON_KEY</code>.</p></div>
        </div>
        <a className="setup-link" href="https://supabase.com/dashboard/" target="_blank" rel="noreferrer">
          Buka Supabase Dashboard <ArrowRight size={16} />
        </a>
        <p className="setup-footnote">Jangan pernah memasukkan service_role key ke aplikasi web.</p>
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
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);

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
      if (message.includes("already registered") || message.includes("already been registered")) {
        setError("Email ini sudah terdaftar.");
      } else if (message.includes("Invalid login credentials")) {
        setError("Email atau kata sandi tidak cocok.");
      } else if (message.includes("Password should be at least")) {
        setError("Gunakan kata sandi minimal 6 karakter.");
      } else {
        setError("Tidak dapat memproses akun. Periksa koneksi dan pengaturan Supabase.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-aside">
        <div className="brand"><span className="brand-mark"><CheckCheck size={20} /></span><span>ruang<span className="brand-period">.</span></span></div>
        <div className="auth-quote">
          <span className="eyebrow">RUANG UNTUK FOKUS</span>
          <h1>Satu hal dalam satu waktu.</h1>
          <p>Rencanakan dengan jernih. Selesaikan dengan tenang.</p>
          <div className="quote-decoration"><span /><span /><span /><span /><span /></div>
        </div>
        <span className="auth-copyright">Dirancang untuk hari yang lebih ringan.</span>
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
              <div className="auth-mobile-brand"><span className="brand-mark"><CheckCheck size={20} /></span> ruang.</div>
              <span className="eyebrow">{isRegister ? "MULAI DENGAN LANGKAH KECIL" : "SENANG BERTEMU LAGI"}</span>
              <h2>{isRegister ? "Buat akunmu" : "Selamat datang kembali"}</h2>
              <p className="auth-description">{isRegister ? "Semua rencanamu tersimpan aman dan tersinkron." : "Masuk untuk melanjutkan rencanamu."}</p>
              {error && <div className="error-banner" role="alert">{error}</div>}
              {notice && <div className="success-banner" role="status">{notice}</div>}
              <label htmlFor="email">Email</label>
              <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" required />
              <label htmlFor="password">Kata sandi</label>
              <input id="password" type="password" autoComplete={isRegister ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimal 6 karakter" minLength={6} required />
              <button className="button-primary auth-submit" type="submit" disabled={busy}>
                {busy ? "Memproses..." : isRegister ? "Buat akun" : "Masuk"}
                {!busy && <ArrowRight size={17} />}
              </button>
              <p className="auth-toggle">
                {isRegister ? "Sudah punya akun?" : "Belum punya akun?"}{" "}
                <button type="button" onClick={() => { setIsRegister(!isRegister); setError(""); }}>
                  {isRegister ? "Masuk" : "Daftar gratis"}
                </button>
              </p>
              <div className="auth-security"><LockKeyhole size={14} /> Data tugas tersimpan privat di akunmu.</div>
            </motion.form>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}

function TaskDialog({
  task,
  onClose,
  onSave,
  onDelete,
}: {
  task: Task | null;
  onClose: () => void;
  onSave: (draft: TaskDraft) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<TaskDraft>(task ? {
    title: task.title,
    notes: task.notes,
    dueDate: task.dueDate,
    category: task.category,
    priority: task.priority,
    completed: task.completed,
    subtasks: task.subtasks,
    color: task.color,
  } : emptyDraft);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  function addSubtask() {
    const title = subtaskTitle.trim();
    if (!title) return;
    setDraft((current) => ({
      ...current,
      subtasks: [...current.subtasks, { id: crypto.randomUUID(), title, completed: false }],
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
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.form
        className="task-modal"
        onSubmit={submit}
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", stiffness: 420, damping: 30 }}
      >
        <div className="modal-heading">
          <div><span className="eyebrow">{task ? "DETAIL TUGAS" : "TUGAS BARU"}</span><h2>{task ? "Atur detailnya." : "Apa yang ingin kamu selesaikan?"}</h2></div>
          <button className="icon-button" type="button" aria-label="Tutup" onClick={onClose}><X size={19} /></button>
        </div>
        {error && <div className="error-banner" role="alert">{error}</div>}
        <label className="field-label" htmlFor="task-title">Nama tugas</label>
        <input id="task-title" className="task-title-input" autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Contoh: Rapikan presentasi" required />
        <label className="field-label" htmlFor="task-notes">Catatan <span>OPSIONAL</span></label>
        <textarea id="task-notes" rows={2} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Tambahkan konteks kecil..." />
        <div className="form-grid">
          <div><label className="field-label" htmlFor="task-date">Tanggal</label><input id="task-date" type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} /></div>
          <div><label className="field-label" htmlFor="task-category">Daftar</label><select id="task-category" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></div>
        </div>
        <label className="field-label" htmlFor="task-priority">Prioritas</label>
        <select id="task-priority" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as Priority })}>
          <option value="low">Rendah</option><option value="medium">Sedang</option><option value="high">Tinggi</option>
        </select>
        <div className="subtasks-editor">
          <label className="field-label">Langkah kecil <span>{draft.subtasks.length ? `${draft.subtasks.length} LANGKAH` : "OPSIONAL"}</span></label>
          {draft.subtasks.map((subtask) => (
            <div className="subtask-edit-row" key={subtask.id}>
              <button type="button" className={`subtask-check ${subtask.completed ? "checked" : ""}`} aria-label={subtask.completed ? "Tandai belum selesai" : "Tandai selesai"} onClick={() => setDraft({ ...draft, subtasks: draft.subtasks.map((item) => item.id === subtask.id ? { ...item, completed: !item.completed } : item) })}>{subtask.completed && <Check size={12} />}</button>
              <span className={subtask.completed ? "subtask-done" : ""}>{subtask.title}</span>
              <button type="button" className="subtask-remove" aria-label={`Hapus ${subtask.title}`} onClick={() => setDraft({ ...draft, subtasks: draft.subtasks.filter((item) => item.id !== subtask.id) })}><X size={14} /></button>
            </div>
          ))}
          <div className="subtask-add"><input value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSubtask(); } }} placeholder="Tambah langkah..." /><button type="button" onClick={addSubtask} aria-label="Tambah langkah"><Plus size={16} /></button></div>
        </div>
        <div className="modal-actions">{task && <button type="button" className="button-delete" onClick={deleteTask} disabled={deleting}><Trash2 size={14} />{deleting ? "Menghapus..." : "Hapus"}</button>}<button type="button" className="button-quiet" onClick={onClose}>Batal</button><button type="submit" className="button-primary" disabled={busy || deleting}>{busy ? "Menyimpan..." : task ? "Simpan perubahan" : "Buat tugas"} <ArrowRight size={16} /></button></div>
      </motion.form>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [cloudState, setCloudState] = useState<CloudState>("connecting");
  const [syncError, setSyncError] = useState("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [dialogTask, setDialogTask] = useState<Task | null | undefined>(undefined);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Theme Preferences & Menu
  const {
    preferences,
    setTheme,
    setLayout,
    toggleStats,
    toggleWeekStrip,
    toggleMotto,
    resetPreferences,
  } = useThemePreferences();
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

  // Pure Sticky Notes (Separated from Task Progress)
  const {
    notes: stickyNotes,
    addNote,
    updateNote,
    deleteNote,
  } = useStickyNotes();
  const [activeStickyNote, setActiveStickyNote] = useState<StickyNoteType | null>(null);

  // In-Dashboard Action Pop-up Modal (Draggable & Minimizable)
  const [actionModal, setActionModal] = useState<{
    type: "today" | "active" | "completed" | "category" | null;
    categoryName?: string;
  }>({ type: null });

  // Logout Confirmation Modal
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
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
    if (!user || !supabase) {
      setTasks([]);
      return;
    }
    const currentUser = user;
    const client = supabase;
    let active = true;
    setCloudState("connecting");
    setSyncError("");
    async function loadTasks() {
      const { data, error } = await client
        .from("tasks")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) {
        setCloudState("error");
        setSyncError("Tidak dapat memuat tugas. Periksa koneksi atau kebijakan RLS Supabase.");
        return;
      }
      setTasks(data.map(parseTask));
      setSyncError("");
      setCloudState("synced");
    }

    void loadTasks();
    const channel = client
      .channel(`tasks:${currentUser.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "tasks",
        filter: `user_id=eq.${currentUser.id}`,
      }, () => {
        if (!active) return;
        setCloudState("syncing");
        void loadTasks();
      })
      .subscribe((status) => {
        if (!active) return;
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setCloudState("error");
          setSyncError("Live sync gagal. Pastikan Realtime aktif untuk tabel tasks.");
        }
      });

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [user]);

  const today = localDateString(new Date());

  const filteredTasks = useMemo(() => {
    let result = tasks;
    const normalizedSearch = search.trim().toLocaleLowerCase("id");
    if (normalizedSearch) {
      result = result.filter((task) =>
        `${task.title} ${task.notes} ${task.category}`.toLocaleLowerCase("id").includes(normalizedSearch),
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
      setSyncError("Tugas belum tersimpan. Periksa koneksi atau kebijakan RLS Supabase.");
      throw error;
    }
  }

  async function toggleTask(task: Task) {
    if (!supabase || !user) return;
    setCloudState("syncing");
    try {
      const nextCompleted = !task.completed;
      // Optimistic update
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, completed: nextCompleted } : t));

      const { data, error } = await supabase
        .from("tasks")
        .update({ completed: nextCompleted })
        .eq("id", task.id)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Tugas tidak ditemukan atau akses ditolak.");
    } catch {
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
    } catch (error) {
      setCloudState("error");
      setSyncError("Tugas belum terhapus. Periksa koneksi atau kebijakan RLS Supabase.");
      throw error;
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
  if (!authReady) return <div className="app-loading"><span className="loader" /> Menyiapkan ruang...</div>;
  if (!user) return <AuthScreen />;

  const greetingName = user.email?.split("@")[0] ?? "Kamu";

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

            {/* Quick Search */}
            <label className={`search-box ${searchOpen ? "mobile-open" : ""}`}>
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
              <div
                className="header-profile-chip"
                title={`Akun: ${user.email}`}
              >
                <span className="header-avatar">
                  {greetingName.charAt(0).toUpperCase()}
                </span>
                <span className="header-user-name">{greetingName}</span>
              </div>
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

          {search.trim() ? (
            <section className="search-results-section">
              <div className="search-results-header">
                <div>
                  <h2>Hasil Pencarian</h2>
                  <p>
                    Ditemukan {filteredTasks.length} tugas untuk &ldquo;{search}&rdquo;
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
                          aria-label={task.completed ? "Tandai belum selesai" : "Tandai selesai"}
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
                            <span className={`task-date ${task.dueDate && task.dueDate < today && !task.completed ? "overdue" : ""}`}>
                              <Clock3 size={12} />{formatDueDate(task.dueDate)}
                            </span>
                            <span className={`task-category cat-${categories.indexOf(task.category) >= 0 ? categories.indexOf(task.category) : 0}`}>
                              <i />{task.category}
                            </span>
                            {task.priority === "high" && <span className="priority-label">Prioritas tinggi</span>}
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
                  <div className="empty-icon"><Search size={24} /></div>
                  <h3>Tidak ada tugas yang cocok.</h3>
                  <p>Coba kata kunci lain atau hapus pencarian untuk kembali ke dashboard.</p>
                </div>
              )}
            </section>
          ) : (
            <DashboardView
              tasks={tasks}
              stickyNotes={stickyNotes}
              userName={greetingName}
              onOpenActionModal={(type, cat) => {
                setActionModal({ type, categoryName: cat });
              }}
              onOpenStickyNote={(note) => setActiveStickyNote(note)}
              onCreateStickyNote={() => {
                const newNote = addNote();
                setActiveStickyNote(newNote);
              }}
              onOpenTaskDetail={(task) => setDialogTask(task)}
              onToggleTask={toggleTask}
            />
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

      {/* Task Details Modal (Full Form) */}
      {dialogTask !== undefined && (
        <TaskDialog
          task={dialogTask}
          onClose={() => setDialogTask(undefined)}
          onSave={(draft) => saveTask(draft, dialogTask ?? undefined)}
          onDelete={() => dialogTask ? removeTask(dialogTask) : Promise.resolve()}
        />
      )}

      {/* Draggable & Minimizable Sticky Note Modal (Pure Note, No Progress) */}
      {activeStickyNote && (
        <DraggableNoteModal
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
            setActiveStickyNote((prev) => (prev ? { ...prev, ...updates } : null));
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
          isOpen={true}
          title={
            actionModal.type === "today"
              ? actionModal.categoryName
                ? `Tugas Hari Ini (${actionModal.categoryName})`
                : "Tugas Hari Ini"
              : actionModal.type === "active"
              ? actionModal.categoryName
                ? `Tugas Aktif (${actionModal.categoryName})`
                : "Semua Tugas Aktif"
              : actionModal.type === "completed"
              ? actionModal.categoryName
                ? `Tugas Selesai (${actionModal.categoryName})`
                : "Tugas Terselesaikan"
              : `Kategori: ${actionModal.categoryName}`
          }
          subtitle={
            actionModal.type === "today"
              ? `Fokus selesaikan tugas ${actionModal.categoryName ? `(${actionModal.categoryName}) ` : ""}dengan tenggat hari ini`
              : actionModal.type === "active"
              ? `Kumpulan seluruh tugas yang sedang berjalan ${actionModal.categoryName ? `kategori ${actionModal.categoryName}` : ""}`
              : actionModal.type === "completed"
              ? `Riwayat tugas ${actionModal.categoryName ? `kategori ${actionModal.categoryName} ` : ""}yang telah berhasil kamu selesaikan`
              : `Semua tugas dalam daftar ${actionModal.categoryName}`
          }
          icon={
            actionModal.type === "today"
              ? Sun
              : actionModal.type === "active"
              ? Layers
              : actionModal.type === "completed"
              ? CheckCircle2
              : Folder
          }
          defaultCategory={actionModal.categoryName || "Work"}
          tasks={
            actionModal.type === "today"
              ? tasks.filter(
                  (t) =>
                    !t.completed &&
                    t.dueDate === today &&
                    (!actionModal.categoryName || t.category === actionModal.categoryName)
                )
              : actionModal.type === "active"
              ? tasks.filter(
                  (t) =>
                    !t.completed &&
                    (!actionModal.categoryName || t.category === actionModal.categoryName)
                )
              : actionModal.type === "completed"
              ? tasks.filter(
                  (t) =>
                    t.completed &&
                    (!actionModal.categoryName || t.category === actionModal.categoryName)
                )
              : tasks.filter(
                  (t) =>
                    !t.completed && t.category === actionModal.categoryName
                )
          }
          onToggleTask={toggleTask}
          onOpenTaskDetail={(task) => setDialogTask(task)}
          onAddTask={
            actionModal.type !== "completed"
              ? async (title, selectedCategory) => {
                  const dueDate = actionModal.type === "today" ? today : "";
                  const category = selectedCategory || actionModal.categoryName || "Work";
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
        onToggleStats={toggleStats}
        onToggleWeekStrip={toggleWeekStrip}
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
