import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ThemeMode } from '../types';

interface PageNavigatorProps {
  currentPage: number;
  totalPages: number;
  theme: ThemeMode;
  onPrevPage: () => void;
  onNextPage: () => void;
  onPageChange?: (page: number) => void;
}

export const PageNavigator: React.FC<PageNavigatorProps> = ({
  currentPage,
  totalPages,
  theme,
  onPrevPage,
  onNextPage,
  onPageChange,
}) => {
  return (
    <div className="flex items-center gap-1">
      {/* Previous Page Button */}
      <button
        type="button"
        onClick={onPrevPage}
        disabled={currentPage <= 1}
        className={`p-1.5 rounded-lg border transition active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${
          theme === 'dark'
            ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            : theme === 'sepia'
            ? 'bg-[#f4e6cf] hover:bg-[#ebd8bd] text-[#4a3825] border-[#d8c5a6]'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
        }`}
        title="Página Anterior (Page Up ou [)"
        aria-label="Página anterior"
      >
        <ChevronLeft size={16} />
      </button>

      {/* Page Display */}
      <div className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1 shadow-2xs ${
        theme === 'dark'
          ? 'bg-slate-800 text-slate-200 border-slate-700'
          : theme === 'sepia'
          ? 'bg-[#f4e6cf] text-[#4a3825] border-[#d8c5a6]'
          : 'bg-slate-50 text-slate-700 border-slate-200'
      }`}>
        <span>Pág.</span>
        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
          {currentPage}
        </span>
        <span className="opacity-40">/</span>
        <span className="font-mono opacity-80">{totalPages || 1}</span>
      </div>

      {/* Next Page Button */}
      <button
        type="button"
        onClick={onNextPage}
        disabled={currentPage >= totalPages && totalPages > 0}
        className={`p-1.5 rounded-lg border transition active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${
          theme === 'dark'
            ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            : theme === 'sepia'
            ? 'bg-[#f4e6cf] hover:bg-[#ebd8bd] text-[#4a3825] border-[#d8c5a6]'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
        }`}
        title="Próxima Página (Page Down ou ])"
        aria-label="Próxima página"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
};
