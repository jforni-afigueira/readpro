import React from 'react';
import { Sun, Coffee, Moon } from 'lucide-react';
import { ThemeMode } from '../types';

interface ThemePickerProps {
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  compact?: boolean;
}

export const ThemePicker: React.FC<ThemePickerProps> = ({
  theme,
  onThemeChange,
  compact = false
}) => {
  if (compact) {
    return (
      <div className={`flex items-center rounded-lg p-0.5 border ${
        theme === 'dark' 
          ? 'bg-slate-800/80 border-slate-700' 
          : theme === 'sepia'
          ? 'bg-[#ede0c8] border-[#dfceb0]'
          : 'bg-slate-100 border-slate-200'
      }`}>
        <button
          type="button"
          onClick={() => onThemeChange('clean')}
          className={`p-1 rounded transition ${
            theme === 'clean' 
              ? 'bg-white text-amber-500 shadow-2xs ring-1 ring-black/5 font-bold' 
              : theme === 'dark'
              ? 'text-slate-400 hover:text-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Tema Clean (Claro)"
          aria-label="Tema Claro"
        >
          <Sun size={14} />
        </button>
        <button
          type="button"
          onClick={() => onThemeChange('sepia')}
          className={`p-1 rounded transition ${
            theme === 'sepia' 
              ? 'bg-[#f6ead2] text-[#a46e2f] shadow-2xs ring-1 ring-[#b0874c]/30 font-bold' 
              : theme === 'dark'
              ? 'text-slate-400 hover:text-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Tema Sépia (Conforto)"
          aria-label="Tema Sépia"
        >
          <Coffee size={14} />
        </button>
        <button
          type="button"
          onClick={() => onThemeChange('dark')}
          className={`p-1 rounded transition ${
            theme === 'dark' 
              ? 'bg-[#292e3b] text-amber-300 shadow-2xs ring-1 ring-amber-400/40 font-bold' 
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Tema Dark (Escuro)"
          aria-label="Tema Escuro"
        >
          <Moon size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <button
        type="button"
        onClick={() => onThemeChange('clean')}
        className={`p-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition ${
          theme === 'clean'
            ? 'bg-white border-blue-500 text-blue-700 shadow-xs ring-1 ring-blue-500'
            : theme === 'dark'
            ? 'bg-slate-800/90 border-slate-700 text-slate-300'
            : 'bg-black/5 border-transparent text-inherit'
        }`}
      >
        <Sun size={14} className="text-amber-500" />
        <span>Clean</span>
      </button>
      <button
        type="button"
        onClick={() => onThemeChange('sepia')}
        className={`p-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition ${
          theme === 'sepia'
            ? 'bg-[#f6ead2] border-[#b0874c] text-[#432d16] shadow-xs ring-1 ring-[#b0874c]'
            : theme === 'dark'
            ? 'bg-slate-800/90 border-slate-700 text-slate-300'
            : 'bg-black/5 border-transparent text-inherit'
        }`}
      >
        <Coffee size={14} className="text-[#a46e2f]" />
        <span>Sépia</span>
      </button>
      <button
        type="button"
        onClick={() => onThemeChange('dark')}
        className={`p-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition ${
          theme === 'dark'
            ? 'bg-[#292e3b] border-amber-400 text-amber-300 shadow-xs ring-1 ring-amber-400'
            : 'bg-black/5 border-transparent text-inherit'
        }`}
      >
        <Moon size={14} className="text-indigo-400" />
        <span>Dark</span>
      </button>
    </div>
  );
};
