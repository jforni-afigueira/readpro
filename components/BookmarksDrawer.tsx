import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Bookmark as BookmarkIcon, 
  X, 
  Search, 
  Trash2, 
  Edit3, 
  Check, 
  Plus, 
  Clock, 
  ArrowRight, 
  BookMarked,
  ArrowUpDown,
  FileText
} from 'lucide-react';
import { Bookmark, ThemeMode } from '../types';

interface BookmarksDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bookmarks: Bookmark[];
  currentPage: number;
  totalPages: number;
  fileName: string;
  onJumpToPage: (page: number) => void;
  onAddBookmark: (page: number, title?: string, note?: string, snippet?: string) => void;
  onRemoveBookmark: (idOrPage: string | number) => void;
  onUpdateBookmark: (id: string, updates: { title?: string; note?: string }) => void;
  onClearAll: () => void;
  getCurrentPageSnippet?: () => string;
  theme?: ThemeMode;
}

export const BookmarksDrawer: React.FC<BookmarksDrawerProps> = ({
  isOpen,
  onClose,
  bookmarks,
  currentPage,
  totalPages,
  fileName,
  onJumpToPage,
  onAddBookmark,
  onRemoveBookmark,
  onUpdateBookmark,
  onClearAll,
  getCurrentPageSnippet,
  theme = 'clean',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'page' | 'date'>('page');
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNote, setEditNote] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const drawerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isDark = theme === 'dark';
  const isSepia = theme === 'sepia';

  // Focus management & Escape key handling for accessibility
  useEffect(() => {
    if (!isOpen) {
      setEditingBookmarkId(null);
      setShowClearConfirm(false);
      return;
    }

    // Auto focus search or drawer
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 150);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingBookmarkId) {
          setEditingBookmarkId(null);
        } else if (showClearConfirm) {
          setShowClearConfirm(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, editingBookmarkId, showClearConfirm, onClose]);

  // Check if current page already has a bookmark
  const isCurrentPageBookmarked = useMemo(() => {
    return bookmarks.some(b => b.page === currentPage);
  }, [bookmarks, currentPage]);

  // Filter and sort bookmarks
  const filteredBookmarks = useMemo(() => {
    let result = [...bookmarks];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(b => 
        (b.page?.toString() || '').includes(q) ||
        (b.title || '').toLowerCase().includes(q) ||
        (b.note ? b.note.toLowerCase().includes(q) : false) ||
        (b.snippet ? b.snippet.toLowerCase().includes(q) : false)
      );
    }

    if (sortBy === 'page') {
      result.sort((a, b) => a.page - b.page);
    } else {
      result.sort((a, b) => b.createdAt - a.createdAt);
    }

    return result;
  }, [bookmarks, searchQuery, sortBy]);

  // Start editing bookmark
  const handleStartEdit = (b: Bookmark) => {
    setEditingBookmarkId(b.id);
    setEditTitle(b.title);
    setEditNote(b.note || '');
  };

  // Save edit
  const handleSaveEdit = (id: string) => {
    onUpdateBookmark(id, {
      title: editTitle.trim() || undefined,
      note: editNote.trim()
    });
    setEditingBookmarkId(null);
  };

  // Quick add current page
  const handleQuickAddCurrentPage = () => {
    const snippet = getCurrentPageSnippet ? getCurrentPageSnippet() : '';
    onAddBookmark(currentPage, undefined, '', snippet);
  };

  const formatDate = (timestamp: number) => {
    try {
      const d = new Date(timestamp);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[70] flex justify-end animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bookmarks-drawer-title"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div 
        ref={drawerRef}
        className={`relative w-full max-w-md h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300 border-l transition-colors ${
          isDark 
            ? 'bg-[#181a20] border-slate-800 text-slate-100' 
            : isSepia 
            ? 'bg-[#f4ecd8] border-[#dfcca8] text-[#3d2c1b]' 
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between shrink-0 shadow-md ${
          isDark 
            ? 'bg-[#121418] text-white border-b border-slate-800' 
            : isSepia 
            ? 'bg-[#ede0c8] text-[#382613] border-b border-[#e2cfab]' 
            : 'bg-slate-900 text-white'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              isDark 
                ? 'bg-blue-600/30 text-blue-400 border border-blue-500/30' 
                : isSepia 
                ? 'bg-[#d8c09a] text-[#422c16] border border-[#caa87c]' 
                : 'bg-blue-600 text-white'
            }`}>
              <BookMarked size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 id="bookmarks-drawer-title" className={`font-bold text-base md:text-lg leading-tight flex items-center gap-2 ${
                isSepia ? 'text-[#382613]' : 'text-white'
              }`}>
                Marcadores
                <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-normal ${
                  isDark 
                    ? 'bg-slate-800 text-slate-300' 
                    : isSepia 
                    ? 'bg-[#e2cfab] text-[#422c16]' 
                    : 'bg-slate-800 text-slate-300'
                }`}>
                  {bookmarks.length}
                </span>
              </h2>
              <p className={`text-xs truncate max-w-[220px] ${
                isSepia ? 'text-[#735c44]' : 'text-slate-400'
              }`} title={fileName}>
                {fileName || 'Documento atual'}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className={`p-2 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 outline-none ${
              isDark 
                ? 'text-slate-400 hover:text-white hover:bg-slate-800' 
                : isSepia 
                ? 'text-[#735c44] hover:text-[#382613] hover:bg-[#dfcca8]' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            aria-label="Fechar painel de marcadores"
            title="Fechar (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Action & Filter Bar */}
        <div className={`p-4 border-b space-y-3 shrink-0 ${
          isDark 
            ? 'border-slate-800 bg-[#121418]' 
            : isSepia 
            ? 'border-[#e2cfab] bg-[#ebd8b7]' 
            : 'border-slate-100 bg-slate-50/80'
        }`}>
          {/* Quick Bookmark Current Page Button */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={handleQuickAddCurrentPage}
              disabled={isCurrentPageBookmarked}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-sm ${
                isCurrentPageBookmarked
                  ? isDark 
                    ? 'bg-amber-950/40 text-amber-300 border border-amber-800/60 cursor-default' 
                    : isSepia 
                    ? 'bg-[#faecd4] text-[#5c3e1e] border border-[#e7cca0] cursor-default' 
                    : 'bg-amber-50 text-amber-800 border border-amber-200/80 cursor-default'
                  : isDark 
                  ? 'bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white hover:shadow' 
                  : isSepia 
                  ? 'bg-[#8c6536] hover:bg-[#73522b] active:scale-[0.98] text-white hover:shadow' 
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white hover:shadow'
              }`}
              aria-label={isCurrentPageBookmarked ? `Página atual (${currentPage}) já está marcada` : `Marcar página atual (${currentPage})`}
            >
              {isCurrentPageBookmarked ? (
                <>
                  <Check size={16} className={isDark ? 'text-amber-400 shrink-0' : isSepia ? 'text-[#8c6536] shrink-0' : 'text-amber-600 shrink-0'} />
                  <span>Pág. {currentPage} já está marcada</span>
                </>
              ) : (
                <>
                  <Plus size={16} className="shrink-0" />
                  <span>Marcar Página Atual ({currentPage})</span>
                </>
              )}
            </button>

            {/* Sort Toggle */}
            <button
              onClick={() => setSortBy(s => s === 'page' ? 'date' : 'page')}
              className={`px-3 py-2.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition shadow-sm border ${
                isDark 
                  ? 'bg-[#20232a] border-slate-700 hover:bg-slate-800 text-slate-200' 
                  : isSepia 
                  ? 'bg-[#fbf5e8] border-[#dfcca8] hover:bg-[#f5ebd6] text-[#3d2c1b]' 
                  : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
              title={`Ordenar por ${sortBy === 'page' ? 'Data de criação' : 'Número de página'}`}
              aria-label={`Ordenar por ${sortBy === 'page' ? 'Data de criação' : 'Número de página'}`}
            >
              <ArrowUpDown size={14} className={isDark ? 'text-slate-400' : isSepia ? 'text-[#735c44]' : 'text-slate-500'} />
              <span className="hidden sm:inline">{sortBy === 'page' ? 'Por Pág.' : 'Recentes'}</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${
              isDark ? 'text-slate-500' : isSepia ? 'text-[#8c745c]' : 'text-slate-400'
            }`} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por página, título ou notas..."
              className={`w-full pl-9 pr-8 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 border transition ${
                isDark 
                  ? 'bg-[#20232a] border-slate-700 text-slate-100 placeholder:text-slate-500 focus:ring-blue-500' 
                  : isSepia 
                  ? 'bg-[#fbf5e8] border-[#dfcca8] text-[#3d2c1b] placeholder:text-[#998066] focus:ring-[#8c6536]' 
                  : 'bg-white border-slate-200 placeholder:text-slate-400 focus:ring-blue-500 focus:border-transparent'
              }`}
              aria-label="Filtrar marcadores salvos"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full ${
                  isDark ? 'text-slate-400 hover:text-slate-200' : isSepia ? 'text-[#735c44] hover:text-[#382613]' : 'text-slate-400 hover:text-slate-600'
                }`}
                aria-label="Limpar busca"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Bookmarks List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 focus-visible:outline-none" tabIndex={0} aria-label="Lista de marcadores">
          {filteredBookmarks.length === 0 ? (
            <div className={`h-full min-h-[220px] flex flex-col items-center justify-center text-center p-6 ${
              isDark ? 'text-slate-500' : isSepia ? 'text-[#735c44]' : 'text-slate-400'
            }`}>
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-3 ${
                isDark ? 'bg-slate-800 text-slate-500' : isSepia ? 'bg-[#ebd8b7] text-[#735c44]' : 'bg-slate-100 text-slate-300'
              }`}>
                <BookmarkIcon size={28} />
              </div>
              {searchQuery ? (
                <>
                  <p className={`font-semibold text-sm mb-1 ${
                    isDark ? 'text-slate-300' : isSepia ? 'text-[#382613]' : 'text-slate-700'
                  }`}>Nenhum marcador encontrado</p>
                  <p className={`text-xs max-w-[240px] ${
                    isDark ? 'text-slate-400' : isSepia ? 'text-[#735c44]' : 'text-slate-500'
                  }`}>
                    Nenhum resultado corresponde a "{searchQuery}".
                  </p>
                </>
              ) : (
                <>
                  <p className={`font-semibold text-sm mb-1 ${
                    isDark ? 'text-slate-300' : isSepia ? 'text-[#382613]' : 'text-slate-700'
                  }`}>Sem marcadores salvos</p>
                  <p className={`text-xs max-w-[260px] leading-relaxed mb-4 ${
                    isDark ? 'text-slate-400' : isSepia ? 'text-[#735c44]' : 'text-slate-500'
                  }`}>
                    Salve páginas importantes para retornar rapidamente depois. Você também pode usar comandos de voz como <strong className={isDark ? 'text-slate-200' : isSepia ? 'text-[#382613]' : 'text-slate-700'}>"Salvar marcador"</strong>.
                  </p>
                  <button
                    onClick={handleQuickAddCurrentPage}
                    className={`px-4 py-2 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-sm ${
                      isDark ? 'bg-blue-600 hover:bg-blue-500' : isSepia ? 'bg-[#8c6536] hover:bg-[#73522b]' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    <Plus size={14} />
                    <span>Marcar Página {currentPage} Agora</span>
                  </button>
                </>
              )}
            </div>
          ) : (
            filteredBookmarks.map((bm) => {
              const isCurrent = bm.page === currentPage;
              const isEditing = editingBookmarkId === bm.id;

              return (
                <div
                  key={bm.id}
                  className={`group relative rounded-2xl border transition-all duration-200 ${
                    isCurrent 
                      ? isDark 
                        ? 'bg-blue-950/40 border-blue-800/80 ring-1 ring-blue-700/40 shadow-xs' 
                        : isSepia 
                        ? 'bg-[#ebd8b7] border-[#8c6536]/60 ring-1 ring-[#8c6536]/30 shadow-xs' 
                        : 'bg-blue-50/70 border-blue-200 ring-1 ring-blue-300/50 shadow-sm' 
                      : isDark 
                      ? 'bg-[#20232a] border-slate-800 hover:border-slate-700 hover:shadow-md' 
                      : isSepia 
                      ? 'bg-[#fbf5e8] border-[#dfcca8] hover:border-[#caa87c] hover:shadow-md' 
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md'
                  }`}
                >
                  {isEditing ? (
                    // Edit Mode
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold uppercase tracking-wider ${
                          isDark ? 'text-blue-400' : isSepia ? 'text-[#8c6536]' : 'text-blue-600'
                        }`}>
                          Editar Marcador • Pág. {bm.page}
                        </span>
                        <button
                          onClick={() => setEditingBookmarkId(null)}
                          className={`p-1 ${isDark ? 'text-slate-400 hover:text-slate-200' : isSepia ? 'text-[#735c44] hover:text-[#382613]' : 'text-slate-400 hover:text-slate-600'}`}
                          aria-label="Cancelar edição"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <div>
                        <label className={`text-[11px] font-semibold mb-1 block ${
                          isDark ? 'text-slate-300' : isSepia ? 'text-[#5c442c]' : 'text-slate-600'
                        }`}>
                          Título do Marcador
                        </label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder={`Marcador - Página ${bm.page}`}
                          className={`w-full px-3 py-1.5 text-xs rounded-lg border focus:outline-none ${
                            isDark 
                              ? 'bg-slate-800 border-slate-700 text-slate-100 focus:ring-2 focus:ring-blue-500' 
                              : isSepia 
                              ? 'bg-[#f4ecd8] border-[#caa87c] text-[#3d2c1b] focus:ring-2 focus:ring-[#8c6536]' 
                              : 'bg-slate-50 border-slate-200 focus:ring-2 focus:ring-blue-500'
                          }`}
                          autoFocus
                        />
                      </div>

                      <div>
                        <label className={`text-[11px] font-semibold mb-1 block ${
                          isDark ? 'text-slate-300' : isSepia ? 'text-[#5c442c]' : 'text-slate-600'
                        }`}>
                          Anotação / Lembrete (opcional)
                        </label>
                        <textarea
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          placeholder="Ex: Citação importante, rever para a prova, etc."
                          rows={2}
                          className={`w-full px-3 py-1.5 text-xs rounded-lg border resize-none focus:outline-none ${
                            isDark 
                              ? 'bg-slate-800 border-slate-700 text-slate-100 focus:ring-2 focus:ring-blue-500' 
                              : isSepia 
                              ? 'bg-[#f4ecd8] border-[#caa87c] text-[#3d2c1b] focus:ring-2 focus:ring-[#8c6536]' 
                              : 'bg-slate-50 border-slate-200 focus:ring-2 focus:ring-blue-500'
                          }`}
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          onClick={() => setEditingBookmarkId(null)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                            isDark ? 'text-slate-400 hover:bg-slate-800' : isSepia ? 'text-[#735c44] hover:bg-[#ede0c8]' : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleSaveEdit(bm.id)}
                          className={`px-4 py-1.5 text-xs font-semibold text-white rounded-lg transition flex items-center gap-1.5 shadow-sm ${
                            isDark ? 'bg-blue-600 hover:bg-blue-500' : isSepia ? 'bg-[#8c6536] hover:bg-[#73522b]' : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          <Check size={14} />
                          <span>Salvar Alterações</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Display Mode
                    <div className="p-3.5 flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        {/* Page Pill & Title */}
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <button
                            onClick={() => {
                              onJumpToPage(bm.page);
                              onClose();
                            }}
                            className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1 transition ${
                              isCurrent 
                                ? isDark ? 'bg-blue-600 text-white shadow-xs' : isSepia ? 'bg-[#8c6536] text-white shadow-xs' : 'bg-blue-600 text-white shadow-sm' 
                                : isDark ? 'bg-slate-800 text-slate-200 hover:bg-blue-600 hover:text-white' : isSepia ? 'bg-[#ebd8b7] text-[#422c16] hover:bg-[#8c6536] hover:text-white' : 'bg-slate-100 text-slate-800 hover:bg-blue-600 hover:text-white'
                            }`}
                            title={`Pular para a página ${bm.page}`}
                            aria-label={`Pular para a página ${bm.page}`}
                          >
                            <span>Pág. {bm.page}</span>
                          </button>

                          <div className="flex-1 min-w-0">
                            <h3 className={`font-bold text-xs md:text-sm truncate ${
                              isDark ? 'text-slate-100' : isSepia ? 'text-[#382613]' : 'text-slate-800'
                            }`} title={bm.title}>
                              {bm.title}
                            </h3>
                            {isCurrent && (
                              <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.2 rounded mt-0.5 ${
                                isDark 
                                  ? 'text-blue-300 bg-blue-950/80' 
                                  : isSepia 
                                  ? 'text-[#4a2e0e] bg-[#e2cfab]' 
                                  : 'text-blue-700 bg-blue-100/80'
                              }`}>
                                Página Atual
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleStartEdit(bm)}
                            className={`p-1.5 rounded-lg transition ${
                              isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : isSepia ? 'text-[#8c745c] hover:text-[#382613] hover:bg-[#ebd8b7]' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                            }`}
                            title="Editar título e anotação"
                            aria-label={`Editar marcador da página ${bm.page}`}
                          >
                            <Edit3 size={15} />
                          </button>

                          <button
                            onClick={() => onRemoveBookmark(bm.id)}
                            className={`p-1.5 rounded-lg transition ${
                              isDark ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-950/40' : isSepia ? 'text-[#8c745c] hover:text-rose-700 hover:bg-[#fadad8]' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title="Excluir marcador"
                            aria-label={`Excluir marcador da página ${bm.page}`}
                          >
                            <Trash2 size={15} />
                          </button>

                          <button
                            onClick={() => {
                              onJumpToPage(bm.page);
                              onClose();
                            }}
                            className={`p-1.5 rounded-lg transition flex items-center gap-1 ${
                              isDark ? 'bg-blue-950/60 text-blue-400 hover:bg-blue-600 hover:text-white' : isSepia ? 'bg-[#ebd8b7] text-[#6b471c] hover:bg-[#8c6536] hover:text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white'
                            }`}
                            title={`Ir para página ${bm.page}`}
                            aria-label={`Ir para a página ${bm.page}`}
                          >
                            <ArrowRight size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Note / Annotation */}
                      {bm.note && (
                        <div className={`rounded-xl p-2 text-xs flex items-start gap-1.5 border ${
                          isDark 
                            ? 'bg-amber-950/30 border-amber-800/40 text-amber-200' 
                            : isSepia 
                            ? 'bg-[#faecd4] border-[#e7cca0] text-[#553b1b]' 
                            : 'bg-amber-50/60 border border-amber-200/60 text-amber-900/90'
                        }`}>
                          <FileText size={13} className={isDark ? 'text-amber-400 shrink-0 mt-0.5' : isSepia ? 'text-[#8c6536] shrink-0 mt-0.5' : 'text-amber-600 shrink-0 mt-0.5'} />
                          <p className="leading-snug break-words flex-1">{bm.note}</p>
                        </div>
                      )}

                      {/* Text Snippet Preview */}
                      {bm.snippet && (
                        <p className={`text-[11px] italic rounded-lg p-2 border line-clamp-2 leading-relaxed ${
                          isDark 
                            ? 'bg-[#181a20] border-slate-800 text-slate-400' 
                            : isSepia 
                            ? 'bg-[#ede0c8] border-[#dfcca8] text-[#5c442c]' 
                            : 'text-slate-500 bg-slate-50 border-slate-100'
                        }`}>
                          "{bm.snippet}"
                        </p>
                      )}

                      {/* Footer Info */}
                      <div className={`flex items-center justify-between text-[10px] pt-1 border-t ${
                        isDark 
                          ? 'border-slate-800 text-slate-400' 
                          : isSepia 
                          ? 'border-[#dfcca8] text-[#735c44]' 
                          : 'border-slate-100/80 text-slate-400'
                      }`}>
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {formatDate(bm.createdAt)}
                        </span>
                        <button
                          onClick={() => {
                            onJumpToPage(bm.page);
                            onClose();
                          }}
                          className={`font-medium hover:underline ${
                            isDark ? 'text-blue-400 hover:text-blue-300' : isSepia ? 'text-[#8c6536] hover:text-[#6e4e27]' : 'text-blue-600 hover:text-blue-700'
                          }`}
                        >
                          Abrir página
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {bookmarks.length > 0 && (
          <div className={`p-4 border-t shrink-0 flex items-center justify-between ${
            isDark 
              ? 'bg-[#121418] border-slate-800' 
              : isSepia 
              ? 'bg-[#ede0c8] border-[#e2cfab]' 
              : 'bg-slate-50 border-slate-200'
          }`}>
            {showClearConfirm ? (
              <div className="flex items-center justify-between w-full gap-2 animate-fade-in">
                <span className={`text-xs font-semibold ${
                  isDark ? 'text-rose-400' : isSepia ? 'text-rose-800' : 'text-red-600'
                }`}>Excluir todos ({bookmarks.length})?</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border ${
                      isDark 
                        ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' 
                        : isSepia 
                        ? 'bg-[#fbf5e8] border-[#dfcca8] text-[#3d2c1b] hover:bg-[#f5ebd6]' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      onClearAll();
                      setShowClearConfirm(false);
                    }}
                    className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 shadow-sm"
                  >
                    Sim, excluir
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className={`text-xs hover:underline font-medium flex items-center gap-1 ${
                    isDark ? 'text-rose-400 hover:text-rose-300' : isSepia ? 'text-rose-800 hover:text-rose-900' : 'text-red-600 hover:text-red-700'
                  }`}
                  aria-label="Excluir todos os marcadores salvos"
                >
                  <Trash2 size={13} />
                  <span>Limpar todos</span>
                </button>

                <span className={`text-xs ${
                  isDark ? 'text-slate-400' : isSepia ? 'text-[#735c44]' : 'text-slate-400'
                }`}>
                  Total de {totalPages > 0 ? `${totalPages} páginas` : 'documento'}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
