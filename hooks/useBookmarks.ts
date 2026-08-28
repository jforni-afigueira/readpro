import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Bookmark } from '../types';

const STORAGE_PREFIX = 'leitor_pro_bookmarks_v1_';

export function useBookmarks(fileName: string, currentPage: number) {
  const storageKey = useMemo(() => {
    return fileName ? `${STORAGE_PREFIX}${encodeURIComponent(fileName)}` : null;
  }, [fileName]);

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [announcement, setAnnouncement] = useState<string>('');
  const announceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to announce changes to screen readers and show auto-dismissing toast
  const announce = useCallback((msg: string) => {
    if (announceTimerRef.current) {
      clearTimeout(announceTimerRef.current);
    }
    setAnnouncement('');
    // Slight delay to trigger aria-live change and re-render
    setTimeout(() => {
      setAnnouncement(msg);
      announceTimerRef.current = setTimeout(() => {
        setAnnouncement('');
      }, 3200);
    }, 50);
  }, []);

  useEffect(() => {
    return () => {
      if (announceTimerRef.current) {
        clearTimeout(announceTimerRef.current);
      }
    };
  }, []);

  // 1. Load bookmarks from localStorage
  useEffect(() => {
    if (!storageKey) {
      setBookmarks([]);
      return;
    }

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed: Bookmark[] = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setBookmarks(parsed);
          return;
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar marcadores do localStorage:', err);
    }
    setBookmarks([]);
  }, [storageKey]);

  // 2. Persist bookmarks to localStorage
  const saveToStorage = useCallback((items: Bookmark[]) => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch (err) {
      console.warn('Erro ao salvar marcadores no localStorage:', err);
    }
  }, [storageKey]);

  // Check if current page is bookmarked
  const currentPageBookmark = useMemo(() => {
    return bookmarks.find(b => b.page === currentPage) || null;
  }, [bookmarks, currentPage]);

  const isCurrentPageBookmarked = !!currentPageBookmark;

  // Add bookmark
  const addBookmark = useCallback((page: number, customTitle?: string, note?: string, snippet?: string) => {
    if (!fileName || page < 1) return;

    setBookmarks(prev => {
      // Check if already exists
      const existing = prev.find(b => b.page === page);
      if (existing) {
        // Update existing if needed
        const updated = prev.map(b => b.page === page ? {
          ...b,
          title: customTitle || b.title,
          note: note !== undefined ? note : b.note,
          snippet: snippet !== undefined ? snippet : b.snippet,
        } : b);
        saveToStorage(updated);
        announce(`Marcador da página ${page} atualizado.`);
        return updated;
      }

      const newBookmark: Bookmark = {
        id: `bm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        bookId: fileName,
        page,
        title: customTitle || `Marcador - Página ${page}`,
        note: note || '',
        snippet: snippet ? snippet.slice(0, 160).trim() : '',
        createdAt: Date.now(),
      };

      const next = [...prev, newBookmark].sort((a, b) => a.page - b.page);
      saveToStorage(next);
      announce(`Página ${page} adicionada aos marcadores.`);
      return next;
    });
  }, [fileName, saveToStorage, announce]);

  // Remove bookmark by ID or Page
  const removeBookmark = useCallback((identifier: string | number) => {
    setBookmarks(prev => {
      const target = typeof identifier === 'number'
        ? prev.find(b => b.page === identifier)
        : prev.find(b => b.id === identifier);

      if (!target) return prev;

      const next = prev.filter(b => b.id !== target.id);
      saveToStorage(next);
      announce(`Marcador da página ${target.page} removido.`);
      return next;
    });
  }, [saveToStorage, announce]);

  // Toggle current page bookmark
  const toggleCurrentPageBookmark = useCallback((snippet?: string, note?: string) => {
    if (currentPageBookmark) {
      removeBookmark(currentPageBookmark.id);
    } else {
      addBookmark(currentPage, undefined, note, snippet);
    }
  }, [currentPageBookmark, removeBookmark, addBookmark, currentPage]);

  // Update existing bookmark
  const updateBookmark = useCallback((id: string, updates: { title?: string; note?: string }) => {
    setBookmarks(prev => {
      const target = prev.find(b => b.id === id);
      if (!target) return prev;

      const next = prev.map(b => b.id === id ? { ...b, ...updates } : b);
      saveToStorage(next);
      announce(`Marcador da página ${target.page} modificado com sucesso.`);
      return next;
    });
  }, [saveToStorage, announce]);

  // Clear all bookmarks
  const clearAllBookmarks = useCallback(() => {
    setBookmarks([]);
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch (err) {
        console.warn('Erro ao limpar marcadores:', err);
      }
    }
    announce('Todos os marcadores deste livro foram excluídos.');
  }, [storageKey, announce]);

  // Jump helpers
  const getNextBookmark = useCallback((currPage: number) => {
    const sorted = [...bookmarks].sort((a, b) => a.page - b.page);
    const next = sorted.find(b => b.page > currPage);
    return next || (sorted.length > 0 ? sorted[0] : null);
  }, [bookmarks]);

  const getPrevBookmark = useCallback((currPage: number) => {
    const sorted = [...bookmarks].sort((a, b) => a.page - b.page);
    const prevs = sorted.filter(b => b.page < currPage);
    return prevs.length > 0 ? prevs[prevs.length - 1] : (sorted.length > 0 ? sorted[sorted.length - 1] : null);
  }, [bookmarks]);

  return {
    bookmarks,
    isCurrentPageBookmarked,
    currentPageBookmark,
    addBookmark,
    removeBookmark,
    toggleCurrentPageBookmark,
    updateBookmark,
    clearAllBookmarks,
    getNextBookmark,
    getPrevBookmark,
    announcement,
  };
}
