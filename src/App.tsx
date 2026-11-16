import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import {
  ArrowDownWideNarrow,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Cloud,
  Folder,
  Inbox,
  ListTodo,
  LockKeyhole,
  LogOut,
  Plus,
  Search,
  Sparkles,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./supabase";
import type { Database, Json, Priority, Subtask, Task, TaskDraft } from "./types";

type View = "today" | "upcoming" | "inbox" | "completed";
type CloudState = "connecting" | "synced" | "syncing" | "error";
type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

const categories = ["Personal", "Work", "Study"];
const views: { id: View; label: string; icon: typeof Sun }[] = [
  { id: "today", label: "Hari ini", icon: Sun },
  { id: "upcoming", label: "Mendatang", icon: Clock3 },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "completed", label: "Selesai", icon: CheckCircle2 },
];

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

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localDateString(date);
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
        if (!data.session) {
          setIsRegister(false);
          setNotice("Akun dibuat. Periksa email untuk konfirmasi sebelum masuk.");
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
        <form className="auth-form" onSubmit={submit}>
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
        </form>
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
      <form className="task-modal" onSubmit={submit}>
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
      </form>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [cloudState, setCloudState] = useState<CloudState>("connecting");
  const [syncError, setSyncError] = useState("");
  const [view, setView] = useState<View>("today");
  const [selectedDate, setSelectedDate] = useState(localDateString(new Date()));
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [dialogTask, setDialogTask] = useState<Task | null | undefined>(undefined);
  const [quickTitle, setQuickTitle] = useState("");
  const [sortByPriority, setSortByPriority] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    setTasksLoading(true);
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
        setTasksLoading(false);
        setCloudState("error");
        setSyncError("Tidak dapat memuat tugas. Periksa koneksi atau kebijakan RLS Supabase.");
        return;
      }
      setTasks(data.map(parseTask));
      setTasksLoading(false);
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
  const todayCount = tasks.filter((task) => !task.completed && task.dueDate === today).length;
  const completedCount = tasks.filter((task) => task.completed).length;
  const selectedDateCount = tasks.filter((task) => !task.completed && task.dueDate === selectedDate).length;
  const weekDays = useMemo(() => {
    const start = new Date(`${selectedDate}T00:00:00`);
    const day = start.getDay();
    start.setDate(start.getDate() - ((day + 6) % 7));
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [selectedDate]);

  const filteredTasks = useMemo(() => {
    let result = tasks.filter((task) => {
      if (view === "completed") return task.completed;
      if (task.completed) return false;
      if (categoryFilter && task.category !== categoryFilter) return false;
      if (view === "today") return task.dueDate === selectedDate;
      if (view === "upcoming") return task.dueDate >= today;
      return true;
    });
    const normalizedSearch = search.trim().toLocaleLowerCase("id");
    if (normalizedSearch) {
      result = result.filter((task) =>
        `${task.title} ${task.notes} ${task.category}`.toLocaleLowerCase("id").includes(normalizedSearch),
      );
    }
    if (sortByPriority) {
      const score: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
      result = [...result].sort((a, b) => score[a.priority] - score[b.priority]);
    }
    return result;
  }, [tasks, view, selectedDate, today, categoryFilter, search, sortByPriority]);

  const title = view === "today"
    ? selectedDate === today ? "Hari ini, milikmu." : new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${selectedDate}T00:00:00`))
    : view === "upcoming" ? "Pelan-pelan, ke depan."
      : view === "inbox" ? "Semua ada tempatnya."
        : "Lihat yang sudah selesai.";
  const subtitle = view === "today"
    ? selectedDateCount ? `Ada ${selectedDateCount} hal yang menunggu perhatianmu.` : "Ruang yang cukup untuk memulai sesuatu."
    : view === "upcoming" ? "Rencana mendatang, tersusun dengan tenang."
      : view === "inbox" ? "Keluarkan dari kepala, simpan di sini."
        : "Setiap langkah kecil tetap berarti.";

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
        const { error } = await supabase
          .from("tasks")
          .insert({ ...payload, user_id: user.id })
          .select("id")
          .single();
        if (error) throw error;
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
      const { data, error } = await supabase
        .from("tasks")
        .update({ completed: !task.completed })
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

  async function toggleSubtask(task: Task, subtask: Subtask) {
    if (!supabase || !user) return;
    setCloudState("syncing");
    try {
      const { data, error } = await supabase
        .from("tasks")
        .update({
        subtasks: task.subtasks.map((item) => item.id === subtask.id ? { ...item, completed: !item.completed } : item),
        })
        .eq("id", task.id)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Tugas tidak ditemukan atau akses ditolak.");
    } catch {
      setCloudState("error");
      setSyncError("Perubahan langkah belum tersimpan. Coba lagi.");
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
    } catch (error) {
      setCloudState("error");
      setSyncError("Tugas belum terhapus. Periksa koneksi atau kebijakan RLS Supabase.");
      throw error;
    }
  }

  async function logOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setCloudState("error");
      setSyncError("Tidak dapat keluar dari akun. Coba lagi.");
    }
  }

  async function addQuickTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = quickTitle.trim();
    if (!title) return;
    const dateInTitle = title.match(/\b(?:hari ini|besok)\b/i)?.[0].toLocaleLowerCase("id");
    const dueDate = dateInTitle === "hari ini"
      ? today
      : dateInTitle === "besok"
        ? localDateString(new Date(Date.now() + 86400000))
        : "";
    const cleanTitle = title.replace(/\b(?:hari ini|besok)\b/i, "").trim();
    try {
      await saveTask({ ...emptyDraft, title: cleanTitle || title, dueDate });
      setQuickTitle("");
    } catch {
      setCloudState("error");
      setSyncError("Tugas belum tersimpan. Periksa koneksi lalu coba lagi.");
    }
  }

  if (!isSupabaseConfigured) return <SupabaseSetup />;
  if (!authReady) return <div className="app-loading"><span className="loader" /> Menyiapkan ruang...</div>;
  if (!user) return <AuthScreen />;

  const greetingName = user.email?.split("@")[0] ?? "Kamu";
  const selectedLabel = views.find((item) => item.id === view)?.label ?? "Tugas";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><CheckCheck size={19} /></span><span>ruang<span className="brand-period">.</span></span></div>
        <button className="profile-chip" type="button" onClick={() => { void logOut(); }}>
          <span className="avatar">{greetingName.charAt(0).toUpperCase()}</span>
          <span className="profile-copy"><strong>{greetingName}</strong><small>Ruang pribadimu</small></span>
          <LogOut size={15} className="profile-logout" />
        </button>
        <div className="sidebar-section">
          <span className="sidebar-label">RUANG KERJA</span>
          <nav className="nav-list" aria-label="Navigasi tugas">
            {views.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" className={`nav-item ${view === id && !categoryFilter ? "active" : ""}`} onClick={() => { setView(id); setCategoryFilter(""); }}>
                <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
                {id === "today" && todayCount > 0 && <span className="nav-count">{todayCount}</span>}
                {id === "completed" && completedCount > 0 && <span className="nav-count">{completedCount}</span>}
              </button>
            ))}
          </nav>
        </div>
        <div className="sidebar-section categories-section">
          <div className="sidebar-label-row"><span className="sidebar-label">DAFTAR</span></div>
          {categories.map((category, index) => (
            <button type="button" key={category} className={`category-item ${categoryFilter === category ? "active" : ""}`} onClick={() => { setCategoryFilter(categoryFilter === category ? "" : category); setView("inbox"); }}>
              <span className={`category-dot dot-${index}`} /><span>{category}</span><span className="category-count">{tasks.filter((task) => task.category === category && !task.completed).length}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className={`sync-status sync-${cloudState}`}><span className={`sync-dot ${cloudState}`} /><Cloud size={14} /><span>{cloudState === "synced" ? "Tersinkron ke cloud" : cloudState === "syncing" ? "Menyinkronkan..." : cloudState === "error" ? "Sync bermasalah" : "Menghubungkan..."}</span></div>
          <div className="sidebar-motto">Beri ruang untuk<br /><em>hal yang penting.</em></div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="breadcrumb"><span>Ruang kerja</span><span className="breadcrumb-slash">/</span><strong>{categoryFilter || selectedLabel}</strong></div>
          <div className="topbar-actions">
            <label className={`search-box ${searchOpen ? "mobile-open" : ""}`}><Search size={16} /><input ref={searchInputRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari tugas..." /><kbd>⌘ K</kbd>{searchOpen && <button type="button" className="search-close" onClick={() => { setSearchOpen(false); setSearch(""); }} aria-label="Tutup pencarian"><X size={15} /></button>}</label>
            <button type="button" className="mobile-search-trigger" aria-label="Cari tugas" onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 0); }}><Search size={17} /></button>
            <span className="date-stamp">{new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short" }).format(new Date())}</span>
          </div>
        </header>

        <div className="content-scroll">
          {syncError && <div className="sync-error" role="alert"><Cloud size={16} />{syncError}<button type="button" aria-label="Tutup pesan" onClick={() => setSyncError("")}><X size={15} /></button></div>}
          <section className="welcome-row">
            <div><span className="eyebrow">{new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long" }).format(new Date()).toUpperCase()}</span><h1>{title}</h1><p>{subtitle}</p></div>
            <div className="welcome-illustration" aria-hidden="true"><div className="sun-disc" /><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="sparkle sparkle-one">✳</span><span className="sparkle sparkle-two">✦</span></div>
          </section>

          <section className="stats-row" aria-label="Ringkasan progres">
            <div className="stat-card stat-focus"><span className="stat-icon"><Sparkles size={16} /></span><span className="stat-label">FOKUS HARI INI</span><strong>{todayCount}<small> tugas</small></strong><div className="stat-note">{todayCount ? "Satu langkah pada satu waktu" : "Hari ini masih terbuka"}</div></div>
            <div className="stat-card"><span className="stat-icon stat-icon-green"><CheckCircle2 size={16} /></span><span className="stat-label">SUDAH SELESAI</span><strong>{completedCount}<small> tugas</small></strong><div className="stat-note">Setiap progres itu berarti</div></div>
            <div className="stat-card"><span className="stat-icon stat-icon-amber"><Folder size={16} /></span><span className="stat-label">DAFTAR AKTIF</span><strong>{new Set(tasks.filter((task) => !task.completed).map((task) => task.category)).size}<small> daftar</small></strong><div className="stat-note">Semua tertata di satu tempat</div></div>
          </section>

          {view === "today" && (
            <section className="week-strip" aria-label="Pilih tanggal">
              <div className="week-heading"><div><span className="eyebrow">RENCANAKAN HARI</span><strong>{new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(weekDays[3])}</strong></div><div className="week-controls"><button type="button" aria-label="Minggu sebelumnya" onClick={() => setSelectedDate(shiftDate(selectedDate, -7))}><ArrowLeft size={15} /></button><button type="button" aria-label="Minggu berikutnya" onClick={() => setSelectedDate(shiftDate(selectedDate, 7))}><ArrowRight size={15} /></button></div></div>
              <div className="week-days">{weekDays.map((date) => {
                const dayKey = localDateString(date);
                const count = tasks.filter((task) => task.dueDate === dayKey && !task.completed).length;
                return <button type="button" key={dayKey} className={`week-day ${selectedDate === dayKey ? "selected" : ""} ${today === dayKey ? "is-today" : ""}`} onClick={() => setSelectedDate(dayKey)}><span>{new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(date)}</span><strong>{date.getDate()}</strong><i className={count ? "has-tasks" : ""} /></button>;
              })}</div>
            </section>
          )}

          <section className="task-section">
            <div className="task-section-heading">
              <div><h2>{categoryFilter || (view === "today" ? "Rencana hari ini" : view === "upcoming" ? "Yang akan datang" : view === "completed" ? "Jejak langkahmu" : "Kotak masuk")}</h2><span>{filteredTasks.length} {filteredTasks.length === 1 ? "tugas" : "tugas"}</span></div>
              <button className={`sort-button ${sortByPriority ? "sort-active" : ""}`} type="button" onClick={() => setSortByPriority(!sortByPriority)}><ArrowDownWideNarrow size={15} />Prioritas<ChevronDown size={14} /></button>
            </div>

            {view !== "completed" && <form className="quick-add" onSubmit={addQuickTask}><span className="quick-add-icon"><Plus size={17} /></span><input aria-label="Tambah tugas cepat" value={quickTitle} onChange={(event) => setQuickTitle(event.target.value)} placeholder="Tambahkan satu hal yang ingin kamu selesaikan..." /><button type="button" className="quick-detail-button" onClick={() => setDialogTask(null)} title="Buka detail tugas">Detail</button><button className="quick-submit" type="submit" disabled={!quickTitle.trim()} aria-label="Simpan tugas cepat"><ArrowRight size={17} /></button></form>}

            {tasksLoading ? <div className="list-loading"><span className="loader" />Memuat tugas dari cloud...</div>
              : filteredTasks.length ? <div className="task-list">{filteredTasks.map((task) => (
                <article className={`task-row ${task.completed ? "task-completed" : ""}`} key={task.id}>
                  <button type="button" className={`task-check ${task.completed ? "checked" : ""}`} aria-label={task.completed ? "Tandai belum selesai" : "Tandai selesai"} onClick={() => toggleTask(task)}>{task.completed && <Check size={14} />}</button>
                  <button type="button" className="task-content" onClick={() => setDialogTask(task)}>
                    <span className="task-title">{task.title}</span>
                    {task.notes && <span className="task-notes">{task.notes}</span>}
                    <span className="task-meta"><span className={`task-date ${task.dueDate && task.dueDate < today && !task.completed ? "overdue" : ""}`}><Clock3 size={12} />{formatDueDate(task.dueDate)}</span><span className={`task-category cat-${categories.indexOf(task.category) >= 0 ? categories.indexOf(task.category) : 0}`}><i />{task.category}</span>{task.priority === "high" && <span className="priority-label">Prioritas tinggi</span>}{task.subtasks.length > 0 && <span className="subtask-count"><ListTodo size={12} />{task.subtasks.filter((item) => item.completed).length}/{task.subtasks.length}</span>}</span>
                  </button>
                  {task.subtasks.length > 0 && <div className="task-subtasks">{task.subtasks.slice(0, 3).map((subtask) => <button key={subtask.id} className={`task-subtask ${subtask.completed ? "subtask-done" : ""}`} type="button" onClick={() => toggleSubtask(task, subtask)}><span className={`mini-check ${subtask.completed ? "checked" : ""}`}>{subtask.completed && <Check size={9} />}</span>{subtask.title}</button>)}</div>}
                  <button className="task-edit" type="button" onClick={() => setDialogTask(task)} aria-label={`Edit ${task.title}`}><ArrowRight size={16} /></button>
                </article>
              ))}</div>
                : <div className="empty-state"><div className="empty-icon"><CheckCircle2 size={24} /></div><h3>{search ? "Tidak ada yang cocok." : view === "completed" ? "Ruang untuk hal berikutnya." : "Hari ini masih milikmu."}</h3><p>{search ? "Coba kata kunci lain atau hapus pencarian." : view === "completed" ? "Tugas yang selesai akan muncul di sini." : "Tambahkan tugas kecil pertama, atau nikmati ruang kosong ini."}</p>{!search && view !== "completed" && <button className="button-quiet" type="button" onClick={() => setDialogTask(null)}><Plus size={15} /> Buat tugas dengan detail</button>}</div>}
          </section>
          <footer className="content-footer"><span><span className={`footer-dot ${cloudState}`} />{cloudState === "synced" ? "Semua perubahan tersimpan di cloud" : cloudState === "syncing" ? "Menyinkronkan perubahan..." : cloudState === "error" ? "Ada perubahan yang perlu disinkronkan" : "Menghubungkan ke cloud..."}</span><span>Pelan-pelan juga sampai.</span></footer>
        </div>
      </main>

      {dialogTask !== undefined && <TaskDialog task={dialogTask} onClose={() => setDialogTask(undefined)} onSave={(draft) => saveTask(draft, dialogTask ?? undefined)} onDelete={() => dialogTask ? removeTask(dialogTask) : Promise.resolve()} />}
    </div>
  );
}

export default App;
