import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import {
  GripHorizontal,
  X,
  Check,
  Plus,
  Minimize2,
  Maximize2,
  ArrowRight,
  Clock3,
  ListTodo,
} from "lucide-react";
import type { Task } from "../types";

interface ActionListModalProps {
  isOpen: boolean;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  tasks: Task[];
  defaultCategory?: string;
  onToggleTask: (task: Task) => Promise<void>;
  onOpenTaskDetail: (task: Task) => void;
  onAddTask?: (title: string, category: string) => Promise<void>;
  onClose: () => void;
}

export function ActionListModal({
  isOpen,
  title,
  subtitle,
  icon: Icon,
  tasks,
  defaultCategory = "Work",
  onToggleTask,
  onOpenTaskDetail,
  onAddTask,
  onClose,
}: ActionListModalProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [taskCategory, setTaskCategory] = useState<string>(defaultCategory);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dragControls = useDragControls();

  useEffect(() => {
    if (defaultCategory) {
      setTaskCategory(defaultCategory);
    }
  }, [defaultCategory]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen && !isMinimized) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isMinimized, onClose]);

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
      <div className={`action-modal-overlay ${isMinimized ? "is-minimized-overlay" : ""}`}>
        {/* Semi-transparent backdrop only when not minimized */}
        {!isMinimized && (
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
        {isMinimized ? (
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
            className="action-modal-card"
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            dragElastic={0.08}
            initial={{ scale: 0.92, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
          >
            {/* Header / Drag Grip */}
            <div
              className="action-modal-header"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="action-drag-handle" title="Geser kartu aksi ini ke mana saja di layar">
                <GripHorizontal size={17} />
                <div className="action-header-text">
                  <span className="action-header-badge">
                    <Icon size={13} />
                    <span>{title}</span>
                  </span>
                  <small>{subtitle}</small>
                </div>
              </div>

              <div className="action-modal-controls">
                <button
                  type="button"
                  className="action-control-btn"
                  title="Perkecil jadi widget melayang (jika layar penuh)"
                  onClick={() => setIsMinimized(true)}
                >
                  <Minimize2 size={14} />
                </button>
                <button
                  type="button"
                  className="action-control-btn action-close-btn"
                  title="Tutup (Esc)"
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
                  className="action-category-select"
                  title="Pilih kategori tugas (Work / Personal / Study)"
                >
                  <option value="Work">Work</option>
                  <option value="Personal">Personal</option>
                  <option value="Study">Study</option>
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
            <div className="action-modal-list">
              {tasks.length > 0 ? (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`action-task-item ${task.completed ? "completed" : ""}`}
                  >
                    <button
                      type="button"
                      className={`task-check ${task.completed ? "checked" : ""}`}
                      onClick={() => onToggleTask(task)}
                      title={task.completed ? "Tandai belum selesai" : "Tandai selesai"}
                    >
                      {task.completed && <Check size={12} />}
                    </button>

                    <div
                      className="action-task-info"
                      onClick={() => onOpenTaskDetail(task)}
                      title="Klik untuk melihat detail tugas"
                    >
                      <span className="action-task-title">{task.title}</span>
                      <div className="action-task-meta">
                        <span className="action-task-cat">{task.category}</span>
                        {task.dueDate && (
                          <span className="action-task-due">
                            <Clock3 size={11} /> {task.dueDate}
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
              <button
                type="button"
                className="button-quiet action-minimize-btn"
                onClick={() => setIsMinimized(true)}
              >
                <Minimize2 size={12} /> Perkecil ke Pojok
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
}
