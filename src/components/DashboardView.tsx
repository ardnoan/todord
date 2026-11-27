import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  CheckCircle2,
  Clock3,
  Folder,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  Pin,
  Plus,
  StickyNote,
  Sun,
  Layers,
  Check,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Activity,
  Flame,
  Briefcase,
  User,
  GraduationCap,
  Filter,
  AlertTriangle,
} from "lucide-react";
import type { LayoutMode, StickyNote as StickyNoteType, Task } from "../types";
import { getLocalDateString } from "../lib/date";
import { useIsMobile } from "../hooks/useIsMobile";

interface DashboardViewProps {
  tasks: Task[];
  stickyNotes: StickyNoteType[];
  userName: string;
  taskCategories: string[];
  taskLayout: LayoutMode;
  categoryFilter: string;
  onCategoryFilterChange: (cat: string) => void;
  onCreateTask: () => void;
  onOpenActionModal: (
    type: "today" | "active" | "completed" | "overdue" | "category" | "date",
    categoryName?: string,
    dateKey?: string
  ) => void;
  onOpenStickyNote: (note: StickyNoteType) => void;
  onCreateStickyNote: () => void;
  onOpenTaskDetail: (task: Task) => void;
  onToggleTask: (task: Task) => Promise<void>;
  onMoveTask: (
    taskId: string,
    direction: "up" | "down",
    visibleIds: string[]
  ) => void;
}

const CATEGORY_COLOR_CYCLE = ["blue", "purple", "amber"] as const;

function getCategoryMeta(name: string, index: number) {
  const lower = name.toLowerCase();
  if (lower === "work") {
    return { label: "Pekerjaan", icon: Briefcase, colorKey: "blue" };
  }
  if (lower === "personal") {
    return { label: "Pribadi", icon: User, colorKey: "purple" };
  }
  if (lower === "study") {
    return {
      label: "Belajar & Kuliah",
      icon: GraduationCap,
      colorKey: "amber",
    };
  }
  return {
    label: "Kategori",
    icon: Folder,
    colorKey: CATEGORY_COLOR_CYCLE[index % CATEGORY_COLOR_CYCLE.length],
  };
}

