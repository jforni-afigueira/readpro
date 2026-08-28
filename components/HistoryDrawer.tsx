import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, BookOpen, Clock, FileText, Trash2, ArrowRight, 
  AlertTriangle, CheckCircle2, Loader2 
} from 'lucide-react';
import { ReadingHistoryItem, ThemeMode } from '../types';
import { getAllHistory, deleteBookFromHistory, clearAllHistory } from '../utils/indexedDBStorage';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentFileName: string;
  onSelectBook: (bookId: string) => void;
  onHistoryCleared?: () => void;
  onBookDeleted?: (bookId: string) => void;
  theme?: ThemeMode;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  currentFileName,
  onSelectBook,
  onHistoryCleared,
  onBookDeleted,
  theme = 'clean',
}) => {
  const [historyList, setHistoryList] = useState<ReadingHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // In-app confirmation dialog states (no window.confirm which is blocked in iframes)
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<ReadingHistoryItem | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const isDark = theme === 'dark';
  const isSepia = theme === 'sepia';

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const items = await getAllHistory();
      setHistoryList(items);
    } catch (err) {
      console.warn('Erro ao carregar histórico:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
      setShowClearConfirm(false);
      setBookToDelete(null);
      setActionSuccessMessage(null);
    }
  }, [isOpen, fetchHistory]);

  // Handle single item deletion with in-app confirmation
  const handleConfirmDeleteBook = async () => {
    if (!bookToDelete) return;
    const targetId = bookToDelete.id;
    setIsDeletingId(targetId);
    try {
      await deleteBookFromHistory(targetId);
      setHistoryList(prev => prev.filter(item => item.id !== targetId));
      setBookToDelete(null);
      setActionSuccessMessage('Livro removido do histórico.');
      setTimeout(() => setActionSuccessMessage(null), 3000);
      if (onBookDeleted) {
        onBookDeleted(targetId);
      }
    } catch (err) {
      console.error('Falha ao remover livro do histórico:', err);
    } finally {
      setIsDeletingId(null);
    }
  };

  // Handle clear all history with in-app confirmation
  const handleConfirmClearAll = async () => {
    setIsClearing(true);
    try {
      await clearAllHistory();
      setHistoryList([]);
      setShowClearConfirm(false);
      setActionSuccessMessage('Todo o histórico foi limpo com sucesso.');
      setTimeout(() => setActionSuccessMessage(null), 3000);
      if (onHistoryCleared) {
        onHistoryCleared();
      }
    } catch (err) {
      console.error('Falha ao limpar histórico:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[70] flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-drawer-title"
    >
      <div 
        className={`w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 relative border-l transition-colors ${
          isDark 
            ? 'bg-[#181a20] border-slate-800 text-slate-100' 
            : isSepia 
            ? 'bg-[#f4ecd8] border-[#dfcca8] text-[#3d2c1b]' 
            : 'bg-white border-slate-100 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className={`p-5 border-b flex items-center justify-between shrink-0 ${
          isDark 
            ? 'border-slate-800 bg-[#121418]' 
            : isSepia 
            ? 'border-[#e2cfab] bg-[#ede0c8]' 
            : 'border-slate-100 bg-slate-50/80'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-md ${
              isDark 
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' 
                : isSepia 
                ? 'bg-[#d8c09a] text-[#422c16] border border-[#c5a97d]' 
                : 'bg-indigo-600 text-white shadow-indigo-500/20'
            }`}>
              <Clock size={20} />
            </div>
            <div>
              <h2 id="history-drawer-title" className={`text-lg font-bold leading-tight ${
                isDark ? 'text-slate-100' : isSepia ? 'text-[#382613]' : 'text-slate-900'
              }`}>
                Histórico de Leitura
              </h2>
              <p className={`text-xs ${
                isDark ? 'text-slate-400' : isSepia ? 'text-[#735c44]' : 'text-slate-500'
              }`}>
                Livros salvos e posições recentes
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-full transition ${
              isDark 
                ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800' 
                : isSepia 
                ? 'text-[#735c44] hover:text-[#382613] hover:bg-[#e4d4b8]' 
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/60'
            }`}
            aria-label="Fechar histórico de leitura"
          >
            <X size={20} />
          </button>
        </div>

        {/* Action success toast inside drawer */}
        {actionSuccessMessage && (
          <div className={`mx-4 mt-3 p-3 rounded-xl text-xs flex items-center gap-2 border animate-in fade-in slide-in-from-top-2 ${
            isDark 
              ? 'bg-emerald-950/50 border-emerald-800/80 text-emerald-300' 
              : isSepia 
              ? 'bg-[#e2edd8] border-[#b9d6a3] text-[#2c4e1a]' 
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}>
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            <span className="font-medium">{actionSuccessMessage}</span>
          </div>
        )}

        {/* Clear All Confirmation Banner */}
        {showClearConfirm && (
          <div className={`m-4 p-4 rounded-2xl border animate-in fade-in slide-in-from-top-2 ${
            isDark 
              ? 'bg-rose-950/40 border-rose-900/60 text-rose-200' 
              : isSepia 
              ? 'bg-[#f7dfdf] border-[#e8b6b6] text-rose-900' 
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                isDark ? 'bg-rose-900/50 text-rose-300' : 'bg-rose-100 text-rose-600'
              }`}>
                <AlertTriangle size={18} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold mb-1">
                  Limpar todo o histórico?
                </h4>
                <p className={`text-xs leading-relaxed mb-3 opacity-90 ${
                  isDark ? 'text-rose-300' : 'text-rose-700'
                }`}>
                  Todos os livros salvos ({historyList.length}) e suas posições de leitura serão apagados permanentemente do armazenamento local.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleConfirmClearAll}
                    disabled={isClearing}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    {isClearing ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Limpando...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 size={14} />
                        <span>Sim, Limpar Tudo</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    disabled={isClearing}
                    className={`px-3.5 py-2 rounded-xl text-xs font-medium transition border ${
                      isDark 
                        ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200' 
                        : isSepia 
                        ? 'bg-[#ede0c8] border-[#d8c5a4] hover:bg-[#e4d4b8] text-[#3d2c1b]' 
                        : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Single Book Delete Confirmation Modal/Banner */}
        {bookToDelete && !showClearConfirm && (
          <div className={`m-4 p-4 rounded-2xl border animate-in fade-in slide-in-from-top-2 ${
            isDark 
              ? 'bg-amber-950/40 border-amber-900/60 text-amber-200' 
              : isSepia 
              ? 'bg-[#faecd4] border-[#e7cca0] text-[#4a3520]' 
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                isDark ? 'bg-amber-900/50 text-amber-300' : 'bg-amber-100 text-amber-700'
              }`}>
                <Trash2 size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold mb-1">
                  Remover livro do histórico?
                </h4>
                <p className="text-xs leading-relaxed mb-3 truncate opacity-90">
                  "{bookToDelete.fileName}"
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleConfirmDeleteBook}
                    disabled={isDeletingId === bookToDelete.id}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                  >
                    {isDeletingId === bookToDelete.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                    <span>Remover</span>
                  </button>
                  <button
                    onClick={() => setBookToDelete(null)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-medium transition border ${
                      isDark 
                        ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200' 
                        : isSepia 
                        ? 'bg-[#ede0c8] border-[#d8c5a4] hover:bg-[#e4d4b8] text-[#3d2c1b]' 
                        : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className={`text-center py-12 text-sm flex flex-col items-center gap-2 ${
              isDark ? 'text-slate-400' : isSepia ? 'text-[#735c44]' : 'text-slate-400'
            }`}>
              <Loader2 size={24} className="animate-spin text-indigo-500" />
              <span>Carregando histórico...</span>
            </div>
          )}

          {!loading && historyList.length === 0 && (
            <div className={`text-center py-16 px-6 ${
              isDark ? 'text-slate-400' : isSepia ? 'text-[#735c44]' : 'text-slate-400'
            }`}>
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                isDark ? 'bg-slate-800 text-slate-400' : isSepia ? 'bg-[#e8d7bb] text-[#735c44]' : 'bg-slate-100 text-slate-400'
              }`}>
                <BookOpen size={32} className="opacity-40" />
              </div>
              <h3 className={`font-semibold mb-1 ${
                isDark ? 'text-slate-200' : isSepia ? 'text-[#382613]' : 'text-slate-700'
              }`}>Histórico vazio</h3>
              <p className={`text-xs max-w-xs mx-auto ${
                isDark ? 'text-slate-500' : isSepia ? 'text-[#846b51]' : 'text-slate-500'
              }`}>
                Ao abrir arquivos PDF ou EPUB, sua posição de leitura será salva automaticamente aqui.
              </p>
            </div>
          )}

          {!loading && historyList.map((item) => {
            const isCurrent = item.fileName === currentFileName;
            const progressPercent = item.totalPages > 0 
              ? Math.min(100, Math.round((item.currentPage / item.totalPages) * 100))
              : 0;

            return (
              <div
                key={item.id}
                onClick={() => {
                  onSelectBook(item.id);
                  onClose();
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer group relative ${
                  isCurrent
                    ? isDark 
                      ? 'border-indigo-500/70 bg-indigo-950/30 shadow-md ring-1 ring-indigo-500/30' 
                      : isSepia 
                      ? 'border-[#8c6536] bg-[#ebd8b7] shadow-xs ring-1 ring-[#8c6536]/30' 
                      : 'border-indigo-400 bg-indigo-50/50 shadow-sm'
                    : isDark 
                      ? 'border-slate-800 bg-[#20232a] hover:border-slate-700 hover:bg-[#262a33]' 
                      : isSepia 
                      ? 'border-[#e4d4b8] bg-[#fbf5e8] hover:border-[#d4be9b] hover:bg-[#f5ebd6]' 
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      item.fileType === 'pdf' 
                        ? isDark ? 'bg-rose-950/60 text-rose-400' : 'bg-rose-100 text-rose-700'
                        : isDark ? 'bg-emerald-950/60 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      <FileText size={18} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm truncate block transition ${
                          isDark 
                            ? 'text-slate-100 group-hover:text-indigo-300' 
                            : isSepia 
                            ? 'text-[#382613] group-hover:text-[#6e481f]' 
                            : 'text-slate-900 group-hover:text-indigo-600'
                        }`}>
                          {item.fileName}
                        </span>
                        {isCurrent && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            isDark 
                              ? 'bg-indigo-600 text-white' 
                              : isSepia 
                              ? 'bg-[#8c6536] text-white' 
                              : 'bg-indigo-600 text-white'
                          }`}>
                            Atual
                          </span>
                        )}
                      </div>

                      <div className={`flex items-center gap-2 mt-1 text-xs font-medium ${
                        isDark ? 'text-slate-400' : isSepia ? 'text-[#735c44]' : 'text-slate-500'
                      }`}>
                        <span>Página {item.currentPage}{item.totalPages > 0 ? ` de ${item.totalPages}` : ''}</span>
                        <span>•</span>
                        <span>{formatFileSize(item.fileSize)}</span>
                        <span>•</span>
                        <span>{item.fileType.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowClearConfirm(false);
                      setBookToDelete(item);
                    }}
                    className={`p-1.5 rounded-lg transition shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 ${
                      isDark 
                        ? 'text-slate-500 hover:text-rose-400 hover:bg-rose-950/40' 
                        : isSepia 
                        ? 'text-[#a18868] hover:text-rose-700 hover:bg-rose-100/50' 
                        : 'text-slate-300 hover:text-rose-600 hover:bg-rose-50'
                    }`}
                    title={`Remover ${item.fileName} do histórico`}
                    aria-label={`Remover ${item.fileName} do histórico`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Progress bar */}
                {item.totalPages > 0 && (
                  <div className="mt-3">
                    <div className={`flex items-center justify-between text-[11px] mb-1 ${
                      isDark ? 'text-slate-400' : isSepia ? 'text-[#735c44]' : 'text-slate-400'
                    }`}>
                      <span>Progresso</span>
                      <span className={`font-mono font-bold ${
                        isDark ? 'text-slate-200' : isSepia ? 'text-[#382613]' : 'text-slate-700'
                      }`}>{progressPercent}%</span>
                    </div>
                    <div className={`h-1.5 rounded-full overflow-hidden ${
                      isDark ? 'bg-slate-700' : isSepia ? 'bg-[#dfcca8]' : 'bg-slate-100'
                    }`}>
                      <div
                        className={`h-full transition-all rounded-full ${
                          isDark ? 'bg-indigo-500' : isSepia ? 'bg-[#8c6536]' : 'bg-indigo-600'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className={`mt-2.5 pt-2 border-t flex items-center justify-between text-[11px] ${
                  isDark 
                    ? 'border-slate-800 text-slate-400' 
                    : isSepia 
                    ? 'border-[#e6d8c0] text-[#735c44]' 
                    : 'border-slate-100/80 text-slate-400'
                }`}>
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {formatDate(item.lastReadAt)}
                  </span>

                  <span className={`font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 ${
                    isDark ? 'text-indigo-400' : isSepia ? 'text-[#8c6536]' : 'text-indigo-600'
                  }`}>
                    Continuar lendo <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {historyList.length > 0 && (
          <div className={`p-4 border-t flex items-center justify-between shrink-0 ${
            isDark 
              ? 'border-slate-800 bg-[#121418]' 
              : isSepia 
              ? 'border-[#e2cfab] bg-[#ede0c8]' 
              : 'border-slate-100 bg-slate-50/70'
          }`}>
            <button
              onClick={() => {
                setBookToDelete(null);
                setShowClearConfirm(true);
              }}
              className={`text-xs font-semibold flex items-center gap-1.5 px-3 py-2 rounded-xl border transition ${
                isDark 
                  ? 'text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border-transparent hover:border-rose-900' 
                  : isSepia 
                  ? 'text-rose-800 hover:text-rose-900 hover:bg-[#fadad8] border-transparent hover:border-rose-300' 
                  : 'text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-transparent hover:border-rose-200'
              }`}
              aria-label="Abrir confirmação para limpar todo o histórico de leitura"
            >
              <Trash2 size={14} />
              <span>Limpar Histórico</span>
            </button>

            <span className={`text-xs font-medium ${
              isDark ? 'text-slate-400' : isSepia ? 'text-[#735c44]' : 'text-slate-400'
            }`}>
              {historyList.length} {historyList.length === 1 ? 'livro salvo' : 'livros salvos'}
            </span>
          </div>
        )}

      </div>
    </div>
  );
};
