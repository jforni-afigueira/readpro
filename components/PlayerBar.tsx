import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, Settings2, MicOff, Maximize, Minimize, ZoomIn, ZoomOut, HelpCircle, Monitor, X,
  Bookmark as BookmarkIcon, BookMarked, Sliders, ChevronDown, ChevronUp,
  Upload, Clock, Type, RotateCcw
} from 'lucide-react';
import { SmartTTSHook, ReadingTheme } from '../types';
import { PlaybackControls } from './PlaybackControls';
import { PageNavigator } from './PageNavigator';
import { SpeedSlider } from './SpeedSlider';
import { ThemePicker } from './ThemePicker';

interface PlayerBarProps {
  tts: SmartTTSHook;
  fileName: string;
  currentPage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onPageJump: (page: number) => void;
  onTogglePlay: () => void;
  isListening?: boolean;
  onToggleListening?: () => void;
  // File Upload & History Controls
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenHistory?: () => void;
  historyCount?: number;
  // Bookmark Controls
  isBookmarked?: boolean;
  bookmarksCount?: number;
  onToggleBookmark?: () => void;
  onOpenBookmarks?: () => void;
  // TTS Settings Modal
  onOpenTTSSettings?: () => void;
  // View & Theme Controls
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitScreen: () => void;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  onOpenHelp: () => void;
  theme?: ReadingTheme;
  onThemeChange?: (theme: ReadingTheme) => void;
  fontSizeScale?: number;
  onFontSizeScaleChange?: (scale: number) => void;
  // Collapse / Expand Controls
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({
  tts,
  fileName,
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
  onPageJump,
  onTogglePlay,
  isListening = false,
  onToggleListening,
  onFileUpload,
  onOpenHistory,
  historyCount = 0,
  isBookmarked = false,
  bookmarksCount = 0,
  onToggleBookmark,
  onOpenBookmarks,
  onOpenTTSSettings,
  scale,
  onZoomIn,
  onZoomOut,
  onFitScreen,
  isFullScreen,
  onToggleFullScreen,
  onOpenHelp,
  theme = 'clean',
  onThemeChange,
  fontSizeScale = 1.15,
  onFontSizeScaleChange,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const [inputVal, setInputVal] = useState(currentPage.toString());
  const [showMobileSettings, setShowMobileSettings] = useState(false);

  // Gesture & Drag state for pulling up / down
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef<number | null>(null);
  const hasMovedRef = useRef<boolean>(false);

  useEffect(() => {
    setInputVal(currentPage.toString());
  }, [currentPage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const page = parseInt(inputVal, 10);
      if (!isNaN(page)) {
        onPageJump(page);
        e.currentTarget.blur();
      }
    }
  };

  const handleBlur = () => {
    const page = parseInt(inputVal, 10);
    if (!isNaN(page)) {
      onPageJump(page);
    } else {
      setInputVal(currentPage.toString());
    }
  };

  // Touch Gesture: Dragging to collapse/expand
  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    hasMovedRef.current = false;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startYRef.current === null) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startYRef.current;

    if (Math.abs(deltaY) > 8) {
      hasMovedRef.current = true;
    }

    if (isCollapsed) {
      if (deltaY < 0) {
        setDragOffset(Math.max(-120, deltaY));
      }
    } else {
      if (deltaY > 0) {
        setDragOffset(Math.min(120, deltaY));
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (startYRef.current !== null) {
      const endY = e.changedTouches[0].clientY;
      const deltaY = endY - startYRef.current;

      if (!hasMovedRef.current || Math.abs(deltaY) < 12) {
        // Pure tap - toggle collapse cleanly
        onToggleCollapse?.();
      } else if (isCollapsed && deltaY < -20) {
        onToggleCollapse?.();
      } else if (!isCollapsed && deltaY > 20) {
        onToggleCollapse?.();
      }
    }
    startYRef.current = null;
    hasMovedRef.current = false;
    setIsDragging(false);
    setDragOffset(0);
  };

  // Mouse drag handler for desktop handle
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only handle primary left-click
    if (e.button !== 0) return;
    startYRef.current = e.clientY;
    hasMovedRef.current = false;
    setIsDragging(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (startYRef.current === null) return;
      const deltaY = moveEvent.clientY - startYRef.current;
      if (Math.abs(deltaY) > 6) {
        hasMovedRef.current = true;
      }
      if (isCollapsed) {
        if (deltaY < 0) setDragOffset(Math.max(-120, deltaY));
      } else {
        if (deltaY > 0) setDragOffset(Math.min(120, deltaY));
      }
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      if (startYRef.current !== null && hasMovedRef.current) {
        const deltaY = upEvent.clientY - startYRef.current;
        if (isCollapsed && deltaY < -20) {
          onToggleCollapse?.();
        } else if (!isCollapsed && deltaY > 20) {
          onToggleCollapse?.();
        }
      }
      startYRef.current = null;
      setIsDragging(false);
      setDragOffset(0);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      // Reset hasMovedRef slightly later so onClick can check it
      setTimeout(() => {
        hasMovedRef.current = false;
      }, 50);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Calculate progress
  const progress = tts.totalLength > 0 ? (tts.currentGlobalIndex / tts.totalLength) * 100 : 0;

  // Dynamic transform style for dragging & retracting
  const getTransformStyle = () => {
    if (isDragging) {
      if (isCollapsed) {
        return `translateY(calc(100% - 14px + ${Math.min(0, dragOffset)}px))`;
      } else {
        return `translateY(${Math.max(0, dragOffset)}px)`;
      }
    }
    return isCollapsed ? 'translateY(calc(100% - 14px))' : 'translateY(0)';
  };

  return (
    <>
      {/* Mobile Settings Drawer (Overlay) */}
      {showMobileSettings && (
        <div className="fixed inset-0 z-[60] md:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setShowMobileSettings(false)} />
          
          {/* Panel */}
          <div className={`absolute bottom-28 left-0 right-0 rounded-t-3xl shadow-2xl p-5 border-t max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom-10 fade-in duration-200 ${
            theme === 'dark' 
              ? 'bg-[#181a20] border-slate-800 text-slate-100' 
              : theme === 'sepia'
              ? 'bg-[#fbf0d9] border-[#e2d5bd] text-[#3d2e1e]'
              : 'bg-white border-slate-200 text-slate-800'
          }`}>
             <div className="flex justify-between items-center mb-4">
               <h3 className="font-bold text-base">Menu & Ajustes</h3>
               <button 
                 onClick={() => setShowMobileSettings(false)} 
                 className={`p-2 rounded-full transition ${
                   theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-black/5 hover:bg-black/10 text-inherit'
                 }`}
               >
                 <X size={18} />
               </button>
             </div>

             {/* Quick Actions Grid on Mobile */}
             <div className="grid grid-cols-3 gap-2 mb-4">
               <label className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition">
                 <Upload size={18} />
                 <span>Carregar</span>
                 <input type="file" accept=".pdf,.epub" onChange={(e) => { setShowMobileSettings(false); onFileUpload(e); }} className="hidden" />
               </label>

               {onOpenHistory && (
                 <button 
                   onClick={() => {
                     setShowMobileSettings(false);
                     onOpenHistory();
                   }}
                   className={`p-2.5 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1.5 relative active:scale-95 transition border ${
                     theme === 'dark'
                       ? 'bg-indigo-950/60 border-indigo-800/80 text-indigo-300'
                       : 'bg-indigo-50 border-indigo-200/80 text-indigo-700'
                   }`}
                 >
                   <Clock size={18} className={theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'} />
                   <span>Histórico</span>
                   {historyCount > 0 && (
                     <span className="absolute top-1.5 right-1.5 bg-indigo-600 text-white text-[10px] min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center font-bold">
                       {historyCount}
                     </span>
                   )}
                 </button>
               )}

               {onOpenBookmarks && (
                 <button 
                   onClick={() => {
                     setShowMobileSettings(false);
                     onOpenBookmarks();
                   }} 
                   className={`p-2.5 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1.5 relative active:scale-95 transition border ${
                     theme === 'dark'
                       ? 'bg-blue-950/60 border-blue-800/80 text-blue-300'
                       : 'bg-blue-50 border-blue-200/80 text-blue-700'
                   }`}
                 >
                   <BookMarked size={18} className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} />
                   <span>Marcadores</span>
                   {bookmarksCount > 0 && (
                     <span className="absolute top-1.5 right-1.5 bg-blue-600 text-white text-[10px] min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center font-bold">
                       {bookmarksCount}
                     </span>
                   )}
                 </button>
               )}
             </div>

             {/* Theme Selection */}
             {onThemeChange && (
               <div className="mb-4">
                 <label className={`text-[11px] font-bold uppercase tracking-wider mb-2 block ${theme === 'dark' ? 'text-slate-400' : 'opacity-70'}`}>
                   Tema de Leitura
                 </label>
                 <ThemePicker theme={theme} onThemeChange={onThemeChange} />
               </div>
             )}

             {/* Font Size Scale */}
             {onFontSizeScaleChange && (
               <div className="mb-4">
                 <div className="flex items-center justify-between mb-2">
                   <label className={`text-[11px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'opacity-70'}`}>
                     Tamanho da Fonte (EPUB)
                   </label>
                   <span className={`font-mono text-xs font-bold ${theme === 'dark' ? 'text-amber-300' : 'text-slate-800'}`}>
                     {Math.round(fontSizeScale * 105)}%
                   </span>
                 </div>
                 <div className="flex items-center gap-2">
                   <button
                     onClick={() => onFontSizeScaleChange(Math.max(0.75, fontSizeScale - 0.15))}
                     className={`flex-1 py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1 border transition ${
                       theme === 'dark'
                         ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                         : 'bg-black/5 hover:bg-black/10 border-black/10 text-inherit'
                     }`}
                   >
                     <ZoomOut size={15} />
                     <span>A-</span>
                   </button>
                   <button
                     onClick={() => onFontSizeScaleChange(1.15)}
                     className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                       theme === 'dark'
                         ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                         : 'bg-black/5 hover:bg-black/10 border-black/10 text-inherit'
                     }`}
                     title="Restaurar padrão"
                   >
                     <RotateCcw size={14} />
                   </button>
                   <button
                     onClick={() => onFontSizeScaleChange(Math.min(2.5, fontSizeScale + 0.15))}
                     className={`flex-1 py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1 border transition ${
                       theme === 'dark'
                         ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                         : 'bg-black/5 hover:bg-black/10 border-black/10 text-inherit'
                     }`}
                   >
                     <ZoomIn size={15} />
                     <span>A+</span>
                   </button>
                 </div>
               </div>
             )}

             {/* Mobile View Controls */}
             <div className="mb-4">
                <label className={`text-[11px] font-bold uppercase tracking-wider mb-2 block ${theme === 'dark' ? 'text-slate-400' : 'opacity-70'}`}>Visualização (PDF)</label>
                <div className={`flex items-center gap-2 justify-between p-2 rounded-xl border ${
                  theme === 'dark' ? 'bg-slate-800/70 border-slate-700' : 'bg-black/5 border-black/5'
                }`}>
                   <button 
                     onClick={onZoomOut} 
                     className={`p-2.5 rounded-lg shadow-xs active:scale-95 transition ${
                       theme === 'dark' 
                         ? 'bg-slate-800 border border-slate-700 text-slate-100 hover:bg-slate-700' 
                         : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                     }`}
                   >
                     <ZoomOut size={18} />
                   </button>
                   
                   <div className="flex flex-col items-center w-16">
                      <span className={`font-mono font-bold text-sm ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>
                        {Math.round(scale * 100)}%
                      </span>
                      <span className={`text-[10px] ${theme === 'dark' ? 'text-slate-400' : 'opacity-60'}`}>Zoom</span>
                   </div>

                   <button 
                     onClick={onZoomIn} 
                     className={`p-2.5 rounded-lg shadow-xs active:scale-95 transition ${
                       theme === 'dark' 
                         ? 'bg-slate-800 border border-slate-700 text-slate-100 hover:bg-slate-700' 
                         : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                     }`}
                   >
                     <ZoomIn size={18} />
                   </button>
                   
                   <div className={`w-px h-7 mx-1 ${theme === 'dark' ? 'bg-slate-700' : 'bg-black/10'}`}></div>

                   <button 
                     onClick={onFitScreen} 
                     className={`flex-1 p-2 rounded-lg shadow-xs active:scale-95 transition flex flex-col items-center justify-center h-full border ${
                       theme === 'dark'
                         ? 'bg-blue-950/70 border-blue-800 text-blue-300 hover:bg-blue-900/80'
                         : 'bg-blue-50 border-blue-100 text-blue-700 hover:bg-blue-100'
                     }`}
                   >
                     <Monitor size={16} />
                     <span className="text-[10px] font-bold mt-0.5">Ajustar</span>
                   </button>
                </div>
             </div>

             {/* Mobile TTS Settings */}
             <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={`text-[11px] font-bold uppercase tracking-wider block ${theme === 'dark' ? 'text-slate-400' : 'opacity-70'}`}>Voz e Áudio</label>
                  {onOpenTTSSettings && (
                    <button
                      onClick={() => {
                        setShowMobileSettings(false);
                        onOpenTTSSettings();
                      }}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1"
                    >
                      <Sliders size={13} />
                      Configurações Avançadas
                    </button>
                  )}
                </div>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1 font-semibold">
                      <span>Velocidade</span>
                      <span className="font-mono">{tts.state.rate.toFixed(1)}x</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.5" 
                      max="3.0" 
                      step="0.1" 
                      value={tts.state.rate} 
                      onChange={(e) => tts.setRate(parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600" 
                    />
                  </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Primary Sticky Bottom Player Bar */}
      <footer 
        style={{ transform: getTransformStyle() }}
        className={`fixed bottom-0 left-0 right-0 z-40 backdrop-blur-md border-t shadow-2xl transition-transform duration-300 ease-out will-change-transform ${
          theme === 'dark'
            ? 'bg-[#13151b]/95 border-slate-800 text-slate-100'
            : theme === 'sepia'
            ? 'bg-[#f8eedb]/95 border-[#decbb0] text-[#3b2d1d]'
            : 'bg-white/95 border-slate-200/90 text-slate-800'
        }`}
      >
        {/* Drag / Expand / Collapse Handle on top of Player Bar for Mobile & Desktop */}
        <button 
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (hasMovedRef.current) return;
            onToggleCollapse?.();
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="absolute -top-5 left-1/2 -translate-x-1/2 w-36 h-6 flex items-center justify-center cursor-pointer touch-none group z-30"
          title={isCollapsed ? "Clique para expandir a barra de leitura (Alt+P)" : "Clique para recolher a barra (Alt+P)"}
          aria-label={isCollapsed ? "Expandir barra de leitura" : "Recolher barra de leitura"}
        >
          <div className={`w-14 h-2 rounded-full transition-all duration-200 shadow-sm ${
            theme === 'dark' 
              ? 'bg-slate-500/90 group-hover:bg-blue-400 group-hover:w-20 group-hover:h-2.5' 
              : theme === 'sepia'
              ? 'bg-[#bfa780] group-hover:bg-[#8c6b40] group-hover:w-20 group-hover:h-2.5'
              : 'bg-slate-400 group-hover:bg-blue-600 group-hover:w-20 group-hover:h-2.5'
          }`} />
        </button>

        {/* Top Reading Progress Bar */}
        <div 
          className="w-full h-1 bg-slate-200/60 dark:bg-slate-700/60 cursor-pointer overflow-hidden group"
          onClick={(e) => {
            if (tts.totalLength > 0) {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              const targetIndex = Math.floor(ratio * tts.totalLength);
              tts.jumpToIndex(targetIndex);
            }
          }}
          title="Clique para saltar no áudio da página"
        >
          <div 
            className="h-full bg-blue-600 dark:bg-blue-400 group-hover:bg-blue-500 transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* SECTION 1: Open Document, History & Page Navigator */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 min-w-0 max-w-[320px] sm:max-w-md">
            
            {/* Open / Upload Document Button */}
            <label 
              className={`p-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border shadow-2xs active:scale-95 shrink-0 ${
                theme === 'dark'
                  ? 'bg-blue-600/25 hover:bg-blue-600/40 text-blue-300 border-blue-500/40 hover:border-blue-400'
                  : theme === 'sepia'
                  ? 'bg-[#e8d7bb] hover:bg-[#dfcca8] text-[#4a3520] border-[#c8b390]'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
              }`}
              title="Abrir livro ou documento (PDF ou EPUB)"
              aria-label="Abrir livro ou documento"
            >
              <Upload size={15} className="shrink-0" />
              <span className="hidden sm:inline">Abrir</span>
              <input 
                type="file" 
                accept=".pdf,.epub" 
                onChange={onFileUpload} 
                className="hidden" 
              />
            </label>

            {/* History Button */}
            {onOpenHistory && (
              <button
                type="button"
                onClick={onOpenHistory}
                className={`p-1.5 px-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition border shadow-2xs active:scale-95 shrink-0 ${
                  theme === 'dark'
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    : theme === 'sepia'
                    ? 'bg-[#ede0c8] hover:bg-[#e4d4b8] text-[#554029] border-[#d8c5a4]'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
                title="Histórico de leituras (Alt+H)"
                aria-label="Abrir histórico de leituras"
              >
                <Clock size={15} className={theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'} />
                {historyCount > 0 && (
                  <span className="font-mono text-[10px] font-bold opacity-80">
                    {historyCount}
                  </span>
                )}
              </button>
            )}

            <div className="min-w-0 hidden lg:block">
              <p className="text-xs font-semibold truncate max-w-[130px]" title={fileName}>
                {fileName || "Nenhum arquivo"}
              </p>
            </div>

            {/* Modular Page Navigator */}
            <PageNavigator 
              currentPage={currentPage}
              totalPages={totalPages}
              theme={theme}
              onPrevPage={onPrevPage}
              onNextPage={onNextPage}
            />
          </div>

          {/* SECTION 2: Center Speech Controls */}
          <div className="flex items-center justify-center shrink-0">
            <PlaybackControls 
              isPlaying={tts.state.isPlaying}
              isPaused={tts.state.isPaused}
              theme={theme}
              onPlayPause={onTogglePlay}
              onStop={tts.stop}
              onPrevious={tts.previous}
              onNext={tts.next}
              hasPrevious={tts.currentGlobalIndex > 0}
              hasNext={tts.totalLength > 0 && tts.currentGlobalIndex < tts.totalLength - 1}
            />
          </div>

          {/* SECTION 3: Right Controls & Modular Theme/Speed Pickers */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Speed Slider */}
            <div className="hidden lg:flex items-center">
              <SpeedSlider 
                rate={tts.state.rate}
                theme={theme}
                onRateChange={tts.setRate}
              />
            </div>

            {/* Compact Voice Settings Icon */}
            {onOpenTTSSettings && (
              <button
                type="button"
                onClick={onOpenTTSSettings}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center justify-center transition border shadow-2xs active:scale-95 ${
                  theme === 'dark'
                    ? 'bg-slate-800 hover:bg-slate-700 text-indigo-400 border-slate-700 hover:text-indigo-300'
                    : theme === 'sepia'
                    ? 'bg-[#ede0c8] hover:bg-[#e4d4b8] text-[#704d1c] border-[#d8c5a4]'
                    : 'bg-slate-100 hover:bg-slate-200/80 text-indigo-600 border-slate-200'
                }`}
                title="Configurações de Voz (Alt+V)"
                aria-label="Abrir configurações de voz"
              >
                <Sliders size={16} />
              </button>
            )}

            {/* Compact Themes in Bar */}
            {onThemeChange && (
              <div className="hidden sm:block">
                <ThemePicker theme={theme} onThemeChange={onThemeChange} compact={true} />
              </div>
            )}

            {/* Bookmark Button */}
            {onToggleBookmark && (
              <button
                type="button"
                onClick={onToggleBookmark}
                className={`p-1.5 rounded-lg transition border shadow-2xs active:scale-95 ${
                  isBookmarked
                    ? 'bg-amber-500 border-amber-600 text-white'
                    : theme === 'dark'
                    ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    : theme === 'sepia'
                    ? 'bg-[#ede0c8] text-[#554029] border-[#d8c5a4] hover:bg-[#e4d4b8]'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
                title={isBookmarked ? "Remover marcador desta página" : "Adicionar marcador nesta página (Alt+B)"}
                aria-label={isBookmarked ? "Remover marcador" : "Adicionar marcador"}
              >
                <BookmarkIcon size={16} className={isBookmarked ? "fill-current" : ""} />
              </button>
            )}

            {/* Voice Command / Mic Button */}
            {onToggleListening && (
              <button
                type="button"
                onClick={onToggleListening}
                className={`p-1.5 rounded-lg transition border shadow-2xs active:scale-95 ${
                  isListening
                    ? 'bg-red-500 border-red-600 text-white animate-pulse'
                    : theme === 'dark'
                    ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    : theme === 'sepia'
                    ? 'bg-[#ede0c8] text-[#554029] border-[#d8c5a4] hover:bg-[#e4d4b8]'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
                title={isListening ? "Desativar comandos por voz" : "Ativar comandos por voz (Alt+M)"}
                aria-label={isListening ? "Desativar microfone" : "Ativar microfone"}
              >
                {isListening ? <Mic size={16} /> : <MicOff size={16} />}
              </button>
            )}

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={onToggleFullScreen}
              className={`p-1.5 rounded-lg transition border shadow-2xs active:scale-95 hidden sm:flex items-center justify-center ${
                theme === 'dark'
                  ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  : theme === 'sepia'
                  ? 'bg-[#ede0c8] text-[#554029] border-[#d8c5a4] hover:bg-[#e4d4b8]'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
              title={isFullScreen ? "Sair da tela cheia (F11)" : "Tela cheia (F11)"}
              aria-label={isFullScreen ? "Sair de tela cheia" : "Entrar em tela cheia"}
            >
              {isFullScreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>

            {/* Retract / Collapse Toggle */}
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className={`p-1.5 rounded-lg transition border shadow-2xs active:scale-95 ${
                  theme === 'dark'
                    ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    : theme === 'sepia'
                    ? 'bg-[#ede0c8] text-[#554029] border-[#d8c5a4] hover:bg-[#e4d4b8]'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
                title="Recolher barra de leitura (Alt+P)"
                aria-label="Recolher barra de controles"
              >
                <ChevronDown size={16} />
              </button>
            )}

            {/* Mobile Settings Toggle */}
            <button
              type="button"
              onClick={() => setShowMobileSettings(true)}
              className={`p-1.5 rounded-lg transition border shadow-2xs active:scale-95 md:hidden ${
                theme === 'dark'
                  ? 'bg-slate-800 text-slate-300 border-slate-700'
                  : theme === 'sepia'
                  ? 'bg-[#ede0c8] text-[#554029] border-[#d8c5a4]'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
              title="Menu e Opções"
              aria-label="Abrir menu móvel"
            >
              <Settings2 size={16} />
            </button>
          </div>

        </div>
      </footer>
    </>
  );
};