export function DashboardView({
  tasks,
  stickyNotes,
  userName,
  taskCategories,
  taskLayout,
  categoryFilter,
  onCategoryFilterChange,
  onCreateTask,
  onOpenActionModal,
  onOpenStickyNote,
  onCreateStickyNote,
  onOpenTaskDetail,
  onToggleTask,
  onMoveTask,
}: DashboardViewProps) {
  // Pure task progress: Sticky notes are pure notes and do NOT count towards completion progress
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const activeTasks = tasks.filter((t) => !t.completed);
  const completionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const isMobile = useIsMobile();
  const todayStr = getLocalDateString();
  const todayTasks = activeTasks.filter((t) => t.dueDate === todayStr);

  // Category Quick Filter State is controlled by parent (App.tsx)
  const setCategoryFilter = onCategoryFilterChange;

  // Dynamic Progress calculations based on active category filter
  const currentTotalTasks =
    categoryFilter === "all"
      ? totalTasks
      : tasks.filter((t) => t.category === categoryFilter).length;

  const currentCompletedTasks =
    categoryFilter === "all"
      ? completedTasks
      : tasks.filter((t) => t.completed && t.category === categoryFilter)
          .length;

  const currentActiveTasks =
    categoryFilter === "all"
      ? activeTasks
      : activeTasks.filter((t) => t.category === categoryFilter);

  const currentCompletionRate =
    currentTotalTasks > 0
      ? Math.round((currentCompletedTasks / currentTotalTasks) * 100)
      : 0;

  const displayActiveTasks = useMemo(() => {
    if (categoryFilter === "all") return activeTasks;
    return activeTasks.filter((t) => t.category === categoryFilter);
  }, [activeTasks, categoryFilter]);

  const displayTodayTasks = useMemo(() => {
    return displayActiveTasks.filter((t) => t.dueDate === todayStr);
  }, [displayActiveTasks, todayStr]);

  const displayOverdueTasks = useMemo(() => {
    return displayActiveTasks.filter((t) =>
      Boolean(t.dueDate && t.dueDate < todayStr)
    );
  }, [displayActiveTasks, todayStr]);

  const displayCompletedTasks = useMemo(() => {
    if (categoryFilter === "all") return tasks.filter((t) => t.completed);
    return tasks.filter((t) => t.completed && t.category === categoryFilter);
  }, [tasks, categoryFilter]);

  const displayHighPriority = useMemo(() => {
    return displayActiveTasks.filter((t) => t.priority === "high");
  }, [displayActiveTasks]);

  // Dynamic Category Cluster Breakdown from configured taskCategories
  const categoryClusterStats = useMemo(() => {
    return taskCategories.map((catName, idx) => {
      const meta = getCategoryMeta(catName, idx);
      return {
        name: catName,
        label: meta.label,
        icon: meta.icon,
        colorKey: meta.colorKey,
        active: activeTasks.filter((t) => t.category === catName).length,
        today: activeTasks.filter(
          (t) => t.category === catName && t.dueDate === todayStr
        ).length,
        highPriority: activeTasks.filter(
          (t) => t.category === catName && t.priority === "high"
        ).length,
        completed: tasks.filter((t) => t.category === catName && t.completed)
          .length,
        total: tasks.filter((t) => t.category === catName).length,
      };
    });
  }, [taskCategories, tasks, activeTasks, todayStr]);

  // ─── Calendar Widget State ───
  const [calMonth, setCalMonth] = useState(() => new Date());
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const calendarData = useMemo(() => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    // Monday=0 ... Sunday=6
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    // Build task count map for this month
    const taskCountMap: Record<string, { total: number; completed: number }> =
      {};
    tasks.forEach((t) => {
      if (!t.dueDate) return;
      const [ty, tm] = t.dueDate.split("-").map(Number);
      if (ty === year && tm === month + 1) {
        if (!taskCountMap[t.dueDate])
          taskCountMap[t.dueDate] = { total: 0, completed: 0 };
        taskCountMap[t.dueDate].total++;
        if (t.completed) taskCountMap[t.dueDate].completed++;
      }
    });

    const cells: Array<{
      day: number;
      dateKey: string;
      isToday: boolean;
      total: number;
      completed: number;
    } | null> = [];
    // Leading empty cells
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const counts = taskCountMap[dateKey] || { total: 0, completed: 0 };
      cells.push({
        day: d,
        dateKey,
        isToday: dateKey === todayStr,
        total: counts.total,
        completed: counts.completed,
      });
    }
    return cells;
  }, [calMonth, tasks, todayStr]);

  const calMonthLabel = calMonth.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  const prevMonth = () =>
    setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () =>
    setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  // ─── Activity Heatmap Data ───
  const heatmapData = useMemo(() => {
    const WEEKS = isMobile ? 10 : 16;
    const totalDays = WEEKS * 7;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the most recent Sunday (end of grid)
    const endDate = new Date(today);
    const todayDow = endDate.getDay(); // 0=Sun
    // We want the grid to end on Saturday and start on Sunday
    // Actually, let's end on today's week's Saturday
    const daysUntilSat = (6 - todayDow + 7) % 7;
    endDate.setDate(endDate.getDate() + daysUntilSat);

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - totalDays + 1);

    // Build activity map: count completed tasks per day
    const activityMap: Record<string, number> = {};
    tasks.forEach((t) => {
      if (t.completed && t.dueDate) {
        activityMap[t.dueDate] = (activityMap[t.dueDate] || 0) + 1;
      }
      // Also count task creation
      if (t.createdAt) {
        const createdDate = new Date(t.createdAt);
        const ck = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, "0")}-${String(createdDate.getDate()).padStart(2, "0")}`;
        activityMap[ck] = (activityMap[ck] || 0) + 0.5;
      }
    });

    // Generate cells: columns = weeks, rows = days (Sun=0 to Sat=6)
    const cells: Array<{
      dateKey: string;
      count: number;
      isToday: boolean;
      col: number;
      row: number;
    }> = [];
    let maxCount = 0;

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const count = Math.ceil(activityMap[dk] || 0);
      if (count > maxCount) maxCount = count;
      const col = Math.floor(i / 7);
      const row = i % 7;
      cells.push({
        dateKey: dk,
        count,
        isToday: dk === todayStr,
        col,
        row,
      });
    }

    // Compute intensity levels (0-4)
    const getLevel = (count: number) => {
      if (count === 0) return 0;
      if (maxCount <= 1) return count > 0 ? 2 : 0;
      const ratio = count / maxCount;
      if (ratio <= 0.25) return 1;
      if (ratio <= 0.5) return 2;
      if (ratio <= 0.75) return 3;
      return 4;
    };

    // Month labels for the top of the heatmap
    const monthLabels: Array<{ label: string; col: number }> = [];
    let lastMonthSeen = -1;
    for (let i = 0; i < totalDays; i += 7) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      if (d.getMonth() !== lastMonthSeen) {
        lastMonthSeen = d.getMonth();
        monthLabels.push({
          label: d.toLocaleDateString("id-ID", { month: "short" }),
          col: Math.floor(i / 7),
        });
      }
    }

    return { cells, getLevel, WEEKS, monthLabels, totalDays };
  }, [tasks, todayStr, isMobile]);

  const dayLabelsHeatmap = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

  return (
    <motion.div
      className="dashboard-page"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      {/* 1. Dashboard Hero Header */}
      <section className="dashboard-hero">
        <div className="dashboard-hero-text">
          <span className="eyebrow">
            <Sparkles size={11} /> PUSAT KENDALI · DASHBOARD
          </span>
          <h1>Halo, {userName}!</h1>
          <p>
            Kelola tugas dan catatanmu langsung dari sini melalui pop-up aksi
            tanpa berpindah halaman.
          </p>
          <div className="dashboard-hero-actions">
            <button
              type="button"
              className="button-primary"
              onClick={onCreateTask}
            >
              <Plus size={15} /> Tugas Baru
            </button>
          </div>
        </div>

        {/* Productivity Score Ring / Card - Dynamic & Multi-Category Breakdown */}
        <div
          className={`dashboard-progress-card ${categoryFilter !== "all" ? `progress-theme-${categoryFilter.toLowerCase()}` : ""}`}
        >
          <div className="progress-ring-circle">
            <TrendingUp size={22} className="progress-ring-icon" />
            <span className="progress-ring-pct">{currentCompletionRate}%</span>
          </div>
          <div className="progress-card-info">
            <div className="progress-card-headline">
              <strong>
                {currentCompletedTasks} dari {currentTotalTasks} tugas selesai
              </strong>
              {categoryFilter !== "all" ? (
                <span
                  className={`progress-cat-badge badge-${categoryFilter.toLowerCase()}`}
                >
                  {categoryFilter}
                </span>
              ) : (
                <span className="progress-all-badge">Semua</span>
              )}
            </div>

            <small>
              {currentCompletionRate === 100 && currentTotalTasks > 0
                ? `Luar biasa! Seluruh tugas ${categoryFilter === "all" ? "" : categoryFilter} terselesaikan.`
                : `${currentActiveTasks.length} tugas ${categoryFilter === "all" ? "" : categoryFilter} masih berjalan.`}
            </small>

            {/* Dynamic Multi-Category Segmented Progress Bar */}
            {categoryFilter === "all" ? (
              <div className="progress-bar-track progress-bar-multi">
                {categoryClusterStats.map((cat) => (
                  <div
                    key={cat.name}
                    className={`progress-segment seg-${cat.colorKey === "blue" ? "work" : cat.colorKey === "purple" ? "personal" : "study"}`}
                    style={{
                      width: `${totalTasks > 0 ? (cat.completed / totalTasks) * 100 : 0}%`,
                    }}
                    title={`${cat.name}: ${cat.completed}/${cat.total} selesai`}
                  />
                ))}
              </div>
            ) : (
              <div className="progress-bar-track">
                <div
                  className={`progress-bar-fill fill-${categoryFilter.toLowerCase()}`}
                  style={{ width: `${currentCompletionRate}%` }}
                />
              </div>
            )}

            {/* Category Breakdown Progress Strip */}
            <div className="progress-category-pills">
              {categoryClusterStats.map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  className={`prog-pill prog-${cat.name.toLowerCase()} ${categoryFilter === cat.name ? "active" : ""}`}
                  onClick={() =>
                    setCategoryFilter(
                      categoryFilter === cat.name ? "all" : cat.name
                    )
                  }
                  title={`Klik untuk filter kategori ${cat.name}`}
                >
                  <span
                    className={`prog-pill-dot dot-${cat.colorKey === "blue" ? "work" : cat.colorKey === "purple" ? "personal" : "study"}`}
                  />
                  {cat.name}:{" "}
                  <strong>
                    {cat.completed}/{cat.total}
                  </strong>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Key Metrics & Category Quick Switcher */}
      <section className="dashboard-metrics-section">
        <div className="metrics-category-bar">
          <div className="metrics-category-label">
            <Filter size={13} />
            <span>Filter Kategori:</span>
          </div>
          <div className="category-pill-group">
            <button
              type="button"
              className={`cat-pill-btn ${categoryFilter === "all" ? "active" : ""}`}
              onClick={() => setCategoryFilter("all")}
            >
              Semua ({activeTasks.length})
            </button>
            {categoryClusterStats.map((cat) => {
              const IconComp = cat.icon;
              return (
                <button
                  key={cat.name}
                  type="button"
                  className={`cat-pill-btn pill-${cat.name.toLowerCase()} ${categoryFilter === cat.name ? "active" : ""}`}
                  onClick={() => setCategoryFilter(cat.name)}
                >
                  <IconComp size={12} />
                  <span>
                    {cat.name} ({cat.active})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="dashboard-metrics-grid">
          <button
            type="button"
            className="metric-card metric-interactive"
            onClick={() =>
              onOpenActionModal(
                "today",
                categoryFilter !== "all" ? categoryFilter : undefined
              )
            }
            title="Buka pop-up aksi Tugas Hari Ini"
          >
            <div className="metric-header">
              <span className="metric-icon metric-icon-sun">
                <Sun size={17} />
              </span>
              <span className="metric-arrow">
                <ArrowRight size={14} />
              </span>
            </div>
            <strong>{displayTodayTasks.length}</strong>
            <span className="metric-label">
              Tugas Hari Ini {categoryFilter !== "all" && `(${categoryFilter})`}
            </span>
            <div className="metric-breakdown-tags">
              {categoryFilter === "all" ? (
                categoryClusterStats.slice(0, 3).map((cat) => (
                  <span
                    key={cat.name}
                    className={`m-tag m-tag-${cat.colorKey}`}
                    title={`${cat.name} hari ini`}
                  >
                    {cat.name.charAt(0).toUpperCase()}: {cat.today}
                  </span>
                ))
              ) : (
                <span className="m-tag m-tag-cat">{categoryFilter}</span>
              )}
              {displayTodayTasks.some((t) => t.priority === "high") && (
                <span
                  className="m-tag m-tag-high"
                  title="Ada tugas mendesak hari ini"
                >
                  <Flame size={10} /> Mendesak
                </span>
              )}
            </div>
          </button>

          <button
            type="button"
            className="metric-card metric-interactive"
            onClick={() =>
              onOpenActionModal(
                "overdue",
                categoryFilter !== "all" ? categoryFilter : undefined
              )
            }
            title="Buka pop-up aksi Tugas Terlambat"
          >
            <div className="metric-header">
              <span className="metric-icon metric-icon-overdue">
                <AlertTriangle size={17} />
              </span>
              <span className="metric-arrow">
                <ArrowRight size={14} />
              </span>
            </div>
            <strong>{displayOverdueTasks.length}</strong>
            <span className="metric-label">
              Terlambat {categoryFilter !== "all" && `(${categoryFilter})`}
            </span>
            <div className="metric-breakdown-tags">
              {displayOverdueTasks.length > 0 ? (
                <span className="m-tag m-tag-overdue">Melewati tenggat</span>
              ) : (
                <span className="m-tag m-tag-cat">
                  Tidak ada yang terlambat
                </span>
              )}
            </div>
          </button>

          <button
            type="button"
            className="metric-card metric-interactive"
            onClick={() =>
              onOpenActionModal(
                "active",
                categoryFilter !== "all" ? categoryFilter : undefined
              )
            }
            title="Buka pop-up aksi Semua Tugas Aktif"
          >
            <div className="metric-header">
              <span className="metric-icon metric-icon-active">
                <Layers size={17} />
              </span>
              <span className="metric-arrow">
                <ArrowRight size={14} />
              </span>
            </div>
            <strong>{displayActiveTasks.length}</strong>
            <span className="metric-label">
              Total Tugas Aktif{" "}
              {categoryFilter !== "all" && `(${categoryFilter})`}
            </span>
            <div className="metric-breakdown-tags">
              {categoryFilter === "all" ? (
                categoryClusterStats.slice(0, 3).map((cat) => (
                  <span
                    key={cat.name}
                    className={`m-tag m-tag-${cat.colorKey}`}
                    title={`${cat.name} aktif`}
                  >
                    {cat.name.charAt(0).toUpperCase()}: {cat.active}
                  </span>
                ))
              ) : (
                <span className="m-tag m-tag-cat">{categoryFilter}</span>
              )}
              {displayHighPriority.length > 0 && (
                <span
                  className="m-tag m-tag-high"
                  title="Jumlah tugas prioritas tinggi"
                >
                  <Flame size={10} /> {displayHighPriority.length} Tinggi
                </span>
              )}
            </div>
          </button>

          <button
            type="button"
            className="metric-card metric-interactive"
            onClick={() =>
              onOpenActionModal(
                "completed",
                categoryFilter !== "all" ? categoryFilter : undefined
              )
            }
            title="Buka pop-up aksi Tugas Selesai"
          >
            <div className="metric-header">
              <span className="metric-icon metric-icon-green">
                <CheckCircle2 size={17} />
              </span>
              <span className="metric-arrow">
                <ArrowRight size={14} />
              </span>
            </div>
            <strong>{displayCompletedTasks.length}</strong>
            <span className="metric-label">
              Tugas Selesai {categoryFilter !== "all" && `(${categoryFilter})`}
            </span>
            <div className="metric-breakdown-tags">
              {categoryFilter === "all" ? (
                categoryClusterStats.slice(0, 3).map((cat) => (
                  <span
                    key={cat.name}
                    className={`m-tag m-tag-${cat.colorKey}`}
                    title={`${cat.name} selesai`}
                  >
                    {cat.name.charAt(0).toUpperCase()}: {cat.completed}
                  </span>
                ))
              ) : (
                <span className="m-tag m-tag-cat">{categoryFilter}</span>
              )}
            </div>
          </button>

          <button
            type="button"
            className="metric-card metric-interactive"
            onClick={onCreateStickyNote}
            title="Tambah catatan tempel baru"
          >
            <div className="metric-header">
              <span className="metric-icon metric-icon-amber">
                <Pin size={17} />
              </span>
              <span className="metric-arrow">
                <Plus size={14} />
              </span>
            </div>
            <strong>{stickyNotes.length}</strong>
            <span className="metric-label">Catatan Tempel Bebas</span>
            <div className="metric-breakdown-tags">
              <span className="m-tag m-tag-note">
                Murni catatan (tanpa progres)
              </span>
            </div>
          </button>
        </div>
      </section>

      {/* 3. Sticky Notes Board (Papan Catatan Bebas - Tanpa Progress/Centang) */}
      <section className="dashboard-section-block">
        <div className="dashboard-section-header">
          <div className="dashboard-section-title">
            <span className="section-badge">
              <StickyNote size={14} />
            </span>
            <div>
              <h2>Papan Catatan Tempel (Sticky Notes)</h2>
              <p>
                Catatan bebas untuk ide & memo (tidak mempengaruhi progres
                tugas). Bisa digeser dan diperkecil.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="button-quiet"
            onClick={onCreateStickyNote}
          >
            <Plus size={14} /> Buat Catatan Baru
          </button>
        </div>

        {stickyNotes.length > 0 ? (
          <div className="dashboard-sticky-board">
            {stickyNotes.map((note) => {
              const noteColor = note.color || "yellow";
              return (
                <motion.div
                  key={note.id}
                  className={`dashboard-sticky-card sticky-color-${noteColor}`}
                  onClick={() => onOpenStickyNote(note)}
                  whileHover={{ y: -3, scale: 1.015 }}
                  transition={{ duration: 0.15 }}
                  title="Klik untuk membuka, menggeser atau memperkecil catatan"
                >
                  <div className="sticky-card-top">
                    <span className="sticky-pin-badge">
                      <Pin size={12} /> {note.pinned ? "Tersemat" : "Catatan"}
                    </span>
                    <span className="sticky-date-badge">
                      <Clock3 size={11} /> Bebas
                    </span>
                  </div>
                  <h4 className="sticky-title">{note.title}</h4>
                  <p className="sticky-excerpt">
                    {note.content ||
                      "Klik untuk menulis catatan, ide, atau memo..."}
                  </p>
                  <div className="sticky-card-footer">
                    <span>Bisa diperkecil & digeser</span>
                    <ArrowRight size={13} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="dashboard-sticky-empty">
            <StickyNote size={28} />
            <p>
              Belum ada catatan tempel. Buat catatan bebas pertamamu sekarang.
            </p>
            <button
              type="button"
              className="button-quiet"
              onClick={onCreateStickyNote}
            >
              + Buat Catatan Tempel Pertama
            </button>
          </div>
        )}
      </section>

      {/* 4. Kalender Tugas & Monitoring Aktivitas (Dua Kolom Seimbang & Serasi) */}
      <div className="analytics-balanced-grid">
        {/* Kolom Kiri: Kalender Tugas Bulanan */}
        <section className="dashboard-panel-card analytics-panel-card">
          <div className="panel-card-heading">
            <span className="panel-badge">
              <Calendar size={15} />
            </span>
            <div className="panel-card-heading-content">
              <div className="panel-card-heading-row">
                <h3>Kalender Tugas</h3>
                <span
                  className="cal-today-sync-badge"
                  title="Tugas aktif yang jatuh tempo hari ini"
                >
                  {todayTasks.length} tugas hari ini
                </span>
              </div>
              <p>Tersinkronisasi otomatis dengan tenggat waktu</p>
            </div>
          </div>

          <div className="cal-widget">
            <div className="cal-nav">
              <button
                type="button"
                className="cal-nav-btn"
                onClick={prevMonth}
                title="Bulan sebelumnya"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="cal-month-label">{calMonthLabel}</span>
              <button
                type="button"
                className="cal-nav-btn"
                onClick={nextMonth}
                title="Bulan berikutnya"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="cal-grid">
              {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
                <div key={d} className="cal-day-header">
                  {d}
                </div>
              ))}
              {calendarData.map((cell, i) =>
                cell === null ? (
                  <div key={`empty-${i}`} className="cal-day cal-day-empty" />
                ) : (
                  <button
                    type="button"
                    key={cell.dateKey}
                    className={[
                      "cal-day",
                      cell.isToday ? "cal-day-today" : "",
                      cell.total > 0 ? "cal-day-has-tasks" : "",
                      cell.total > 0 && cell.completed === cell.total
                        ? "cal-day-all-done"
                        : "",
                      hoveredDay === cell.dateKey ? "cal-day-hover" : "",
                    ].join(" ")}
                    onMouseEnter={() => setHoveredDay(cell.dateKey)}
                    onMouseLeave={() => setHoveredDay(null)}
                    disabled={cell.total === 0}
                    onClick={() => {
                      if (cell.total > 0) {
                        onOpenActionModal("date", undefined, cell.dateKey);
                      }
                    }}
                    style={{ cursor: cell.total > 0 ? "pointer" : "default" }}
                    title={
                      cell.total > 0
                        ? `${cell.day}: ${cell.total} tugas (${cell.completed} selesai) - Klik untuk buka aksi`
                        : `${cell.day}`
                    }
                  >
                    <span className="cal-day-num">{cell.day}</span>
                    {cell.total > 0 && (
                      <span className="cal-day-badge">
                        {cell.completed === cell.total ? (
                          <Check size={8} />
                        ) : (
                          cell.total
                        )}
                      </span>
                    )}
                  </button>
                )
              )}
            </div>

            <div className="cal-footer">
              <div className="cal-legend-item">
                <span className="cal-legend-dot cal-legend-today" /> Hari ini
              </div>
              <div className="cal-legend-item">
                <span className="cal-legend-dot cal-legend-tasks" /> Ada tugas
              </div>
              <div className="cal-legend-item">
                <span className="cal-legend-dot cal-legend-done" /> Selesai
              </div>
            </div>
          </div>
        </section>

        {/* Kolom Kanan: Peta Aktivitas & Monitoring Produktivitas */}
        <section className="dashboard-panel-card analytics-panel-card">
          <div className="panel-card-heading">
            <span className="panel-badge">
              <Activity size={15} />
            </span>
            <div className="panel-card-heading-content">
              <div className="panel-card-heading-row">
                <h3>Aktivitas & Monitoring</h3>
                <span
                  className="heatmap-streak-badge"
                  title="Jumlah tugas yang terselesaikan"
                >
                  <Flame size={11} /> {completedTasks} selesai
                </span>
              </div>
              <p>Peta intensitas produktivitas 16 minggu terakhir</p>
            </div>
          </div>

          <div className="heatmap-widget">
            {/* Quick KPI Strip */}
            <div className="analytics-kpi-strip">
              <div className="kpi-mini-card">
                <span className="kpi-mini-num">{completedTasks}</span>
                <span className="kpi-mini-label">Tuntas</span>
              </div>
              <div className="kpi-mini-card">
                <span className="kpi-mini-num">{activeTasks.length}</span>
                <span className="kpi-mini-label">Berjalan</span>
              </div>
              <div className="kpi-mini-card">
                <span className="kpi-mini-num">{completionRate}%</span>
                <span className="kpi-mini-label">Skor</span>
              </div>
            </div>

            {/* Month labels row */}
            <div
              className="heatmap-month-labels"
              style={{
                gridTemplateColumns: `20px repeat(${heatmapData.WEEKS}, 1fr)`,
              }}
            >
              <span />
              {Array.from({ length: heatmapData.WEEKS }, (_, col) => {
                const ml = heatmapData.monthLabels.find((m) => m.col === col);
                return (
                  <span key={col} className="heatmap-month-label">
                    {ml ? ml.label : ""}
                  </span>
                );
              })}
            </div>

            {/* Heatmap grid */}
            <div className="heatmap-grid-wrap">
              <div className="heatmap-day-labels">
                {dayLabelsHeatmap.map((d, i) => (
                  <span key={d} className="heatmap-day-label">
                    {i % 2 === 1 ? d : ""}
                  </span>
                ))}
              </div>

              <div
                className="heatmap-grid"
                style={{
                  gridTemplateColumns: `repeat(${heatmapData.WEEKS}, 1fr)`,
                  gridTemplateRows: "repeat(7, 1fr)",
                }}
              >
                {heatmapData.cells.map((cell) => (
                  <div
                    key={cell.dateKey}
                    className={`heatmap-cell heatmap-level-${heatmapData.getLevel(cell.count)}${cell.isToday ? " heatmap-cell-today" : ""}`}
                    style={{ gridColumn: cell.col + 1, gridRow: cell.row + 1 }}
                    title={`${cell.dateKey}: ${cell.count} aktivitas`}
                  />
                ))}
              </div>
            </div>

            {/* Legend & Stats Footer */}
            <div className="heatmap-footer">
              <div className="heatmap-legend">
                <span className="heatmap-legend-label">Sedikit</span>
                {[0, 1, 2, 3, 4].map((lvl) => (
                  <span
                    key={lvl}
                    className={`heatmap-legend-cell heatmap-level-${lvl}`}
                  />
                ))}
                <span className="heatmap-legend-label">Banyak</span>
              </div>
              <span className="heatmap-footnote">112 hari terakhir</span>
            </div>
          </div>
        </section>
      </div>

      {/* 5. Two Columns: Fokus Hari Ini & Klaster Kategori Berwarna */}
      <div className="dashboard-columns-grid">
        {/* Left Column: Fokus Segera / Prioritas Tinggi */}
        <section className="dashboard-panel-card">
          <div className="panel-card-heading">
            <span className="panel-badge">
              <Clock3 size={14} />
            </span>
            <div>
              <h3>Fokus Hari Ini & Prioritas Tinggi</h3>
              <p>Tugas penting yang bisa diselesaikan langsung di sini</p>
            </div>
          </div>

          <div className={`dashboard-spotlight-list layout-${taskLayout}`}>
            {(() => {
              const spotlightList =
                displayTodayTasks.length > 0
                  ? displayTodayTasks
                  : displayHighPriority.length > 0
                    ? displayHighPriority
                    : displayActiveTasks.slice(0, 4);
              const spotlightIds = spotlightList.map((item) => item.id);
              return spotlightList.length > 0 ? (
                spotlightList.map((t, idx) => (
                  <div key={t.id} className="spotlight-task-row">
                    <span
                      className="task-order-badge"
                      title={`Urutan #${idx + 1}`}
                    >
                      {idx + 1}
                    </span>
                    <button
                      type="button"
                      className={`task-check ${t.completed ? "checked" : ""}`}
                      onClick={() => onToggleTask(t)}
                      title="Tandai selesai"
                    >
                      {t.completed && <Check size={13} />}
                    </button>
                    <div
                      className="spotlight-task-info"
                      role="button"
                      tabIndex={0}
                      onClick={() => onOpenTaskDetail(t)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onOpenTaskDetail(t);
                        }
                      }}
                      title="Klik untuk melihat detail tugas"
                    >
                      <strong>{t.title}</strong>
                      <div className="spotlight-meta">
                        <span
                          className={`spotlight-cat cat-badge-${t.category.toLowerCase()}`}
                        >
                          {t.category}
                        </span>
                        {t.priority === "high" && (
                          <span className="priority-label">Tinggi</span>
                        )}
                        {t.dueDate && (
                          <span
                            className={`spotlight-due ${t.dueDate < todayStr && !t.completed ? "overdue-badge" : ""}`}
                          >
                            <Clock3 size={11} /> {t.dueDate}
                            {t.dueDate < todayStr &&
                              !t.completed &&
                              " · Terlambat"}
                          </span>
                        )}
                      </div>
                    </div>
                    {spotlightList.length > 1 && (
                      <div className="task-reorder-controls">
                        <button
                          type="button"
                          className="task-reorder-btn"
                          disabled={idx === 0}
                          onClick={() => onMoveTask(t.id, "up", spotlightIds)}
                          title="Pindah ke atas"
                          aria-label={`Pindah ${t.title} ke atas`}
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          className="task-reorder-btn"
                          disabled={idx === spotlightList.length - 1}
                          onClick={() => onMoveTask(t.id, "down", spotlightIds)}
                          title="Pindah ke bawah"
                          aria-label={`Pindah ${t.title} ke bawah`}
                        >
                          <ArrowDown size={12} />
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      className="spotlight-open-btn"
                      onClick={() => onOpenTaskDetail(t)}
                      title="Buka form detail"
                    >
                      <ArrowRight size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="spotlight-empty">
                  <CheckCircle2 size={24} />
                  <p>Tidak ada tugas mendesak saat ini. Semua terkendali.</p>
                </div>
              );
            })()}
          </div>

          <button
            type="button"
            className="panel-view-all-btn"
            onClick={() =>
              onOpenActionModal(
                "today",
                categoryFilter !== "all" ? categoryFilter : undefined
              )
            }
          >
            <span>Buka Pop-up Aksi Lengkap Hari Ini</span>
            <ArrowRight size={14} />
          </button>
        </section>

        {/* Right Column: Klaster Kategori & Pembeda Prioritas */}
        <section className="dashboard-panel-card">
          <div className="panel-card-heading">
            <span className="panel-badge">
              <Folder size={14} />
            </span>
            <div>
              <h3>Klaster Kategori & Prioritas</h3>
              <p>Kelompok kategori tugas dengan rincian prioritas</p>
            </div>
          </div>

          <div className="category-cluster-list">
            {categoryClusterStats.map((cat) => {
              const IconComp = cat.icon;
              const pct =
                cat.total > 0
                  ? Math.round((cat.completed / cat.total) * 100)
                  : 0;
              return (
                <button
                  type="button"
                  key={cat.name}
                  className={`category-cluster-card cat-theme-${cat.colorKey}`}
                  onClick={() => onOpenActionModal("category", cat.name)}
                  title={`Klik untuk buka pop-up aksi kategori ${cat.name}`}
                >
                  <div className="cluster-header">
                    <div className="cluster-title-wrap">
                      <span
                        className={`cluster-icon-badge icon-${cat.colorKey}`}
                      >
                        <IconComp size={15} />
                      </span>
                      <div>
                        <strong className="cluster-name">{cat.name}</strong>
                        <span className="cluster-sub">{cat.label}</span>
                      </div>
                    </div>

                    <div className="cluster-chips">
                      {cat.today > 0 && (
                        <span
                          className="cluster-chip chip-today"
                          title="Jatuh tempo hari ini"
                        >
                          <Sun size={10} /> {cat.today} Hari ini
                        </span>
                      )}
                      {cat.highPriority > 0 && (
                        <span
                          className="cluster-chip chip-high"
                          title="Prioritas tinggi"
                        >
                          <Flame size={10} /> {cat.highPriority} Mendesak
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="cluster-stats-row">
                    <span className="cluster-stat-val">
                      <strong>{cat.active}</strong> aktif ·{" "}
                      <strong>{cat.completed}</strong> selesai
                    </span>
                    <span className="cluster-pct">{pct}% tuntas</span>
                  </div>

                  <div className="cluster-progress-track">
                    <div
                      className={`cluster-progress-fill fill-${cat.colorKey}`}
                      style={{ width: `${Math.max(6, pct)}%` }}
                    />
                  </div>

                  <div className="cluster-footer-action">
                    <span>Kelola tugas {cat.name}</span>
                    <ArrowRight size={12} />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="category-footnote">
            Tip: Setiap kartu memiliki pembeda warna & status prioritas. Klik
            untuk membuka modal aksi.
          </div>
        </section>
      </div>
    </motion.div>
  );
}
