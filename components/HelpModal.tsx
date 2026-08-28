import React from 'react';
import { X, Mic, Command } from 'lucide-react';
import { ThemeMode } from '../types';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: ThemeMode;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, theme = 'clean' }) => {
  if (!isOpen) return null;

  const isDark = theme === 'dark';
  const isSepia = theme === 'sepia';

  const commands = [
    { cat: "Navegação por Parágrafo", cmd: "Avançar parágrafo / Próximo parágrafo", desc: "Avança a leitura diretamente para o próximo bloco/parágrafo do texto." },
    { cat: "Navegação por Parágrafo", cmd: "Voltar parágrafo / Parágrafo anterior", desc: "Recua a leitura para o parágrafo anterior." },
    { cat: "Temas e Aparência", cmd: "Modo Sépia / Modo Escuro / Modo Clean", desc: "Altera instantaneamente a paleta visual de leitura (Sépia confortável, Dark ou Clean claro)." },
    { cat: "Temas e Aparência", cmd: "Aumentar fonte / Diminuir fonte", desc: "Ajusta dinamicamente a tipografia e o tamanho do texto (EPUB)." },
    { cat: "Controles & Espaço", cmd: "Recolher barra / Esconder player", desc: "Recolhe a barra inferior deixando apenas a aba de puxar para maximizar a área de leitura (Atalho: Alt+P)." },
    { cat: "Controles & Espaço", cmd: "Mostrar barra / Revelar player", desc: "Revela os controles completos da barra inferior ao puxar a aba ou clicar na borda inferior." },
    { cat: "Biblioteca", cmd: "Carregar livro / Trocar livro", desc: "Abre o seletor para carregar um novo PDF ou EPUB (Atalho: Alt+U ou Alt+L)." },
    { cat: "Histórico", cmd: "Abrir histórico / Ver histórico", desc: "Abre os livros salvos e posições recentes com contagem automática (Atalho: Alt+H)." },
    { cat: "Voz & Áudio", cmd: "Configurar voz / Ajustar tom", desc: "Abre o menu para escolher vozes e tom (Atalho: Alt+V)." },
    { cat: "Marcadores", cmd: "Salvar marcador / Marcar página", desc: "Salva a página atual nos seus marcadores (Atalho: Alt+M)." },
    { cat: "Marcadores", cmd: "Abrir marcadores / Ver marcadores", desc: "Abre o painel de marcadores (Atalho: Alt+B)." },
    { cat: "Marcadores", cmd: "Próximo marcador / Marcador anterior", desc: "Pula diretamente entre as páginas marcadas." },
    { cat: "Marcadores", cmd: "Remover marcador / Desmarcar", desc: "Remove o marcador da página atual." },
    { cat: "Navegação de Páginas", cmd: "Próxima página / Página anterior", desc: "Navega sequencialmente pelas páginas ou capítulos." },
    { cat: "Navegação de Páginas", cmd: "Ir para página [número]", desc: "Pula para uma página específica (ex: 'Ir para página 10')." },
    { cat: "Leitura", cmd: "Ler / Continuar / Tocar", desc: "Inicia ou retoma a leitura em voz alta." },
    { cat: "Leitura", cmd: "Pausar / Parar", desc: "Pausa ou interrompe a leitura." },
    { cat: "Velocidade", cmd: "Aumentar / Diminuir velocidade", desc: "Ajusta o ritmo da fala do narrador." },
    { cat: "Visualização", cmd: "Aumentar / Diminuir Zoom", desc: "Ajusta o zoom da visualização." },
    { cat: "Visualização", cmd: "Tela cheia / Sair da tela cheia", desc: "Alterna tela cheia do navegador." },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className={`rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border transition-colors ${
        isDark 
          ? 'bg-[#181a20] border-slate-800 text-slate-100' 
          : isSepia 
          ? 'bg-[#f4ecd8] border-[#dfcca8] text-[#3d2c1b]' 
          : 'bg-white border-slate-100 text-slate-900'
      }`}>
        
        {/* Header */}
        <div className={`p-4 flex items-center justify-between shrink-0 ${
          isDark 
            ? 'bg-[#121418] text-white border-b border-slate-800' 
            : isSepia 
            ? 'bg-[#ede0c8] text-[#382613] border-b border-[#e2cfab]' 
            : 'bg-slate-900 text-white'
        }`}>
          <div className="flex items-center gap-2">
            <Command className={isDark ? 'text-blue-400' : isSepia ? 'text-[#8c6536]' : 'text-blue-400'} />
            <h2 className="text-lg font-bold">Comandos de Voz & Atalhos</h2>
          </div>
          <button 
            onClick={onClose} 
            className={`p-1.5 rounded-full transition ${
              isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : isSepia ? 'hover:bg-[#dfcca8] text-[#735c44] hover:text-[#382613]' : 'hover:bg-white/10 text-slate-400 hover:text-white'
            }`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          <p className={`text-xs leading-relaxed ${
            isDark ? 'text-slate-400' : isSepia ? 'text-[#735c44]' : 'text-slate-600'
          }`}>
            Ative o microfone na barra inferior e diga os comandos abaixo para controlar o leitor sem usar as mãos.
          </p>

          <div className="space-y-3">
            {commands.map((item, idx) => (
              <div key={idx} className={`flex flex-col pb-3 border-b last:border-0 last:pb-0 ${
                isDark ? 'border-slate-800' : isSepia ? 'border-[#e4d4b8]' : 'border-slate-100'
              }`}>
                <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${
                  isDark ? 'text-blue-400' : isSepia ? 'text-[#8c6536]' : 'text-blue-600'
                }`}>{item.cat}</span>
                <div className="flex items-start gap-3">
                   <Mic size={16} className={`mt-1 shrink-0 ${
                     isDark ? 'text-slate-500' : isSepia ? 'text-[#a18868]' : 'text-slate-400'
                   }`} />
                   <div>
                     <strong className={`block text-sm ${
                       isDark ? 'text-slate-200' : isSepia ? 'text-[#382613]' : 'text-slate-800'
                     }`}>{item.cmd}</strong>
                     <span className={`text-xs ${
                       isDark ? 'text-slate-400' : isSepia ? 'text-[#735c44]' : 'text-slate-500'
                     }`}>{item.desc}</span>
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className={`p-4 border-t text-center shrink-0 ${
          isDark 
            ? 'bg-[#121418] border-slate-800' 
            : isSepia 
            ? 'bg-[#ede0c8] border-[#e2cfab]' 
            : 'bg-slate-50 border-slate-200'
        }`}>
           <button 
             onClick={onClose}
             className={`px-6 py-2 rounded-full font-semibold text-xs transition ${
               isDark 
                 ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' 
                 : isSepia 
                 ? 'bg-[#8c6536] hover:bg-[#73522b] text-white' 
                 : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
             }`}
           >
             Entendi
           </button>
        </div>
      </div>
    </div>
  );
};
