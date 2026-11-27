import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palette,
  LayoutGrid,
  List,
  AlignJustify,
  Check,
  X,
  RotateCcw,
  Quote,
  Eye,
  SlidersHorizontal,
} from "lucide-react";
import type { LayoutMode, ThemeId, ThemePreferences } from "../types";

interface ThemeDashboardMenuProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: ThemePreferences;
  onSelectTheme: (theme: ThemeId) => void;
  onSelectLayout: (layout: LayoutMode) => void;
  onToggleMotto: () => void;
  onReset: () => void;
}

const themeOptions: {
  id: ThemeId;
  name: string;
  desc: string;
  primary: string;
  bg: string;
}[] = [
  {
    id: "sage",
    name: "Sage Minimal",
    desc: "Nuansa hijau tenang & sejuk asli ruang.",
    primary: "#397a60",
    bg: "#f7f8f6",
  },
  {
    id: "dark",
    name: "Malam Teduh",
    desc: "Dark mode arang lembut, nyaman di mata.",
    primary: "#4da884",
    bg: "#161b22",
  },
  {
    id: "warm",
    name: "Kertas Hangat",
    desc: "Sentuhan sepia & krem seperti buku catatan.",
    primary: "#ba663e",
    bg: "#fbf8f3",
  },
  {
    id: "ocean",
    name: "Nordic Slate",
    desc: "Aksen biru hening & modern teratur.",
    primary: "#2e6f9e",
    bg: "#f2f6fa",
  },
  {
    id: "lavender",
    name: "Lavender Tenang",
    desc: "Lilac pastel lembut untuk pikiran jernih.",
    primary: "#6c5b96",
    bg: "#f8f5fc",
  },
];

const layoutOptions: {
  id: LayoutMode;
  title: string;
  desc: string;
  icon: React.ElementType;
}[] = [
  {
    id: "list",
    title: "Daftar Rapi",
    desc: "Tampilan baris teratur & luas",
    icon: List,
  },
  {
    id: "grid",
    title: "Kartu Grid / Notes",
    desc: "Kartu sticky board interaktif",
    icon: LayoutGrid,
  },
  {
    id: "compact",
    title: "Kompak Skim",
    desc: "Rapat & efisien untuk tugas banyak",
    icon: AlignJustify,
  },
];

export function ThemeDashboardMenu({
  isOpen,
  onClose,
  preferences,
  onSelectTheme,
  onSelectLayout,
  onToggleMotto,
  onReset,
}: ThemeDashboardMenuProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="theme-menu-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />

          {/* Panel Popover */}
          <motion.div
            className="theme-dashboard-panel"
            initial={{ opacity: 0, scale: 0.94, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            role="dialog"
            aria-modal="true"
            aria-label="Pengaturan Tampilan & Tata Letak"
          >
            <div className="theme-panel-header">
              <div className="theme-panel-title">
                <span className="theme-panel-icon">
                  <SlidersHorizontal size={15} />
                </span>
                <div>
                  <h3>Tampilan & Tata Letak</h3>
                  <p>Sesuaikan ruang kerjamu agar terasa lebih tenang</p>
                </div>
              </div>
              <button
                type="button"
                className="theme-panel-close"
                onClick={onClose}
                aria-label="Tutup panel"
              >
                <X size={16} />
              </button>
            </div>

            <div className="theme-panel-body">
              {/* Section 1: Tema Warna */}
              <div className="theme-panel-section">
                <div className="section-label-row">
                  <span className="section-label">
                    <Palette size={12} /> TEMA WARNA
                  </span>
                  <span className="section-hint">Tersimpan otomatis</span>
                </div>
                <div className="theme-swatches-grid">
                  {themeOptions.map((opt) => {
                    const isSelected = preferences.theme === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={`theme-swatch-card ${
                          isSelected ? "active" : ""
                        }`}
                        onClick={() => onSelectTheme(opt.id)}
                      >
                        <span
                          className="theme-color-preview"
                          style={{
                            background: opt.bg,
                            borderColor: opt.primary,
                          }}
                        >
                          <span
                            className="theme-dot"
                            style={{ background: opt.primary }}
                          />
                        </span>
                        <div className="theme-swatch-info">
                          <strong>{opt.name}</strong>
                          <small>{opt.desc}</small>
                        </div>
                        {isSelected && (
                          <span className="theme-selected-mark">
                            <Check size={13} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Mode Tata Letak */}
              <div className="theme-panel-section">
                <div className="section-label-row">
                  <span className="section-label">
                    <LayoutGrid size={12} /> TATA LETAK TUGAS
                  </span>
                </div>
                <div className="layout-options-grid">
                  {layoutOptions.map((layout) => {
                    const Icon = layout.icon;
                    const isSelected = preferences.layout === layout.id;
                    return (
                      <button
                        key={layout.id}
                        type="button"
                        className={`layout-option-card ${
                          isSelected ? "active" : ""
                        }`}
                        onClick={() => onSelectLayout(layout.id)}
                      >
                        <Icon size={17} className="layout-card-icon" />
                        <div>
                          <strong>{layout.title}</strong>
                          <small>{layout.desc}</small>
                        </div>
                        {isSelected && (
                          <span className="layout-active-indicator">
                            <Check size={12} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 3: Tampilan Widget */}
              <div className="theme-panel-section">
                <div className="section-label-row">
                  <span className="section-label">
                    <Eye size={12} /> VISIBILITAS ELEMEN
                  </span>
                </div>
                <div className="widget-toggle-list">
                  <label className="widget-toggle-item">
                    <div className="widget-toggle-info">
                      <Quote size={14} />
                      <div>
                        <strong>Motto & Kutipan Tenang</strong>
                        <small>Pesan di footer untuk fokus</small>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.showMotto}
                      onChange={onToggleMotto}
                      aria-label="Tampilkan kutipan motto"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="theme-panel-footer">
              <button
                type="button"
                className="theme-reset-button"
                onClick={onReset}
              >
                <RotateCcw size={13} />
                <span>Kembalikan Default</span>
              </button>
              <button
                type="button"
                className="button-primary theme-done-button"
                onClick={onClose}
              >
                Selesai
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
