import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, X, ShieldCheck } from "lucide-react";
import { useDialogA11y } from "../hooks/useDialogA11y";

interface LogoutConfirmModalProps {
  isOpen: boolean;
  userEmail?: string;
  onCancel: () => void;
  onConfirm: () => void;
  isLoggingOut: boolean;
}

export function LogoutConfirmModal({
  isOpen,
  userEmail,
  onCancel,
  onConfirm,
  isLoggingOut,
}: LogoutConfirmModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  useDialogA11y(
    isOpen,
    () => {
      if (!isLoggingOut) onCancel();
    },
    cardRef
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="modal-backdrop logout-modal-backdrop"
          onClick={onCancel}
        >
          <motion.div
            ref={cardRef}
            className="logout-modal-card"
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ type: "spring", stiffness: 450, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="logout-dialog-title"
          >
            <div className="logout-modal-header">
              <div className="logout-icon-wrap">
                <LogOut size={22} />
              </div>
              <button
                type="button"
                className="logout-close-btn"
                onClick={onCancel}
                aria-label="Batal keluar"
                disabled={isLoggingOut}
              >
                <X size={16} />
              </button>
            </div>

            <div className="logout-modal-body">
              <h2 id="logout-dialog-title">Keluar dari Ruang?</h2>
              <p>
                {userEmail ? (
                  <>
                    Kamu saat ini masuk sebagai <strong>{userEmail}</strong>.
                  </>
                ) : null}{" "}
                Semua tugas dan perubahanmu telah tersimpan aman di cloud. Kamu
                dapat masuk kembali kapan saja.
              </p>

              <div className="logout-sync-note">
                <ShieldCheck size={16} />
                <span>Data tersimpan privat & tersinkron</span>
              </div>
            </div>

            <div className="logout-modal-actions">
              <button
                type="button"
                className="button-quiet logout-cancel-btn"
                onClick={onCancel}
                disabled={isLoggingOut}
              >
                Tetap di Sini
              </button>
              <button
                type="button"
                className="button-primary logout-confirm-btn"
                onClick={onConfirm}
                disabled={isLoggingOut}
              >
                <LogOut size={14} />
                <span>{isLoggingOut ? "Keluar..." : "Ya, Keluar"}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
