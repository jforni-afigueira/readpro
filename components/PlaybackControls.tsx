import React from 'react';
import { Play, Pause, Square, SkipBack, SkipForward } from 'lucide-react';
import { ThemeMode } from '../types';

interface PlaybackControlsProps {
  isPlaying: boolean;
  isPaused: boolean;
  theme: ThemeMode;
  onPlayPause: () => void;
  onStop: () => void;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  isPaused,
  theme,
  onPlayPause,
  onStop,
  onPrevious,
  onNext,
  hasPrevious = true,
  hasNext = true,
}) => {
  const isPlayingActive = isPlaying && !isPaused;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* Previous Paragraph / Chunk */}
      <button
        type="button"
        onClick={onPrevious}
        disabled={!hasPrevious}
        className={`p-2 rounded-full transition active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${
          theme === 'dark'
            ? 'text-slate-300 hover:text-white hover:bg-slate-800'
            : theme === 'sepia'
            ? 'text-[#5a4228] hover:bg-[#ede0c8]'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
        }`}
        title="Parágrafo Anterior (← ou Alt+←)"
        aria-label="Voltar para o parágrafo anterior"
      >
        <SkipBack size={18} />
      </button>

      {/* Main Play / Pause Button */}
      <button
        type="button"
        onClick={onPlayPause}
        className={`p-3 sm:p-3.5 rounded-full shadow-md flex items-center justify-center transition-all duration-150 transform active:scale-90 ${
          isPlayingActive
            ? 'bg-amber-500 hover:bg-amber-600 text-white ring-4 ring-amber-500/20'
            : 'bg-blue-600 hover:bg-blue-700 text-white ring-4 ring-blue-600/20 shadow-blue-600/30'
        }`}
        title={isPlayingActive ? "Pausar leitura (Espaço ou Alt+K)" : "Iniciar / Retomar leitura (Espaço ou Alt+K)"}
        aria-label={isPlayingActive ? "Pausar leitura de voz" : "Iniciar leitura de voz"}
      >
        {isPlayingActive ? (
          <Pause size={20} className="fill-current" />
        ) : (
          <Play size={20} className="fill-current ml-0.5" />
        )}
      </button>

      {/* Stop Button */}
      <button
        type="button"
        onClick={onStop}
        disabled={!isPlaying && !isPaused}
        className={`p-2 rounded-full transition active:scale-95 disabled:opacity-20 disabled:pointer-events-none ${
          theme === 'dark'
            ? 'text-red-400 hover:bg-red-950/40'
            : theme === 'sepia'
            ? 'text-red-700 hover:bg-red-100/60'
            : 'text-red-600 hover:bg-red-50'
        }`}
        title="Parar Leitura (Esc)"
        aria-label="Parar leitura"
      >
        <Square size={16} className="fill-current" />
      </button>

      {/* Next Paragraph / Chunk */}
      <button
        type="button"
        onClick={onNext}
        disabled={!hasNext}
        className={`p-2 rounded-full transition active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${
          theme === 'dark'
            ? 'text-slate-300 hover:text-white hover:bg-slate-800'
            : theme === 'sepia'
            ? 'text-[#5a4228] hover:bg-[#ede0c8]'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
        }`}
        title="Próximo Parágrafo (→ ou Alt+→)"
        aria-label="Avançar para o próximo parágrafo"
      >
        <SkipForward size={18} />
      </button>
    </div>
  );
};
