import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import {
  GripHorizontal,
  X,
  Pin,
  Palette,
  ExternalLink,
  Minimize2,
  Maximize2,
  Trash2,
  Sparkles,
} from "lucide-react";
import type { NoteColor } from "../types";

export interface NoteData {
  id: string;
  title: string;
  content: string;
  color?: NoteColor;
  pinned?: boolean;
  category?: string;
}

interface DraggableNoteModalProps {
  note: NoteData;
  onClose: () => void;
  onSave: (updates: {
    title: string;
    content: string;
    color: NoteColor;
    pinned?: boolean;
  }) => void;
  onDelete?: () => void;
}

const noteColors: {
  id: NoteColor;
  label: string;
  bg: string;
  border: string;
  header: string;
  text: string;
}[] = [
  {
    id: "yellow",
    label: "Kuning Lembut",
    bg: "#fffdf0",
    border: "#f3e79b",
    header: "#fef9d8",
    text: "#463d1e",
  },
  {
    id: "sage",
    label: "Sage Alam",
    bg: "#f3f8f5",
    border: "#cde3d4",
    header: "#e2efe6",
    text: "#293e32",
  },
  {
    id: "blue",
    label: "Biru Langit",
    bg: "#f1f7fc",
    border: "#c8e2f8",
    header: "#dfedf9",
    text: "#223d53",
  },
  {
    id: "peach",
    label: "Peach Hangat",
    bg: "#fff5f0",
    border: "#fbd2c2",
    header: "#fde3d6",
    text: "#52372c",
  },
  {
    id: "lavender",
    label: "Lavender Lembut",
    bg: "#f7f4fc",
    border: "#ded4f6",
    header: "#ede6f8",
    text: "#3d3056",
  },
];

