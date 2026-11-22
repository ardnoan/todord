import { useState, useEffect } from "react";
import type { NoteColor, StickyNote } from "../types";

const STORAGE_KEY = "ruang_sticky_notes_v1";

const initialDefaultNotes: StickyNote[] = [
  {
    id: "note-welcome",
    title: "Ide & Catatan Penting",
    content: "Catatan ini bebas dan tidak ada centang selesai. Bisa di-drag melayang, diubah warna, atau diperkecil saat layar penuh!",
    color: "yellow",
    pinned: true,
    createdAt: Date.now(),
  },
];

export function useStickyNotes() {
  const [notes, setNotes] = useState<StickyNote[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore JSON error
    }
    return initialDefaultNotes;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch {
      // ignore write error
    }
  }, [notes]);

  const addNote = (draft?: Partial<StickyNote>) => {
    const newNote: StickyNote = {
      id: crypto.randomUUID(),
      title: draft?.title || "Catatan Baru",
      content: draft?.content || "",
      color: draft?.color || "yellow",
      pinned: draft?.pinned ?? false,
      createdAt: Date.now(),
    };
    setNotes((prev) => [newNote, ...prev]);
    return newNote;
  };

  const updateNote = (id: string, updates: Partial<Omit<StickyNote, "id">>) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...updates } : n))
    );
  };

  const deleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const togglePinNote = (id: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n))
    );
  };

  const changeNoteColor = (id: string, color: NoteColor) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, color } : n))
    );
  };

  return {
    notes,
    addNote,
    updateNote,
    deleteNote,
    togglePinNote,
    changeNoteColor,
  };
}
