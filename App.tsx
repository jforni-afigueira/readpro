import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  Upload, BookOpen, BookMarked, HelpCircle, Bookmark as BookmarkIcon, 
  CheckCircle2, Clock, Sliders, Sparkles, ChevronUp, ChevronDown 
} from 'lucide-react';
import { PDFViewer } from './components/PDFViewer';
import { EpubViewer } from './components/EpubViewer';
import { PlayerBar } from './components/PlayerBar';
import { HelpModal } from './components/HelpModal';
import { BookmarksDrawer } from './components/BookmarksDrawer';
import { TTSSettingsModal } from './components/TTSSettingsModal';
import { HistoryDrawer } from './components/HistoryDrawer';
import { useSmartTTS } from './hooks/useSmartTTS';
import { useVoiceCommands } from './hooks/useVoiceCommands';
import { useBookmarks } from './hooks/useBookmarks';
import { DocFormat, ReadingTheme } from './types';
import { 
  getLastReadBook, 
  saveBookToHistory, 
  updateReadingProgress, 
  loadBookFromHistory,
  getAllHistory 
} from './utils/indexedDBStorage';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [format, setFormat] = useState<DocFormat>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  
  // Theme & Font Customization States (with localStorage persistence)
  const [theme, setTheme] = useState<ReadingTheme>(() => {
    try {
      const saved = localStorage.getItem('leitor_reading_theme');
      if (saved === 'sepia' || saved === 'dark' || saved === 'clean') return saved;
    } catch {}
    return 'clean';
  });

  const [fontSizeScale, setFontSizeScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('leitor_font_size_scale');
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0.7 && parsed <= 2.5) return parsed;
      }
    } catch {}
    return 1.15;
  });

  const handleThemeChange = useCallback((newTheme: ReadingTheme) => {
    setTheme(newTheme);
    try {
      localStorage.setItem('leitor_reading_theme', newTheme);
    } catch {}
  }, []);

  const handleFontSizeScaleChange = useCallback((newScale: number) => {
    const clamped = Math.max(0.75, Math.min(2.5, newScale));
    setFontSizeScale(clamped);
    try {
      localStorage.setItem('leitor_font_size_scale', clamped.toString());
    } catch {}
  }, []);

  // View States & Modals
  const [scale, setScale] = useState(1.5);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isFooterCollapsed, setIsFooterCollapsed] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [isTTSSettingsOpen, setIsTTSSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  const [historyToast, setHistoryToast] = useState<string | null>(null);
  const historyToastTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastTouchTimeRef = useRef(0);

  const tts = useSmartTTS();

  // Bookmarks management
  const {
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
    announcement
  } = useBookmarks(fileName, currentPage);

  const showToast = useCallback((msg: string, duration = 3500) => {
    if (historyToastTimerRef.current) {
      clearTimeout(historyToastTimerRef.current);
    }
    setHistoryToast(msg);
    historyToastTimerRef.current = window.setTimeout(() => {
      setHistoryToast(null);
    }, duration);
  }, []);

  // Update history count
  const refreshHistoryCount = useCallback(async () => {
    try {
      const all = await getAllHistory();
      setHistoryCount(all.length);
    } catch {}
  }, []);

  // 1. Restore last read book and page on mount
  useEffect(() => {
    const restoreLastSession = async () => {
      try {
        const lastSession = await getLastReadBook();
        if (lastSession && lastSession.file) {
          setFile(lastSession.file);
          setFileName(lastSession.meta.fileName);
          setFormat(lastSession.meta.fileType);
          setCurrentPage(lastSession.meta.currentPage || 1);
          setTotalPages(lastSession.meta.totalPages || 0);

          showToast(`Leitura restaurada: "${lastSession.meta.fileName}" na pág. ${lastSession.meta.currentPage}`);
        }
        await refreshHistoryCount();
      } catch (err) {
        console.warn('Erro ao restaurar última leitura:', err);
      }
    };

    restoreLastSession();
  }, [refreshHistoryCount, showToast]);

  // 2. Automatically save reading progress when page changes
  useEffect(() => {
    if (fileName && currentPage > 0) {
      updateReadingProgress(fileName, currentPage, totalPages).then(() => {
        refreshHistoryCount();
      });
    }
  }, [fileName, currentPage, totalPages, refreshHistoryCount]);

  // Extract text snippet from current page
  const getCurrentPageSnippet = useCallback(() => {
    const bridge = document.getElementById('pdf-data-bridge');
    const text = bridge?.getAttribute('data-text') || "";
    return text.slice(0, 180);
  }, []);

  const handleFile = useCallback((f: File) => {
    tts.stop();
    setFile(f);
    setFileName(f.name);
    setCurrentPage(1);
    setIsBookmarksOpen(false);
    
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') {
      setFormat('pdf');
      saveBookToHistory(f, 1, 0).then(() => refreshHistoryCount());
    } else if (ext === 'epub') {
      setFormat('epub');
      saveBookToHistory(f, 1, 0).then(() => refreshHistoryCount());
    } else {
      alert("Formato inválido. Por favor, carregue um arquivo PDF ou EPUB.");
    }
  }, [tts, refreshHistoryCount]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      handleFile(f);
      e.target.value = '';
    }
  }, [handleFile]);

  // Load a book selected from History Drawer
  const handleSelectBookFromHistory = useCallback(async (bookId: string) => {
    tts.stop();
    try {
      const bookData = await loadBookFromHistory(bookId);
      if (bookData && bookData.file) {
        setFile(bookData.file);
        setFileName(bookData.meta.fileName);
        setFormat(bookData.meta.fileType);
        setCurrentPage(bookData.meta.currentPage || 1);
        setTotalPages(bookData.meta.totalPages || 0);

        showToast(`Retomando: "${bookData.meta.fileName}" na pág. ${bookData.meta.currentPage}`);
      }
    } catch (err) {
      console.warn('Erro ao carregar livro do histórico:', err);
    }
  }, [tts, showToast]);

  const onPageChange = useCallback((curr: number, total: number) => {
    setCurrentPage(curr);
    setTotalPages(total);
  }, []);

  // Robust Page Jump that respects boundaries
  const handlePageJump = useCallback((page: number) => {
    if (totalPages === 0 && page === 1) {
       setCurrentPage(1);
       return;
    }
    if (totalPages > 0) {
      const target = Math.max(1, Math.min(page, totalPages));
      setCurrentPage(target);
    }
  }, [totalPages]);

  const handleGlobalDoubleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('button') || 
      target.closest('input') || 
      target.closest('a') || 
      target.closest('select') || 
      target.closest('footer') || 
      target.closest('.no-double-click')
    ) {
      return;
    }

    const screenWidth = window.innerWidth;
    const clickX = e.clientX;
    const sideWidth = screenWidth * 0.15;

    if (clickX < sideWidth) {
      e.preventDefault();
      handlePageJump(currentPage - 1);
      showToast("Página Anterior");
    } else if (clickX > screenWidth - sideWidth) {
      e.preventDefault();
      handlePageJump(currentPage + 1);
      showToast("Próxima Página");
    }
  }, [currentPage, handlePageJump, showToast]);

  const handleGlobalTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    
    const now = Date.now();
    const delay = now - lastTouchTimeRef.current;
    
    if (delay > 0 && delay < 300) {
      const touch = e.touches[0];
      const screenWidth = window.innerWidth;
      const clickX = touch.clientX;
      const sideWidth = screenWidth * 0.15;
      
      const target = e.target as HTMLElement;
      if (
        target.closest('button') || 
        target.closest('input') || 
        target.closest('a') || 
        target.closest('select') || 
        target.closest('footer') || 
        target.closest('.no-double-click')
      ) {
        return;
      }
      
      if (clickX < sideWidth) {
        if (e.cancelable) e.preventDefault();
        handlePageJump(currentPage - 1);
        showToast("Página Anterior");
      } else if (clickX > screenWidth - sideWidth) {
        if (e.cancelable) e.preventDefault();
        handlePageJump(currentPage + 1);
        showToast("Próxima Página");
      }
      lastTouchTimeRef.current = 0;
    } else {
      lastTouchTimeRef.current = now;
    }
  }, [currentPage, handlePageJump, showToast]);

  const togglePlay = useCallback(() => {
    if (tts.state.isPlaying && !tts.state.isPaused) {
      tts.pause();
    } else if (tts.state.isPaused) {
      tts.resume();
    } else {
      const bridge = document.getElementById('pdf-data-bridge');
      const text = bridge?.getAttribute('data-text') || "";
      if (text) {
        tts.play(text, 0, () => {
           if (currentPage < totalPages) {
             setCurrentPage(p => p + 1);
           }
        });
      }
    }
  }, [tts, totalPages, currentPage]);

  // --- View Control Handlers ---
  const handleZoomIn = useCallback(() => setScale(s => Math.min(s + 0.25, 4.0)), []);
  const handleZoomOut = useCallback(() => setScale(s => Math.max(s - 0.25, 0.5)), []);
  const handleFitScreen = useCallback(() => setScale(1.2), []);
  
  const toggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error enabling full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  // Sync fullscreen state with browser events
  useEffect(() => {
    const handler = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyShortcuts = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.altKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        toggleCurrentPageBookmark(getCurrentPageSnippet());
      } else if (e.altKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        setIsBookmarksOpen(prev => !prev);
      } else if (e.altKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        setIsHistoryOpen(prev => !prev);
      } else if (e.altKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        setIsTTSSettingsOpen(prev => !prev);
      } else if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setIsFooterCollapsed(prev => !prev);
      } else if (e.altKey && (e.key === 'u' || e.key === 'U' || e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    };

    window.addEventListener('keydown', handleKeyShortcuts);
    return () => window.removeEventListener('keydown', handleKeyShortcuts);
  }, [toggleCurrentPageBookmark, getCurrentPageSnippet]);

  // --- Voice Command Integration ---
  const { isListening, toggleListening, lastCommand } = useVoiceCommands({
    onPause: () => { if (tts.state.isPlaying) tts.pause(); },
    onResume: () => { 
      if (tts.state.isPaused) {
         tts.resume();
      } else if (!tts.state.isPlaying) {
         togglePlay(); 
      }
    },
    onStop: () => tts.stop(),
    onNextPage: () => handlePageJump(currentPage + 1),
    onPrevPage: () => handlePageJump(currentPage - 1),
    onGoToPage: (page) => handlePageJump(page),
    
    // Paragraph Navigation Voice Commands
    onNextParagraph: () => tts.skipParagraph('next'),
    onPrevParagraph: () => tts.skipParagraph('prev'),

    // Theme and Font Size Voice Commands
    onSetTheme: (t) => handleThemeChange(t),
    onIncreaseFontSize: () => handleFontSizeScaleChange(fontSizeScale + 0.15),
    onDecreaseFontSize: () => handleFontSizeScaleChange(fontSizeScale - 0.15),

    onIncreaseSpeed: () => tts.setRate(Math.min(tts.state.rate + 0.25, 3.0)),
    onDecreaseSpeed: () => tts.setRate(Math.max(tts.state.rate - 0.25, 0.5)),
    
    // View Commands
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onFitScreen: handleFitScreen,
    onFullScreen: () => { 
        if(!document.fullscreenElement) toggleFullScreen(); 
    },
    onExitFullScreen: () => { 
        if(document.fullscreenElement) toggleFullScreen(); 
    },

    // History & Voice Settings Voice Commands
    onOpenHistory: () => setIsHistoryOpen(true),
    onCloseHistory: () => setIsHistoryOpen(false),
    onOpenTTSSettings: () => setIsTTSSettingsOpen(true),
    onCloseTTSSettings: () => setIsTTSSettingsOpen(false),

    // Footer Collapse Voice Commands
    onToggleHeader: () => setIsFooterCollapsed(prev => !prev),
    onExpandHeader: () => setIsFooterCollapsed(false),
    onCollapseHeader: () => setIsFooterCollapsed(true),
    onToggleFooter: () => setIsFooterCollapsed(prev => !prev),
    onExpandFooter: () => setIsFooterCollapsed(false),
    onCollapseFooter: () => setIsFooterCollapsed(true),
    onImmersiveMode: () => setIsFooterCollapsed(prev => !prev),

    // Bookmark Voice Commands
    onToggleBookmark: () => {
      toggleCurrentPageBookmark(getCurrentPageSnippet());
    },
    onRemoveBookmark: () => {
      if (currentPageBookmark) {
        removeBookmark(currentPageBookmark.id);
      }
    },
    onOpenBookmarks: () => setIsBookmarksOpen(true),
    onCloseBookmarks: () => setIsBookmarksOpen(false),
    onNextBookmark: () => {
      const next = getNextBookmark(currentPage);
      if (next) handlePageJump(next.page);
    },
    onPrevBookmark: () => {
      const prev = getPrevBookmark(currentPage);
      if (prev) handlePageJump(prev.page);
    }
  });

  return (
    <div 
      onDoubleClick={handleGlobalDoubleClick}
      onTouchStart={handleGlobalTouchStart}
      className={`h-screen w-full flex flex-col font-sans overflow-hidden transition-colors duration-200 ${
        theme === 'dark' 
          ? 'bg-[#0f1115] text-[#d8dce6]' 
          : theme === 'sepia'
          ? 'bg-[#ede0c8] text-[#3d2e1e]'
          : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Hidden Global File Input for Shortcuts & Handlers */}
      <input 
        type="file" 
        ref={fileInputRef} 
        accept=".pdf,.epub" 
        onChange={handleFileUpload} 
        className="hidden" 
      />

      {/* Help Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} theme={theme} />

      {/* TTS Voice & Pitch Settings Modal */}
      <TTSSettingsModal 
        isOpen={isTTSSettingsOpen} 
        onClose={() => setIsTTSSettingsOpen(false)} 
        tts={tts} 
        theme={theme}
      />

      {/* Reading History Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        currentFileName={fileName}
        onSelectBook={handleSelectBookFromHistory}
        onHistoryCleared={() => {
          refreshHistoryCount();
          showToast('Histórico de leitura limpo com sucesso.');
        }}
        onBookDeleted={() => {
          refreshHistoryCount();
          showToast('Livro removido do histórico.');
        }}
        theme={theme}
      />

      {/* Bookmarks Drawer */}
      <BookmarksDrawer 
        isOpen={isBookmarksOpen}
        onClose={() => setIsBookmarksOpen(false)}
        bookmarks={bookmarks}
        currentPage={currentPage}
        totalPages={totalPages}
        fileName={fileName}
        onJumpToPage={handlePageJump}
        onAddBookmark={addBookmark}
        onRemoveBookmark={removeBookmark}
        onUpdateBookmark={updateBookmark}
        onClearAll={clearAllBookmarks}
        getCurrentPageSnippet={getCurrentPageSnippet}
        theme={theme}
      />

      {/* Screen Reader Live Region for Accessibility */}
      <div 
        role="status" 
        aria-live="polite" 
        className="sr-only"
      >
        {announcement || historyToast}
      </div>

      {/* Toast Notification when Bookmark changes or Session restores */}
      {(announcement || historyToast) && (
        <div 
          role="status" 
          aria-live="polite"
          className="fixed top-6 right-6 z-[80] bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl border border-slate-700/50 text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200"
        >
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{announcement || historyToast}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className={`flex-1 overflow-auto relative transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-[#0f1115]' 
          : theme === 'sepia'
          ? 'bg-[#ede0c8]'
          : 'bg-slate-100'
      } ${
        file ? (isFooterCollapsed ? 'pb-16' : 'pb-28 md:pb-24') : 'pb-6'
      }`}>
        {!file && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
             <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-5 shadow-sm ring-8 ring-blue-50/50">
                <BookOpen size={40} className="stroke-[1.75]" />
             </div>
             
             <h1 className="text-2xl font-bold text-slate-800 mb-2 tracking-tight">Leitor Pro</h1>
             <p className="text-slate-500 text-sm max-w-md mb-6 leading-relaxed">
               Leitura imersiva de livros em PDF e EPUB com narração em voz inteligente, navegação por parágrafos, temas customizáveis e histórico automático.
             </p>

             <div className="flex flex-col sm:flex-row items-center gap-3">
               <label className="cursor-pointer bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-semibold hover:bg-slate-800 transition shadow-lg hover:shadow-xl flex items-center gap-2.5 active:scale-95">
                  <Upload size={18} />
                  <span>Carregar Livro (PDF / EPUB)</span>
                  <input type="file" accept=".pdf,.epub" onChange={handleFileUpload} className="hidden" />
               </label>

               {historyCount > 0 && (
                 <button
                   onClick={() => setIsHistoryOpen(true)}
                   className="px-5 py-3 bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 rounded-2xl text-sm font-semibold hover:bg-indigo-50/40 shadow-xs flex items-center gap-2 transition active:scale-95"
                 >
                   <Clock size={18} className="text-indigo-600" />
                   <span>Ver Histórico ({historyCount})</span>
                 </button>
               )}
             </div>
          </div>
        )}

        {/* Visual feedback for voice commands */}
        {isListening && lastCommand && (
           <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-xs z-50 animate-fade-in pointer-events-none shadow-lg border border-white/10 backdrop-blur-sm">
              Ouvido: "{lastCommand}"
           </div>
        )}

        {file && format === 'pdf' && (
          <PDFViewer 
            file={file} 
            tts={tts} 
            currentPage={currentPage}
            onPageChange={onPageChange}
            scale={scale}
            theme={theme}
          />
        )}

        {file && format === 'epub' && (
          <EpubViewer 
            file={file} 
            tts={tts} 
            currentPage={currentPage}
            onPageChange={onPageChange}
            scale={scale}
            theme={theme}
            fontSizeScale={fontSizeScale}
            onThemeChange={handleThemeChange}
            onFontSizeScaleChange={handleFontSizeScaleChange}
          />
        )}
      </main>

      {/* Sticky Bottom Player Bar */}
      {file && (
        <PlayerBar 
           tts={tts} 
           fileName={fileName}
           currentPage={currentPage}
           totalPages={totalPages}
           onPrevPage={() => handlePageJump(currentPage - 1)}
           onNextPage={() => handlePageJump(currentPage + 1)}
           onPageJump={handlePageJump}
           onTogglePlay={togglePlay}
           isListening={isListening}
           onToggleListening={toggleListening}
           onFileUpload={handleFileUpload}
           onOpenHistory={() => setIsHistoryOpen(true)}
           historyCount={historyCount}
           isBookmarked={isCurrentPageBookmarked}
           bookmarksCount={bookmarks.length}
           onToggleBookmark={() => toggleCurrentPageBookmark(getCurrentPageSnippet())}
           onOpenBookmarks={() => setIsBookmarksOpen(true)}
           onOpenTTSSettings={() => setIsTTSSettingsOpen(true)}
           scale={scale}
           onZoomIn={handleZoomIn}
           onZoomOut={handleZoomOut}
           onFitScreen={handleFitScreen}
           isFullScreen={isFullScreen}
           onToggleFullScreen={toggleFullScreen}
           onOpenHelp={() => setIsHelpOpen(true)}
           theme={theme}
           onThemeChange={handleThemeChange}
           fontSizeScale={fontSizeScale}
           onFontSizeScaleChange={handleFontSizeScaleChange}
           isCollapsed={isFooterCollapsed}
           onToggleCollapse={() => setIsFooterCollapsed(prev => !prev)}
        />
      )}
    </div>
  );
};

export default App;