export function DraggableNoteModal({
  note,
  onClose,
  onSave,
  onDelete,
}: DraggableNoteModalProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [activeColor, setActiveColor] = useState<NoteColor>(note.color || "yellow");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isPinned, setIsPinned] = useState(note.pinned || false);
  const [isMinimized, setIsMinimized] = useState(false);
  const dragControls = useDragControls();
  const [isSaving, setIsSaving] = useState(false);
  const noteRef = useRef<HTMLDivElement>(null);

  // Sync state if note changes
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    if (note.color) setActiveColor(note.color);
    if (note.pinned !== undefined) setIsPinned(note.pinned);
  }, [note]);

  // Handle ESC key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isPinned && !isMinimized) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isPinned, isMinimized]);

  const currentColorStyle =
    noteColors.find((c) => c.id === activeColor) || noteColors[0];

  const supportsPiP =
    typeof window !== "undefined" && "documentPictureInPicture" in window;

  const openDesktopPiP = async () => {
    // If running in Desktop app (Electron)
    // @ts-expect-error electronAPI on window
    if (window.electronAPI?.openDesktopNote) {
      // @ts-expect-error electronAPI on window
      window.electronAPI.openDesktopNote({
        id: note.id,
        title: title.trim() || "Catatan",
        notes: content.trim(),
        color: currentColorStyle.bg,
        category: note.category || "Catatan",
      });
      onClose();
      return;
    }

    if (!supportsPiP) {
      alert(
        "Browser ini belum mendukung Document Picture-in-Picture. Gunakan Chrome/Edge terbaru atau jalankan versi Desktop .exe."
      );
      return;
    }
    try {
      // @ts-expect-error experimental browser API
      const pipWindow = await window.documentPictureInPicture.requestWindow({
        width: 340,
        height: 400,
      });

      pipWindow.document.title = `ruang. — ${title || "Catatan"}`;
      pipWindow.document.body.style.margin = "0";
      pipWindow.document.body.style.padding = "16px";
      pipWindow.document.body.style.background = currentColorStyle.bg;
      pipWindow.document.body.style.color = currentColorStyle.text;
      pipWindow.document.body.style.fontFamily = "DM Sans, sans-serif";
      pipWindow.document.body.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid ${currentColorStyle.border}; padding-bottom:6px;">
          <strong style="font-size:10px; text-transform:uppercase; letter-spacing:0.8px;">📌 Catatan Desktop Always-On-Top</strong>
        </div>
        <h3 style="margin:0 0 8px; font-size:16px; font-family:sans-serif;">${title}</h3>
        <p style="margin:0; font-size:12px; line-height:1.5; white-space:pre-wrap;">${content || "(Tanpa catatan)"}</p>
        <div style="font-size:9px; opacity:0.6; margin-top:20px; border-top:1px solid ${currentColorStyle.border}; padding-top:8px;">
          Jendela ini melayang di atas semua aplikasi desktop Windows.
        </div>
      `;
      onClose();
    } catch (err) {
      console.error("Gagal membuka Desktop PiP:", err);
    }
  };

  const handleBlurSave = () => {
    if (title.trim() === note.title && content.trim() === note.content) return;
    setIsSaving(true);
    onSave({
      title: title.trim() || note.title,
      content: content.trim(),
      color: activeColor,
      pinned: isPinned,
    });
    setTimeout(() => setIsSaving(false), 300);
  };

  const handleColorChange = (color: NoteColor) => {
    setActiveColor(color);
    setShowColorPicker(false);
    onSave({
      title: title.trim() || note.title,
      content: content.trim(),
      color,
      pinned: isPinned,
    });
  };

  const handleTogglePin = () => {
    const nextPin = !isPinned;
    setIsPinned(nextPin);
    onSave({
      title: title.trim() || note.title,
      content: content.trim(),
      color: activeColor,
      pinned: nextPin,
    });
  };

  return (
    <AnimatePresence>
      <div
        className={`draggable-note-overlay ${
          isPinned || isMinimized ? "pinned-overlay" : ""
        }`}
      >
        {/* Semi-transparent backdrop only when not pinned and not minimized */}
        {!isPinned && !isMinimized && (
          <motion.div
            className="draggable-note-backdrop"
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
            className="minimized-floating-pill"
            drag
            dragMomentum={false}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            style={{
              backgroundColor: currentColorStyle.bg,
              borderColor: currentColorStyle.border,
              color: currentColorStyle.text,
            }}
          >
            <div className="pill-grip">
              <GripHorizontal size={14} />
            </div>
            <span className="pill-dot" style={{ background: currentColorStyle.header }} />
            <strong className="pill-title">{title || "Catatan"}</strong>
            <button
              type="button"
              className="pill-action-btn"
              title="Perbesar / Buka kembali catatan"
              onClick={() => setIsMinimized(false)}
            >
              <Maximize2 size={13} />
            </button>
            <button
              type="button"
              className="pill-action-btn"
              title="Tutup catatan"
              onClick={onClose}
            >
              <X size={13} />
            </button>
          </motion.div>
        ) : (
          /* ========================================================
             CASE B: EXPANDED FULL STICKY NOTE MODAL
             ======================================================== */
          <motion.div
            ref={noteRef}
            className="draggable-note-card"
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            dragElastic={0.08}
            initial={{ scale: 0.9, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 350, damping: 26 }}
            style={{
              backgroundColor: currentColorStyle.bg,
              borderColor: currentColorStyle.border,
              color: currentColorStyle.text,
            }}
          >
            {/* Header / Drag Bar */}
            <div
              className="draggable-note-header"
              onPointerDown={(e) => dragControls.start(e)}
              style={{
                backgroundColor: currentColorStyle.header,
                borderBottomColor: currentColorStyle.border,
              }}
            >
              <div
                className="note-drag-handle"
                title="Geser catatan ini ke mana saja di layar"
              >
                <GripHorizontal size={18} />
                <span className="note-drag-hint">Catatan Tempel</span>
              </div>

              <div className="note-header-actions">
                {/* Color Swatch Picker */}
                <div className="note-color-picker-wrap">
                  <button
                    type="button"
                    className="note-header-btn"
                    title="Ubah warna kertas"
                    onClick={() => setShowColorPicker(!showColorPicker)}
                  >
                    <Palette size={14} />
                  </button>

                  {showColorPicker && (
                    <div className="note-color-dropdown">
                      {noteColors.map((col) => (
                        <button
                          key={col.id}
                          type="button"
                          className={`note-color-circle ${
                            activeColor === col.id ? "active" : ""
                          }`}
                          style={{
                            backgroundColor: col.header,
                            borderColor: col.border,
                          }}
                          title={col.label}
                          onClick={() => handleColorChange(col.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Pin Toggle */}
                <button
                  type="button"
                  className={`note-header-btn ${isPinned ? "is-pinned" : ""}`}
                  title={
                    isPinned
                      ? "Lepaskan pin (modal biasa)"
                      : "Pin ke layar (tetap melayang tanpa backdrop)"
                  }
                  onClick={handleTogglePin}
                >
                  <Pin size={14} />
                </button>

                {/* Desktop PiP Toggle */}
                <button
                  type="button"
                  className="note-header-btn note-pip-btn"
                  title="Buka melayang di Desktop Windows (Always-on-Top di luar browser)"
                  onClick={openDesktopPiP}
                >
                  <ExternalLink size={14} />
                </button>

                {/* Minimize / Perkecil Button */}
                <button
                  type="button"
                  className="note-header-btn"
                  title="Perkecil jadi widget melayang (jika layar penuh)"
                  onClick={() => setIsMinimized(true)}
                >
                  <Minimize2 size={14} />
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  className="note-header-btn note-close-btn"
                  title="Tutup (Esc)"
                  onClick={onClose}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Content Body (Pure Note Editor) */}
            <div className="draggable-note-content">
              <div className="note-meta-row">
                <span className="note-pure-badge">
                  <Sparkles size={11} /> Catatan Bebas (Tanpa Progress)
                </span>
                {isSaving && (
                  <span className="note-saving-indicator">Menyimpan...</span>
                )}
              </div>

              {/* Editable Title */}
              <div className="note-title-wrap">
                <input
                  className="note-title-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleBlurSave}
                  placeholder="Judul catatan tempel..."
                  style={{ color: currentColorStyle.text }}
                />
              </div>

              {/* Editable Content */}
              <div className="note-body-wrap">
                <textarea
                  className="note-body-textarea"
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onBlur={handleBlurSave}
                  placeholder="Tulis ide, memo, atau catatan cepat di sini..."
                  style={{ color: currentColorStyle.text }}
                />
              </div>
            </div>

            {/* Note Footer */}
            <div
              className="draggable-note-footer"
              style={{ borderTopColor: currentColorStyle.border }}
            >
              <span className="note-footer-chars">
                {content.length} karakter
              </span>

              <div className="note-footer-actions">
                {onDelete && (
                  <button
                    type="button"
                    className="note-delete-btn"
                    title="Hapus catatan tempel ini"
                    onClick={() => {
                      onDelete();
                      onClose();
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Hapus</span>
                  </button>
                )}
                <button
                  type="button"
                  className="button-quiet note-minimize-link"
                  onClick={() => setIsMinimized(true)}
                >
                  <Minimize2 size={12} /> Perkecil
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
}
