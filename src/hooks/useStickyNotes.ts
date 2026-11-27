import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import type { NoteColor, StickyNote } from "../types";

const LEGACY_STORAGE_KEY = "ruang_sticky_notes_v1";

function getUserCacheKey(userId: string) {
  return `ruang_sticky_notes_v2_${userId}`;
}

function getMigratedFlagKey(userId: string) {
  return `ruang_sticky_notes_migrated_${userId}`;
}

const initialDefaultNotes: StickyNote[] = [
  {
    id: "note-welcome",
    title: "Ide & Catatan Penting",
    content:
      "Catatan ini bebas dan tidak ada centang selesai. Bisa di-drag melayang, diubah warna, atau diperkecil saat layar penuh!",
    color: "yellow",
    pinned: true,
    createdAt: Date.now(),
  },
];

function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  );
}

function loadCachedNotes(userId?: string): StickyNote[] {
  if (!userId) return [];
  try {
    const cached = localStorage.getItem(getUserCacheKey(userId));
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed as StickyNote[];
    }
  } catch {
    // ignore JSON error
  }
  return [];
}

export function useStickyNotes(userId?: string) {
  const [state, setState] = useState<{
    ownerId: string | undefined;
    items: StickyNote[];
  }>(() => ({
    ownerId: userId,
    items: loadCachedNotes(userId),
  }));

  const notes = useMemo(
    () => (state.ownerId === userId ? state.items : loadCachedNotes(userId)),
    [state, userId]
  );

  const setNotes = useCallback(
    (updater: StickyNote[] | ((prev: StickyNote[]) => StickyNote[])) => {
      setState((prev) => {
        const current =
          prev.ownerId === userId ? prev.items : loadCachedNotes(userId);
        const nextItems =
          typeof updater === "function" ? updater(current) : updater;
        return { ownerId: userId, items: nextItems };
      });
    },
    [userId]
  );

  useEffect(() => {
    const client = supabase;
    if (!userId || !client) return;

    let cancelled = false;

    async function loadFromSupabase() {
      if (!client || !userId) return;
      const { data, error } = await client
        .from("sticky_notes")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error || cancelled) return;

      let rows: StickyNote[] = (data ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        content: r.content,
        color: r.color,
        pinned: r.pinned,
        createdAt: new Date(r.created_at).getTime(),
      }));

      // One-time migration from legacy un-namespaced localStorage
      const migratedFlag = localStorage.getItem(getMigratedFlagKey(userId));
      if (!migratedFlag) {
        try {
          const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
          if (legacyRaw && rows.length === 0) {
            const legacy = JSON.parse(legacyRaw) as StickyNote[];
            if (Array.isArray(legacy) && legacy.length > 0) {
              const toInsert = legacy.map((n) => ({
                id: isValidUuid(n.id) ? n.id : crypto.randomUUID(),
                user_id: userId,
                title: n.title || "Catatan",
                content: n.content || "",
                color: n.color || "yellow",
                pinned: Boolean(n.pinned),
              }));
              const { data: inserted } = await client
                .from("sticky_notes")
                .insert(toInsert)
                .select();
              if (inserted && !cancelled) {
                rows = inserted.map((r) => ({
                  id: r.id,
                  title: r.title,
                  content: r.content,
                  color: r.color,
                  pinned: r.pinned,
                  createdAt: new Date(r.created_at).getTime(),
                }));
              }
            }
          }
          localStorage.setItem(getMigratedFlagKey(userId), "1");
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch {
          // ignore migration parse error
        }
      }

      if (rows.length === 0 && !migratedFlag) {
        rows = initialDefaultNotes;
      }

      if (!cancelled) {
        setNotes(rows);
        try {
          localStorage.setItem(getUserCacheKey(userId), JSON.stringify(rows));
        } catch {
          // ignore quota
        }
      }
    }

    loadFromSupabase();

    // Minimal realtime subscription for sticky_notes
    const channel = client
      .channel(`sticky-notes-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sticky_notes",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT" && payload.new) {
            const r = payload.new as {
              id: string;
              title: string;
              content: string;
              color: NoteColor;
              pinned: boolean;
              created_at: string;
            };
            const item: StickyNote = {
              id: r.id,
              title: r.title,
              content: r.content,
              color: r.color,
              pinned: r.pinned,
              createdAt: new Date(r.created_at).getTime(),
            };
            setNotes((prev) =>
              prev.some((n) => n.id === item.id) ? prev : [item, ...prev]
            );
          } else if (payload.eventType === "UPDATE" && payload.new) {
            const r = payload.new as {
              id: string;
              title: string;
              content: string;
              color: NoteColor;
              pinned: boolean;
            };
            setNotes((prev) =>
              prev.map((n) =>
                n.id === r.id
                  ? {
                      ...n,
                      title: r.title,
                      content: r.content,
                      color: r.color,
                      pinned: r.pinned,
                    }
                  : n
              )
            );
          } else if (payload.eventType === "DELETE" && payload.old) {
            const oldId = (payload.old as { id?: string }).id;
            if (oldId) {
              setNotes((prev) => prev.filter((n) => n.id !== oldId));
            }
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      client.removeChannel(channel);
    };
  }, [userId, setNotes]);

  useEffect(() => {
    if (!userId) return;
    try {
      localStorage.setItem(getUserCacheKey(userId), JSON.stringify(notes));
    } catch {
      // ignore write error
    }
  }, [notes, userId]);

  const addNote = useCallback(
    (draft?: Partial<StickyNote>) => {
      const newNote: StickyNote = {
        id: crypto.randomUUID(),
        title: draft?.title || "Catatan Baru",
        content: draft?.content || "",
        color: draft?.color || "yellow",
        pinned: draft?.pinned ?? false,
        createdAt: Date.now(),
      };
      setNotes((prev) => [newNote, ...prev]);

      if (supabase && userId) {
        supabase
          .from("sticky_notes")
          .insert({
            id: newNote.id,
            user_id: userId,
            title: newNote.title,
            content: newNote.content,
            color: newNote.color,
            pinned: newNote.pinned,
          })
          .then(({ error }) => {
            if (error)
              console.error("sticky_notes insert error:", error.message);
          });
      }
      return newNote;
    },
    [userId, setNotes]
  );

  const updateNote = useCallback(
    (id: string, updates: Partial<Omit<StickyNote, "id">>) => {
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, ...updates } : n))
      );
      if (supabase && userId && isValidUuid(id)) {
        supabase
          .from("sticky_notes")
          .update({
            ...(updates.title !== undefined ? { title: updates.title } : {}),
            ...(updates.content !== undefined
              ? { content: updates.content }
              : {}),
            ...(updates.color !== undefined ? { color: updates.color } : {}),
            ...(updates.pinned !== undefined ? { pinned: updates.pinned } : {}),
          })
          .eq("id", id)
          .eq("user_id", userId)
          .then(({ error }) => {
            if (error)
              console.error("sticky_notes update error:", error.message);
          });
      }
    },
    [userId, setNotes]
  );

  const deleteNote = useCallback(
    (id: string) => {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (supabase && userId && isValidUuid(id)) {
        supabase
          .from("sticky_notes")
          .delete()
          .eq("id", id)
          .eq("user_id", userId)
          .then(({ error }) => {
            if (error)
              console.error("sticky_notes delete error:", error.message);
          });
      }
    },
    [userId, setNotes]
  );

  const togglePinNote = useCallback(
    (id: string) => {
      setNotes((prev) => {
        const target = prev.find((n) => n.id === id);
        const nextPinned = target ? !target.pinned : true;
        if (supabase && userId && isValidUuid(id)) {
          supabase
            .from("sticky_notes")
            .update({ pinned: nextPinned })
            .eq("id", id)
            .eq("user_id", userId)
            .then(({ error }) => {
              if (error)
                console.error("sticky_notes pin error:", error.message);
            });
        }
        return prev.map((n) =>
          n.id === id ? { ...n, pinned: nextPinned } : n
        );
      });
    },
    [userId, setNotes]
  );

  const changeNoteColor = useCallback(
    (id: string, color: NoteColor) => {
      updateNote(id, { color });
    },
    [updateNote]
  );

  return {
    notes,
    addNote,
    updateNote,
    deleteNote,
    togglePinNote,
    changeNoteColor,
  };
}
