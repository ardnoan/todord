import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  CheckCircle2,
  Clock3,
  Folder,
  ArrowRight,
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
} from "lucide-react";
import type { StickyNote as StickyNoteType, Task } from "../types";

interface DashboardViewProps {
  tasks: Task[];
  stickyNotes: StickyNoteType[];
  userName: string;
  onOpenActionModal: (
    type: "today" | "active" | "completed" | "category",
    categoryName?: string
  ) => void;
  onOpenStickyNote: (note: StickyNoteType) => void;
  onCreateStickyNote: () => void;
  onOpenTaskDetail: (task: Task) => void;
  onToggleTask: (task: Task) => Promise<void>;
}

export function DashboardView({
  tasks,
  stickyNotes,
  userName,
  onOpenActionModal,
  onOpenStickyNote,
  onCreateStickyNote,
  onOpenTaskDetail,
  onToggleTask,
}: DashboardViewProps) {
  // Pure task progress: Sticky notes are pure notes and do NOT count towards completion progress
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const activeTasks = tasks.filter((t) => !t.completed);
  const completionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const todayStr = new Date().toISOString().split("T")[0];
  const todayTasks = activeTasks.filter((t) => t.dueDate === todayStr);
  const highPriorityTasks = activeTasks.filter((t) => t.priority === "high");

  // Category Quick Filter & Analytics Tab States
  const [categoryFilter, setCategoryFilter] = useState<"all" | "Work" | "Personal" | "Study">("all");
  const [analyticsTab, setAnalyticsTab] = useState<"calendar" | "heatmap">("calendar");

  // Filtered metrics based on active category filter
  const displayActiveTasks = useMemo(() => {
    if (categoryFilter === "all") return activeTasks;
    return activeTasks.filter((t) => t.category === categoryFilter);
  }, [activeTasks, categoryFilter]);

  const displayTodayTasks = useMemo(() => {
    return displayActiveTasks.filter((t) => t.dueDate === todayStr);
  }, [displayActiveTasks, todayStr]);

  const displayCompletedTasks = useMemo(() => {
    if (categoryFilter === "all") return tasks.filter((t) => t.completed);
    return tasks.filter((t) => t.completed && t.category === categoryFilter);
  }, [tasks, categoryFilter]);

  const displayHighPriority = useMemo(() => {
    return displayActiveTasks.filter((t) => t.priority === "high");
  }, [displayActiveTasks]);

  // Category Cluster Breakdown (Work, Personal, Study) with dedicated metrics
  const categoryClusterStats = useMemo(() => {
    return [
      {
        name: "Work",
        label: "Pekerjaan",
        icon: Briefcase,
        colorKey: "blue",
        active: activeTasks.filter((t) => t.category === "Work").length,
        today: activeTasks.filter((t) => t.category === "Work" && t.dueDate === todayStr).length,
        highPriority: activeTasks.filter((t) => t.category === "Work" && t.priority === "high").length,
        completed: tasks.filter((t) => t.category === "Work" && t.completed).length,
        total: tasks.filter((t) => t.category === "Work").length,
      },
      {
        name: "Personal",
        label: "Pribadi",
        icon: User,
        colorKey: "purple",
        active: activeTasks.filter((t) => t.category === "Personal").length,
        today: activeTasks.filter((t) => t.category === "Personal" && t.dueDate === todayStr).length,
        highPriority: activeTasks.filter((t) => t.category === "Personal" && t.priority === "high").length,
        completed: tasks.filter((t) => t.category === "Personal" && t.completed).length,
        total: tasks.filter((t) => t.category === "Personal").length,
      },
      {
        name: "Study",
        label: "Belajar & Kuliah",
        icon: GraduationCap,
        colorKey: "amber",
        active: activeTasks.filter((t) => t.category === "Study").length,
        today: activeTasks.filter((t) => t.category === "Study" && t.dueDate === todayStr).length,
        highPriority: activeTasks.filter((t) => t.category === "Study" && t.priority === "high").length,
        completed: tasks.filter((t) => t.category === "Study" && t.completed).length,
        total: tasks.filter((t) => t.category === "Study").length,
      },
    ];
  }, [tasks, activeTasks, todayStr]);

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
    const taskCountMap: Record<string, { total: number; completed: number }> = {};
    tasks.forEach((t) => {
      if (!t.dueDate) return;
      const [ty, tm] = t.dueDate.split("-").map(Number);
      if (ty === year && tm === month + 1) {
        if (!taskCountMap[t.dueDate]) taskCountMap[t.dueDate] = { total: 0, completed: 0 };
        taskCountMap[t.dueDate].total++;
        if (t.completed) taskCountMap[t.dueDate].completed++;
      }
    });

    const cells: Array<{ day: number; dateKey: string; isToday: boolean; total: number; completed: number } | null> = [];
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

  const calMonthLabel = calMonth.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  const prevMonth = () => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  // ─── Activity Heatmap Data ───
  const heatmapData = useMemo(() => {
    const WEEKS = 16;
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
    const cells: Array<{ dateKey: string; count: number; isToday: boolean; col: number; row: number }> = [];
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
  }, [tasks, todayStr]);

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
            Kelola tugas dan catatanmu langsung dari sini melalui pop-up aksi tanpa berpindah halaman.
          </p>
        </div>

        {/* Productivity Score Ring / Card */}
        <div className="dashboard-progress-card">
          <div className="progress-ring-circle">
            <TrendingUp size={22} className="progress-ring-icon" />
            <span className="progress-ring-pct">{completionRate}%</span>
          </div>
          <div className="progress-card-info">
            <strong>
              {completedTasks} dari {totalTasks} tugas selesai
            </strong>
            <small>
              {completionRate === 100 && totalTasks > 0
                ? "Luar biasa! Semua tugas terselesaikan."
                : `${activeTasks.length} tugas masih berjalan saat ini.`}
            </small>
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{ width: `${completionRate}%` }}
              />
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
            <button
              type="button"
              className={`cat-pill-btn pill-work ${categoryFilter === "Work" ? "active" : ""}`}
              onClick={() => setCategoryFilter("Work")}
            >
              <Briefcase size={12} />
              <span>Work ({categoryClusterStats[0].active})</span>
            </button>
            <button
              type="button"
              className={`cat-pill-btn pill-personal ${categoryFilter === "Personal" ? "active" : ""}`}
              onClick={() => setCategoryFilter("Personal")}
            >
              <User size={12} />
              <span>Personal ({categoryClusterStats[1].active})</span>
            </button>
            <button
              type="button"
              className={`cat-pill-btn pill-study ${categoryFilter === "Study" ? "active" : ""}`}
              onClick={() => setCategoryFilter("Study")}
            >
              <GraduationCap size={12} />
              <span>Study ({categoryClusterStats[2].active})</span>
            </button>
          </div>
        </div>

        <div className="dashboard-metrics-grid">
          <div
            className="metric-card metric-interactive"
            onClick={() => onOpenActionModal("today")}
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
                <>
                  <span className="m-tag m-tag-blue" title="Work hari ini">W: {categoryClusterStats[0].today}</span>
                  <span className="m-tag m-tag-purple" title="Personal hari ini">P: {categoryClusterStats[1].today}</span>
                  <span className="m-tag m-tag-amber" title="Study hari ini">S: {categoryClusterStats[2].today}</span>
                </>
              ) : (
                <span className="m-tag m-tag-cat">{categoryFilter}</span>
              )}
              {displayTodayTasks.some((t) => t.priority === "high") && (
                <span className="m-tag m-tag-high" title="Ada tugas mendesak hari ini">
                  <Flame size={10} /> Mendesak
                </span>
              )}
            </div>
          </div>

          <div
            className="metric-card metric-interactive"
            onClick={() => onOpenActionModal("active")}
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
              Total Tugas Aktif {categoryFilter !== "all" && `(${categoryFilter})`}
            </span>
            <div className="metric-breakdown-tags">
              {categoryFilter === "all" ? (
                <>
                  <span className="m-tag m-tag-blue" title="Work aktif">W: {categoryClusterStats[0].active}</span>
                  <span className="m-tag m-tag-purple" title="Personal aktif">P: {categoryClusterStats[1].active}</span>
                  <span className="m-tag m-tag-amber" title="Study aktif">S: {categoryClusterStats[2].active}</span>
                </>
              ) : (
                <span className="m-tag m-tag-cat">{categoryFilter}</span>
              )}
              {displayHighPriority.length > 0 && (
                <span className="m-tag m-tag-high" title="Jumlah tugas prioritas tinggi">
                  <Flame size={10} /> {displayHighPriority.length} Tinggi
                </span>
              )}
            </div>
          </div>

          <div
            className="metric-card metric-interactive"
            onClick={() => onOpenActionModal("completed")}
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
                <>
                  <span className="m-tag m-tag-blue" title="Work selesai">W: {categoryClusterStats[0].completed}</span>
                  <span className="m-tag m-tag-purple" title="Personal selesai">P: {categoryClusterStats[1].completed}</span>
                  <span className="m-tag m-tag-amber" title="Study selesai">S: {categoryClusterStats[2].completed}</span>
                </>
              ) : (
                <span className="m-tag m-tag-cat">{categoryFilter}</span>
              )}
            </div>
          </div>

          <div
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
              <span className="m-tag m-tag-note">Murni catatan (tanpa progres)</span>
            </div>
          </div>
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
                Catatan bebas untuk ide & memo (tidak mempengaruhi progres tugas). Bisa digeser dan diperkecil.
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
                    {note.content || "Klik untuk menulis catatan, ide, atau memo..."}
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
            <p>Belum ada catatan tempel. Buat catatan bebas pertamamu sekarang.</p>
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

      {/* 4. Kalender & Monitoring Analitik Terpadu (Sleek Compact di Desktop) */}
      <section className="dashboard-panel-card dashboard-analytics-unified">
        <div className="analytics-unified-header">
          <div className="panel-card-heading-content">
            <div className="panel-card-heading-row">
              <div className="analytics-title-group">
                <span className="panel-badge">
                  {analyticsTab === "calendar" ? <Calendar size={14} /> : <Activity size={14} />}
                </span>
                <div>
                  <div className="panel-card-heading-row">
                    <h3>{analyticsTab === "calendar" ? "Kalender Tugas Bulanan" : "Peta Aktivitas & Monitoring"}</h3>
                    {analyticsTab === "calendar" && (
                      <span className="cal-today-sync-badge" title="Tugas aktif yang jatuh tempo hari ini">
                        {todayTasks.length} tugas hari ini
                      </span>
                    )}
                  </div>
                  <p>
                    {analyticsTab === "calendar"
                      ? "Tersinkronisasi otomatis dengan tenggat tugas (klik tanggal untuk buka aksi)"
                      : "Peta intensitas aktivitas penyelesaian tugas 16 minggu terakhir"}
                  </p>
                </div>
              </div>

              {/* Segmented Tab Switcher */}
              <div className="analytics-tab-switcher">
                <button
                  type="button"
                  className={`analytics-tab-btn ${analyticsTab === "calendar" ? "active" : ""}`}
                  onClick={() => setAnalyticsTab("calendar")}
                  title="Lihat Kalender Tugas Bulanan"
                >
                  <Calendar size={13} />
                  <span>Kalender Tugas</span>
                </button>
                <button
                  type="button"
                  className={`analytics-tab-btn ${analyticsTab === "heatmap" ? "active" : ""}`}
                  onClick={() => setAnalyticsTab("heatmap")}
                  title="Lihat Peta Aktivitas 16 Minggu"
                >
                  <Activity size={13} />
                  <span>Aktivitas & Heatmap</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="analytics-tab-body">
          {analyticsTab === "calendar" ? (
            <div className="cal-widget cal-widget-compact">
              <div className="cal-nav">
                <button type="button" className="cal-nav-btn" onClick={prevMonth} title="Bulan sebelumnya">
                  <ChevronLeft size={16} />
                </button>
                <span className="cal-month-label">{calMonthLabel}</span>
                <button type="button" className="cal-nav-btn" onClick={nextMonth} title="Bulan berikutnya">
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="cal-grid">
                {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
                  <div key={d} className="cal-day-header">{d}</div>
                ))}
                {calendarData.map((cell, i) =>
                  cell === null ? (
                    <div key={`empty-${i}`} className="cal-day cal-day-empty" />
                  ) : (
                    <div
                      key={cell.dateKey}
                      className={[
                        "cal-day",
                        cell.isToday ? "cal-day-today" : "",
                        cell.total > 0 ? "cal-day-has-tasks" : "",
                        cell.total > 0 && cell.completed === cell.total ? "cal-day-all-done" : "",
                        hoveredDay === cell.dateKey ? "cal-day-hover" : "",
                      ].join(" ")}
                      onMouseEnter={() => setHoveredDay(cell.dateKey)}
                      onMouseLeave={() => setHoveredDay(null)}
                      onClick={() => {
                        if (cell.total > 0) {
                          onOpenActionModal(cell.isToday ? "today" : "active");
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
                    </div>
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
                  <span className="cal-legend-dot cal-legend-done" /> Semua selesai
                </div>
              </div>
            </div>
          ) : (
            <div className="heatmap-widget heatmap-widget-compact">
              {/* Month labels row */}
              <div
                className="heatmap-month-labels"
                style={{ gridTemplateColumns: `28px repeat(${heatmapData.WEEKS}, 1fr)` }}
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

              {/* Legend & Stats */}
              <div className="heatmap-footer">
                <div className="heatmap-legend">
                  <span className="heatmap-legend-label">Sedikit</span>
                  {[0, 1, 2, 3, 4].map((lvl) => (
                    <span key={lvl} className={`heatmap-legend-cell heatmap-level-${lvl}`} />
                  ))}
                  <span className="heatmap-legend-label">Banyak</span>
                </div>
                <div className="heatmap-stats">
                  <span className="heatmap-stat">
                    <Flame size={12} /> {completedTasks} selesai
                  </span>
                  <span className="heatmap-stat">
                    <Activity size={12} /> {totalTasks} total
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

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

          <div className="dashboard-spotlight-list">
            {(todayTasks.length > 0
              ? todayTasks
              : highPriorityTasks.length > 0
              ? highPriorityTasks
              : activeTasks.slice(0, 4)
            ).length > 0 ? (
              (todayTasks.length > 0
                ? todayTasks
                : highPriorityTasks.length > 0
                ? highPriorityTasks
                : activeTasks.slice(0, 4)
              ).map((t) => (
                <div key={t.id} className="spotlight-task-row">
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
                    onClick={() => onOpenTaskDetail(t)}
                    title="Klik untuk melihat detail tugas"
                  >
                    <strong>{t.title}</strong>
                    <div className="spotlight-meta">
                      <span className={`spotlight-cat cat-badge-${t.category.toLowerCase()}`}>
                        {t.category}
                      </span>
                      {t.priority === "high" && (
                        <span className="priority-label">Tinggi</span>
                      )}
                      {t.dueDate && (
                        <span className="spotlight-due">
                          <Clock3 size={11} /> {t.dueDate}
                        </span>
                      )}
                    </div>
                  </div>
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
            )}
          </div>

          <button
            type="button"
            className="panel-view-all-btn"
            onClick={() => onOpenActionModal("today")}
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
              <p>Kelompok terpisah Work, Personal, Study dengan rincian prioritas</p>
            </div>
          </div>

          <div className="category-cluster-list">
            {categoryClusterStats.map((cat) => {
              const IconComp = cat.icon;
              const pct = cat.total > 0 ? Math.round((cat.completed / cat.total) * 100) : 0;
              return (
                <div
                  key={cat.name}
                  className={`category-cluster-card cat-theme-${cat.colorKey}`}
                  onClick={() => onOpenActionModal("category", cat.name)}
                  title={`Klik untuk buka pop-up aksi kategori ${cat.name}`}
                >
                  <div className="cluster-header">
                    <div className="cluster-title-wrap">
                      <span className={`cluster-icon-badge icon-${cat.colorKey}`}>
                        <IconComp size={15} />
                      </span>
                      <div>
                        <strong className="cluster-name">{cat.name}</strong>
                        <span className="cluster-sub">{cat.label}</span>
                      </div>
                    </div>

                    <div className="cluster-chips">
                      {cat.today > 0 && (
                        <span className="cluster-chip chip-today" title="Jatuh tempo hari ini">
                          <Sun size={10} /> {cat.today} Hari ini
                        </span>
                      )}
                      {cat.highPriority > 0 && (
                        <span className="cluster-chip chip-high" title="Prioritas tinggi">
                          <Flame size={10} /> {cat.highPriority} Mendesak
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="cluster-stats-row">
                    <span className="cluster-stat-val">
                      <strong>{cat.active}</strong> aktif · <strong>{cat.completed}</strong> selesai
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
                </div>
              );
            })}
          </div>

          <div className="category-footnote">
            Tip: Setiap kartu memiliki pembeda warna & status prioritas. Klik untuk membuka modal aksi.
          </div>
        </section>
      </div>
    </motion.div>
  );
}
