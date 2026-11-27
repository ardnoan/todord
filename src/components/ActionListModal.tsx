import React, { useState, useRef } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import {
  GripHorizontal,
  X,
  Check,
  Plus,
  Minimize2,
  Maximize2,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Clock3,
  ListTodo,
} from "lucide-react";
import type { LayoutMode, Task } from "../types";
import { useIsMobile } from "../hooks/useIsMobile";
import { useDialogA11y } from "../hooks/useDialogA11y";
import { getLocalDateString } from "../lib/date";

interface ActionListModalProps {
  isOpen: boolean;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  tasks: Task[];
  taskCategories?: string[];
  taskLayout?: LayoutMode;
  defaultCategory?: string;
  isCategoryLocked?: boolean;
  onToggleTask: (task: Task) => Promise<void>;
  onOpenTaskDetail: (task: Task) => void;
  onAddTask?: (title: string, category: string) => Promise<void>;
  onMoveTask?: (
    taskId: string,
    direction: "up" | "down",
    visibleIds: string[]
  ) => void;
  onClose: () => void;
}

export function ActionListModal({
  isOpen,
  title,
  subtitle,
  icon: Icon,
  tasks,
  taskCategories = ["Personal", "Work", "Study"],
  taskLayout = "list",
  defaultCategory = "Work",
  isCategoryLocked = false,
  onToggleTask,
  onOpenTaskDetail,
  onAddTask,
  onMoveTask,
  onClose,
}: ActionListModalProps) {
  const isMobile = useIsMobile();
  const [isMinimized, setIsMinimized] = useState(false);
  const effectiveMinimized = !isMobile && isMinimized;
  const [quickTitle, setQuickTitle] = useState("");
  const [taskCategory, setTaskCategory] = useState<string>(defaultCategory);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dragControls = useDragControls();
  const cardRef = useRef<HTMLDivElement>(null);
  const todayStr = getLocalDateString();

  useDialogA11y(isOpen && !effectiveMinimized, onClose, cardRef);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = quickTitle.trim();
    if (!clean || !onAddTask || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onAddTask(clean, taskCategory);
      setQuickTitle("");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className={`action-modal-overlay ${effectiveMinimized ? "is-minimized-overlay" : ""}`}
      >
        {/* Semi-transparent backdrop only when not minimized */}
        {!effectiveMinimized && (
          <motion.div
            className="action-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
        )}

        {/* ========================================================
            CASE A: MINIMIZED PILL (Ketika diperkecil agar tidak penuh)
            ======================================================== */}
        {effectiveMinimized ? (
          <motion.div
            className="action-minimized-pill"
            drag
            dragMomentum={false}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            title="Tarik untuk memindahkan atau klik untuk memperbesar"
          >
            <div className="action-pill-grip">
              <GripHorizontal size={14} />
            </div>
            <span className="action-pill-icon">
              <Icon size={14} />
            </span>
            <strong className="action-pill-title">{title}</strong>
            <span className="action-pill-count">{tasks.length}</span>
            <button
              type="button"
              className="action-pill-btn"
              title="Perbesar / Buka kembali aksi"
              onClick={() => setIsMinimized(false)}
            >
              <Maximize2 size={13} />
            </button>
            <button
              type="button"
              className="action-pill-btn"
              title="Tutup"
              onClick={onClose}
            >
              <X size={13} />
            </button>
          </motion.div>
        ) : (
          /* ========================================================
             CASE B: FULL DRAGGABLE ACTION CARD MODAL
             ======================================================== */
          <motion.div
            ref={cardRef}
            className="action-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="action-modal-title"
            drag={!isMobile}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={
              typeof window !== "undefined"
                ? {
                    left: -Math.max(0, window.innerWidth / 2 - 220),
                    right: Math.max(0, window.innerWidth / 2 - 220),
                    top: -Math.max(0, window.innerHeight / 2 - 220),
                    bottom: Math.max(0, window.innerHeight / 2 - 220),
                  }
                : undefined
            }
            dragMomentum={false}
            dragElastic={0.08}
            initial={
              isMobile
                ? { y: 40, opacity: 0 }
                : { scale: 0.92, opacity: 0, y: 15 }
            }
            animate={
              isMobile ? { y: 0, opacity: 1 } : { scale: 1, opacity: 1, y: 0 }
            }
            exit={
              isMobile
                ? { y: 40, opacity: 0 }
                : { scale: 0.92, opacity: 0, y: 10 }
            }
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
          >
            {/* Header / Drag Grip */}
            <div
              className="action-modal-header"
              onPointerDown={(e) => {
                if (!isMobile) dragControls.start(e);
              }}
            >
              <div
                className="action-drag-handle"
                title="Geser kartu aksi ini ke mana saja di layar"
              >
                {!isMobile && <GripHorizontal size={17} />}
                <div className="action-header-text">
                  <span id="action-modal-title" className="action-header-badge">
                    <Icon size={13} />
                    <span>{title}</span>
                  </span>
                  <small>{subtitle}</small>
                </div>
              </div>

              <div className="action-modal-controls">
                {!isMobile && (
                  <button
                    type="button"
                    className="action-control-btn"
                    title="Perkecil jadi widget melayang (jika layar penuh)"
                    onClick={() => setIsMinimized(true)}
                  >
                    <Minimize2 size={14} />
                  </button>
                )}
                <button
                  type="button"
                  className="action-control-btn action-close-btn"
                  title="Tutup (Esc)"
                  aria-label="Tutup"
                  onClick={onClose}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Quick Add Form inside modal */}
            {onAddTask && (
              <form onSubmit={handleAdd} className="action-quick-add-form">
                <select
                  value={taskCategory}
                  onChange={(e) => setTaskCategory(e.target.value)}
                  disabled={isCategoryLocked}
                  className="action-category-select"
                  title={
                    isCategoryLocked
                      ? `Kategori dikunci ke ${taskCategory} sesuai tab aktif`
                      : "Pilih kategori tugas"
                  }
                >
                  {taskCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  {!taskCategories.includes(taskCategory) && (
                    <option value={taskCategory}>{taskCategory}</option>
                  )}
                </select>
                <input
                  type="text"
                  placeholder={`Tambah tugas baru di ${taskCategory}...`}
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  className="action-quick-input"
                />
                <button
                  type="submit"
                  disabled={!quickTitle.trim() || isSubmitting}
                  className="action-quick-submit"
                  title="Tambah tugas"
                >
                  <Plus size={14} />
                </button>
              </form>
            )}

            {/* Tasks List */}
            <div className={`action-modal-list layout-${taskLayout}`}>
              {tasks.length > 0 ? (
                tasks.map((task, index) => (
                  <div
                    key={task.id}
                    className={`action-task-item ${task.completed ? "completed" : ""}`}
                  >
                    <span
                      className="task-order-badge"
                      title={`Urutan #${index + 1}`}
                    >
                      {index + 1}
                    </span>

                    <button
                      type="button"
                      className={`task-check ${task.completed ? "checked" : ""}`}
                      onClick={() => onToggleTask(task)}
                      title={
                        task.completed
                          ? "Tandai belum selesai"
                          : "Tandai selesai"
                      }
                    >
                      {task.completed && <Check size={12} />}
                    </button>

                    <div
                      className="action-task-info"
                      role="button"
                      tabIndex={0}
                      onClick={() => onOpenTaskDetail(task)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onOpenTaskDetail(task);
                        }
                      }}
                      title="Klik untuk melihat detail tugas"
                    >
                      <span className="action-task-title">{task.title}</span>
                      <div className="action-task-meta">
                        <span className="action-task-cat">{task.category}</span>
                        {task.dueDate && (
                          <span
                            className={`action-task-due ${task.dueDate < todayStr && !task.completed ? "overdue-badge" : ""}`}
                          >
                            <Clock3 size={11} /> {task.dueDate}
                            {task.dueDate < todayStr &&
                              !task.completed &&
                              " · Terlambat"}
                          </span>
                        )}
                        {task.subtasks.length > 0 && (
                          <span className="action-task-sub">
                            <ListTodo size={11} />{" "}
                            {task.subtasks.filter((s) => s.completed).length}/
                            {task.subtasks.length}
                          </span>
                        )}
                      </div>
                    </div>

                    {onMoveTask && tasks.length > 1 && (
                      <div className="task-reorder-controls">
                        <button
                          type="button"
                          className="task-reorder-btn"
                          disabled={index === 0}
                          onClick={() =>
                            onMoveTask(
                              task.id,
                              "up",
                              tasks.map((t) => t.id)
                            )
                          }
                          title="Pindah ke atas"
                          aria-label={`Pindah ${task.title} ke atas`}
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          className="task-reorder-btn"
                          disabled={index === tasks.length - 1}
                          onClick={() =>
                            onMoveTask(
                              task.id,
                              "down",
                              tasks.map((t) => t.id)
                            )
                          }
                          title="Pindah ke bawah"
                          aria-label={`Pindah ${task.title} ke bawah`}
                        >
                          <ArrowDown size={12} />
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      className="action-task-edit-btn"
                      onClick={() => onOpenTaskDetail(task)}
                      title="Buka form detail"
                    >
                      <ArrowRight size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="action-empty-state">
                  <p>Tidak ada tugas di daftar ini.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="action-modal-footer">
              <span className="action-footer-count">
                Total: <strong>{tasks.length}</strong> tugas
              </span>
              {!isMobile && (
                <button
                  type="button"
                  className="button-quiet action-minimize-btn"
                  onClick={() => setIsMinimized(true)}
                >
                  <Minimize2 size={12} /> Perkecil ke Pojok
                </button>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
}
