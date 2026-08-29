import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Volume2, Mic, Sliders, Check, Play, Square, 
  RotateCcw, Sparkles, User, UserCheck, Music
} from 'lucide-react';
import { SmartTTSHook, ThemeMode } from '../types';

interface TTSSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tts: SmartTTSHook;
  theme?: ThemeMode;
}

type VoiceFilter = 'all-pt' | 'female' | 'male' | 'all';

interface VoiceInfo {
  voice: SpeechSynthesisVoice;
  gender: 'female' | 'male' | 'neutral';
  isPT: boolean;
  isNatural: boolean;
  displayName: string;
}

export const TTSSettingsModal: React.FC<TTSSettingsModalProps> = ({
  isOpen,
  onClose,
  tts,
  theme = 'clean',
}) => {
  const [filter, setFilter] = useState<VoiceFilter>('all-pt');
  const [isPlayingSample, setIsPlayingSample] = useState(false);
  const sampleUtteranceRef = React.useRef<SpeechSynthesisUtterance | null>(null);

  const isDark = theme === 'dark';
  const isSepia = theme === 'sepia';

  const voices = tts.getVoices();

  // Helper to categorize voices
  const categorizedVoices = useMemo<VoiceInfo[]>(() => {
    const femaleKeywords = [
      'luciana', 'maria', 'francisca', 'vitória', 'vitoria', 'letícia', 'leticia',
      'helena', 'camila', 'raquel', 'fernanda', 'thalita', 'female', 'zira', 'samantha',
      'yara', 'joana', 'ines', 'inês', 'celia', 'catarina', 'clara', 'eva'
    ];
    const maleKeywords = [
      'daniel', 'felipe', 'ricardo', 'antonio', 'antônio', 'male', 'david',
      'george', 'jorge', 'manuel', 'lucas', 'dinis', 'duarte', 'tiago', 'carlos'
    ];

    return voices.filter(Boolean).map((v) => {
      const lowerName = (v.name || '').toLowerCase();
      const lang = (v.lang || '').replace('_', '-').toLowerCase();
      const isPT = lang.startsWith('pt');
      let gender: 'female' | 'male' | 'neutral' = 'neutral';

      if (femaleKeywords.some(kw => lowerName.includes(kw))) {
        gender = 'female';
      } else if (maleKeywords.some(kw => lowerName.includes(kw))) {
        gender = 'male';
      }

      const isNatural = /natural|neural|online|premium/i.test(v.name || '');
      const displayName = (v.name || '')
        .replace(/Microsoft |Google |Apple |Natural |Neural /gi, '')
        .replace(/\(pt-[A-Z]+\)/gi, '')
        .trim();

      return {
        voice: v,
        gender,
        isPT,
        isNatural,
        displayName: displayName || v.name || 'Voz',
      };
    });
  }, [voices]);

  // Filter voices based on tab selection
  const visibleVoices = useMemo(() => {
    let list = categorizedVoices;

    if (filter === 'all-pt') {
      list = list.filter(v => v.isPT);
    } else if (filter === 'female') {
      list = list.filter(v => v.gender === 'female');
    } else if (filter === 'male') {
      list = list.filter(v => v.gender === 'male');
    }

    return list.sort((a, b) => {
      if (a.isPT !== b.isPT) return a.isPT ? -1 : 1;
      if (a.isNatural !== b.isNatural) return a.isNatural ? -1 : 1;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [categorizedVoices, filter]);

  // Stop sample speech when modal closes or unmounts
  useEffect(() => {
    if (!isOpen) {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      setIsPlayingSample(false);
    }
  }, [isOpen]);

  const handlePlaySample = (overrideVoiceURI?: string) => {
    const targetVoiceURI = overrideVoiceURI || tts.state.voiceURI;
    
    if (isPlayingSample) {
      window.speechSynthesis.cancel();
      setIsPlayingSample(false);
      return;
    }

    window.speechSynthesis.cancel();

    const voice = voices.find(v => v.voiceURI === targetVoiceURI);
    const sampleText = "Olá! Esta é uma demonstração da minha voz para a leitura dos seus livros e documentos.";
    const u = new SpeechSynthesisUtterance(sampleText);

    u.rate = tts.state.rate;
    u.pitch = tts.state.pitch;
    u.volume = 1.0;
    u.lang = voice?.lang || 'pt-BR';
    if (voice) u.voice = voice;

    u.onend = () => setIsPlayingSample(false);
    u.onerror = () => setIsPlayingSample(false);

    sampleUtteranceRef.current = u;
    setIsPlayingSample(true);
    window.speechSynthesis.speak(u);
  };

  const handleResetDefaults = () => {
    tts.setRate(1.5);
    tts.setPitch(1.0);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tts-settings-title"
    >
      <div className={`rounded-3xl shadow-2xl border w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors ${
        isDark 
          ? 'bg-[#181a20] border-slate-800 text-slate-100' 
          : isSepia 
          ? 'bg-[#f4ecd8] border-[#dfcca8] text-[#3d2c1b]' 
          : 'bg-white border-slate-100 text-slate-900'
      }`}>
        
        {/* Header */}
        <div className={`px-6 py-5 border-b flex items-center justify-between shrink-0 ${
          isDark 
            ? 'border-slate-800 bg-[#121418]' 
            : isSepia 
            ? 'border-[#e2cfab] bg-[#ede0c8]' 
            : 'border-slate-100 bg-slate-50/70'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-md ${
              isDark 
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                : isSepia 
                ? 'bg-[#d8c09a] text-[#422c16] border border-[#c5a97d]' 
                : 'bg-blue-600 text-white shadow-blue-500/20'
            }`}>
              <Sliders size={20} />
            </div>
            <div>
              <h2 id="tts-settings-title" className={`text-lg font-bold leading-tight ${
                isDark ? 'text-slate-100' : isSepia ? 'text-[#382613]' : 'text-slate-900'
              }`}>
                Configurações de Voz & Áudio
              </h2>
              <p className={`text-xs ${
                isDark ? 'text-slate-400' : isSepia ? 'text-[#735c44]' : 'text-slate-500'
              }`}>
                Personalize o timbre, velocidade e voz do narrador
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
            aria-label="Fechar configurações de voz"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Section 1: Pitch (Tom da Voz) */}
          <div className={`rounded-2xl p-4 border transition-colors ${
            isDark 
              ? 'bg-[#20232a] border-slate-800' 
              : isSepia 
              ? 'bg-[#ebd8b7] border-[#dcc59f]' 
              : 'bg-slate-50/80 border-slate-100'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Music size={16} className={isDark ? 'text-indigo-400' : isSepia ? 'text-[#8c6536]' : 'text-indigo-600'} />
                <label htmlFor="pitch-slider" className={`text-sm font-bold ${
                  isDark ? 'text-slate-200' : isSepia ? 'text-[#382613]' : 'text-slate-800'
                }`}>
                  Tom da Voz (Pitch)
                </label>
              </div>
              <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full border ${
                isDark 
                  ? 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60' 
                  : isSepia 
                  ? 'bg-[#dfcaa7] text-[#422c16] border-[#caa87c]' 
                  : 'text-indigo-700 bg-indigo-50 border-indigo-100'
              }`}>
                {tts.state.pitch.toFixed(2)}x {tts.state.pitch < 0.95 ? '(Grave)' : tts.state.pitch > 1.05 ? '(Agudo)' : '(Natural)'}
              </span>
            </div>

            <p className={`text-xs mb-3 ${
              isDark ? 'text-slate-400' : isSepia ? 'text-[#735c44]' : 'text-slate-500'
            }`}>
              Ajuste para deixar a voz mais encorpada/grave ou mais fina/aguda.
            </p>

            <div className="flex items-center gap-3 mb-3">
              <span className={`text-xs font-semibold ${
                isDark ? 'text-slate-400' : isSepia ? 'text-[#735c44]' : 'text-slate-500'
              }`}>Grave (0.5x)</span>
              <input
                id="pitch-slider"
                type="range"
                min="0.5"
                max="1.6"
                step="0.05"
                value={tts.state.pitch}
                onChange={(e) => tts.setPitch(parseFloat(e.target.value))}
                className={`flex-1 h-2 rounded-lg appearance-none cursor-pointer border transition-colors ${
                  isDark 
                    ? 'bg-slate-700 hover:bg-slate-600 border-slate-600 accent-indigo-500' 
                    : isSepia 
                    ? 'bg-[#dfcca8] hover:bg-[#d4be9b] border-[#caa87c] accent-[#8c6536]' 
                    : 'bg-slate-200 hover:bg-slate-300 border-slate-300 accent-indigo-600'
                }`}
                aria-label="Ajustar tom da voz"
              />
              <span className={`text-xs font-semibold ${
                isDark ? 'text-slate-400' : isSepia ? 'text-[#735c44]' : 'text-slate-500'
              }`}>Agudo (1.6x)</span>
            </div>

            {/* Quick Pitch Presets */}
            <div className="flex items-center gap-2 pt-1">
              <span className={`text-[11px] font-semibold ${
                isDark ? 'text-slate-400' : isSepia ? 'text-[#735c44]' : 'text-slate-400'
              }`}>Predefinições:</span>
              <button
                onClick={() => tts.setPitch(0.8)}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                  Math.abs(tts.state.pitch - 0.8) < 0.04
                    ? isDark ? 'bg-indigo-600 text-white shadow-xs' : isSepia ? 'bg-[#8c6536] text-white shadow-xs' : 'bg-indigo-600 text-white shadow-sm'
                    : isDark ? 'bg-[#181a20] text-slate-300 border border-slate-700 hover:bg-slate-800' : isSepia ? 'bg-[#fbf5e8] text-[#3d2c1b] border border-[#d8c5a4] hover:bg-[#f5ebd6]' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Grave (0.8x)
              </button>
              <button
                onClick={() => tts.setPitch(1.0)}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                  Math.abs(tts.state.pitch - 1.0) < 0.04
                    ? isDark ? 'bg-indigo-600 text-white shadow-xs' : isSepia ? 'bg-[#8c6536] text-white shadow-xs' : 'bg-indigo-600 text-white shadow-sm'
                    : isDark ? 'bg-[#181a20] text-slate-300 border border-slate-700 hover:bg-slate-800' : isSepia ? 'bg-[#fbf5e8] text-[#3d2c1b] border border-[#d8c5a4] hover:bg-[#f5ebd6]' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Normal (1.0x)
              </button>
              <button
                onClick={() => tts.setPitch(1.2)}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                  Math.abs(tts.state.pitch - 1.2) < 0.04
                    ? isDark ? 'bg-indigo-600 text-white shadow-xs' : isSepia ? 'bg-[#8c6536] text-white shadow-xs' : 'bg-indigo-600 text-white shadow-sm'
                    : isDark ? 'bg-[#181a20] text-slate-300 border border-slate-700 hover:bg-slate-800' : isSepia ? 'bg-[#fbf5e8] text-[#3d2c1b] border border-[#d8c5a4] hover:bg-[#f5ebd6]' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Agudo (1.2x)
              </button>
            </div>
          </div>

          {/* Section 2: Rate (Velocidade de Leitura) */}
          <div className={`rounded-2xl p-4 border transition-colors ${
            isDark 
              ? 'bg-[#20232a] border-slate-800' 
              : isSepia 
              ? 'bg-[#ebd8b7] border-[#dcc59f]' 
              : 'bg-slate-50/80 border-slate-100'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sliders size={16} className={isDark ? 'text-blue-400' : isSepia ? 'text-[#8c6536]' : 'text-blue-600'} />
                <label htmlFor="rate-slider" className={`text-sm font-bold ${
                  isDark ? 'text-slate-200' : isSepia ? 'text-[#382613]' : 'text-slate-800'
                }`}>
                  Velocidade de Leitura
                </label>
              </div>
              <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full border ${
                isDark 
                  ? 'bg-blue-950/60 text-blue-300 border-blue-800/60' 
                  : isSepia 
                  ? 'bg-[#dfcaa7] text-[#422c16] border-[#caa87c]' 
                  : 'text-blue-700 bg-blue-50 border-blue-100'
              }`}>
                {tts.state.rate.toFixed(1)}x
              </span>
            </div>

            <p className={`text-xs mb-3 ${
              isDark ? 'text-slate-400' : isSepia ? 'text-[#735c44]' : 'text-slate-500'
            }`}>
              Defina o ritmo confortável para absorção do conteúdo.
            </p>

            <div className="flex items-center gap-3 mb-3">
              <span className={`text-xs font-semibold ${
                isDark ? 'text-slate-400' : isSepia ? 'text-[#735c44]' : 'text-slate-500'
              }`}>Lenta (0.5x)</span>
              <input
                id="rate-slider"
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={tts.state.rate}
                onChange={(e) => tts.setRate(parseFloat(e.target.value))}
                className={`flex-1 h-2 rounded-lg appearance-none cursor-pointer border transition-colors ${
                  isDark 
                    ? 'bg-slate-700 hover:bg-slate-600 border-slate-600 accent-blue-500' 
                    : isSepia 
                    ? 'bg-[#dfcca8] hover:bg-[#d4be9b] border-[#caa87c] accent-[#8c6536]' 
                    : 'bg-slate-200 hover:bg-slate-300 border-slate-300 accent-blue-600'
                }`}
                aria-label="Ajustar velocidade de leitura"
              />
              <span className={`text-xs font-semibold ${
                isDark ? 'text-slate-400' : isSepia ? 'text-[#735c44]' : 'text-slate-500'
              }`}>Rápida (3.0x)</span>
            </div>

            {/* Quick Speed Presets */}
            <div className="flex items-center gap-2 pt-1">
              <span className={`text-[11px] font-semibold ${
                isDark ? 'text-slate-400' : isSepia ? 'text-[#735c44]' : 'text-slate-400'
              }`}>Predefinições:</span>
              {[1.0, 1.25, 1.5, 2.0].map((ratePreset) => (
                <button
                  key={ratePreset}
                  onClick={() => tts.setRate(ratePreset)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                    Math.abs(tts.state.rate - ratePreset) < 0.05
                      ? isDark ? 'bg-blue-600 text-white shadow-xs' : isSepia ? 'bg-[#8c6536] text-white shadow-xs' : 'bg-blue-600 text-white shadow-sm'
                      : isDark ? 'bg-[#181a20] text-slate-300 border border-slate-700 hover:bg-slate-800' : isSepia ? 'bg-[#fbf5e8] text-[#3d2c1b] border border-[#d8c5a4] hover:bg-[#f5ebd6]' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {ratePreset}x
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: Voice Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Mic size={16} className={isDark ? 'text-slate-300' : isSepia ? 'text-[#735c44]' : 'text-slate-700'} />
                <h3 className={`text-sm font-bold ${
                  isDark ? 'text-slate-200' : isSepia ? 'text-[#382613]' : 'text-slate-800'
                }`}>
                  Voz do Narrador ({visibleVoices.length} disponíveis)
                </h3>
              </div>

              {/* Filter Tabs */}
              <div className={`flex items-center p-0.5 rounded-xl text-xs ${
                isDark ? 'bg-slate-800' : isSepia ? 'bg-[#e2cfab]' : 'bg-slate-100'
              }`}>
                <button
                  onClick={() => setFilter('all-pt')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                    filter === 'all-pt' 
                      ? isDark ? 'bg-slate-700 text-white shadow-xs' : isSepia ? 'bg-[#fbf5e8] text-[#382613] shadow-xs' : 'bg-white text-slate-900 shadow-sm'
                      : isDark ? 'text-slate-400 hover:text-slate-200' : isSepia ? 'text-[#735c44] hover:text-[#382613]' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Português
                </button>
                <button
                  onClick={() => setFilter('female')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition flex items-center gap-1 ${
                    filter === 'female' 
                      ? isDark ? 'bg-slate-700 text-pink-300 shadow-xs' : isSepia ? 'bg-[#fbf5e8] text-pink-800 shadow-xs' : 'bg-white text-pink-700 shadow-sm'
                      : isDark ? 'text-slate-400 hover:text-slate-200' : isSepia ? 'text-[#735c44] hover:text-[#382613]' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Femininas</span>
                </button>
                <button
                  onClick={() => setFilter('male')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition flex items-center gap-1 ${
                    filter === 'male' 
                      ? isDark ? 'bg-slate-700 text-blue-300 shadow-xs' : isSepia ? 'bg-[#fbf5e8] text-blue-800 shadow-xs' : 'bg-white text-blue-700 shadow-sm'
                      : isDark ? 'text-slate-400 hover:text-slate-200' : isSepia ? 'text-[#735c44] hover:text-[#382613]' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Masculinas</span>
                </button>
                <button
                  onClick={() => setFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                    filter === 'all' 
                      ? isDark ? 'bg-slate-700 text-white shadow-xs' : isSepia ? 'bg-[#fbf5e8] text-[#382613] shadow-xs' : 'bg-white text-slate-900 shadow-sm'
                      : isDark ? 'text-slate-400 hover:text-slate-200' : isSepia ? 'text-[#735c44] hover:text-[#382613]' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todas
                </button>
              </div>
            </div>

            {/* Voice List Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
              {visibleVoices.length === 0 && (
                <div className={`col-span-2 text-center py-6 text-xs rounded-2xl ${
                  isDark ? 'bg-slate-800/60 text-slate-400' : isSepia ? 'bg-[#ebd8b7] text-[#735c44]' : 'bg-slate-50 text-slate-400'
                }`}>
                  Nenhuma voz encontrada para este filtro.
                </div>
              )}

              {visibleVoices.map((item) => {
                const isSelected = tts.state.voiceURI === item.voice.voiceURI;
                return (
                  <button
                    key={item.voice.voiceURI}
                    onClick={() => tts.setVoice(item.voice.voiceURI)}
                    className={`p-3 rounded-2xl border text-left flex items-start justify-between gap-2 transition-all relative ${
                      isSelected
                        ? isDark 
                          ? 'border-blue-500 bg-blue-950/40 ring-2 ring-blue-500/30 shadow-xs' 
                          : isSepia 
                          ? 'border-[#8c6536] bg-[#ebd8b7] ring-2 ring-[#8c6536]/30 shadow-xs' 
                          : 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/20 shadow-sm'
                        : isDark 
                          ? 'border-slate-800 bg-[#20232a] hover:border-slate-700 hover:bg-[#262a33]' 
                          : isSepia 
                          ? 'border-[#e4d4b8] bg-[#fbf5e8] hover:border-[#d4be9b] hover:bg-[#f5ebd6]' 
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        item.gender === 'female' 
                          ? isDark ? 'bg-pink-950/60 text-pink-300' : 'bg-pink-100 text-pink-700' 
                          : item.gender === 'male'
                          ? isDark ? 'bg-blue-950/60 text-blue-300' : 'bg-blue-100 text-blue-700'
                          : isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {item.gender === 'female' ? <User size={15} /> : <UserCheck size={15} />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold text-xs truncate block ${
                            isDark ? 'text-slate-100' : isSepia ? 'text-[#382613]' : 'text-slate-800'
                          }`}>
                            {item.displayName}
                          </span>
                          {item.isNatural && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md shrink-0 flex items-center gap-0.5 ${
                              isDark ? 'bg-amber-950/60 text-amber-300' : isSepia ? 'bg-[#dfcca8] text-[#553b1b]' : 'bg-amber-100 text-amber-800'
                            }`}>
                              <Sparkles size={8} /> Natural
                            </span>
                          )}
                        </div>

                        <div className={`flex items-center gap-1.5 mt-1 text-[10px] ${
                          isDark ? 'text-slate-400' : isSepia ? 'text-[#735c44]' : 'text-slate-500'
                        }`}>
                          <span className={`font-mono px-1 rounded ${
                            isDark ? 'bg-slate-800' : isSepia ? 'bg-[#e2cfab]' : 'bg-slate-100'
                          }`}>{item.voice.lang}</span>
                          <span>•</span>
                          <span>
                            {item.gender === 'female' ? 'Feminina' : item.gender === 'male' ? 'Masculina' : 'Sistema'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className={`w-5 h-5 rounded-full text-white flex items-center justify-center shrink-0 ${
                        isDark ? 'bg-blue-500' : isSepia ? 'bg-[#8c6536]' : 'bg-blue-600'
                      }`}>
                        <Check size={12} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: Voice Commands Reference */}
          <div className={`rounded-2xl p-4 border transition-colors ${
            isDark 
              ? 'bg-[#20232a] border-slate-800' 
              : isSepia 
              ? 'bg-[#ebd8b7] border-[#dcc59f]' 
              : 'bg-slate-50/80 border-slate-100'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Mic size={16} className={isDark ? 'text-indigo-400' : isSepia ? 'text-[#8c6536]' : 'text-indigo-600'} />
              <h3 className={`text-sm font-bold ${
                isDark ? 'text-slate-200' : isSepia ? 'text-[#382613]' : 'text-slate-800'
              }`}>
                Comandos de Voz Disponíveis
              </h3>
            </div>
            
            <p className={`text-xs mb-3 ${
              isDark ? 'text-slate-400' : isSepia ? 'text-[#735c44]' : 'text-slate-500'
            }`}>
              Fale estes comandos após ativar a interação por voz (ícone de microfone):
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs leading-relaxed">
              <div className="space-y-1.5">
                <div>🗣️ <strong className={isDark ? 'text-slate-200' : 'text-slate-700'}>Leitura:</strong> "Ler", "Pausar", "Parar"</div>
                <div>🗣️ <strong className={isDark ? 'text-slate-200' : 'text-slate-700'}>Páginas:</strong> "Próxima", "Anterior", "Página [Nº]"</div>
                <div>🗣️ <strong className={isDark ? 'text-slate-200' : 'text-slate-700'}>Velocidade:</strong> "Aumentar/Diminuir velocidade"</div>
                <div>🗣️ <strong className={isDark ? 'text-slate-200' : 'text-slate-700'}>Temas:</strong> "Modo claro", "Modo sépia", "Modo escuro"</div>
              </div>
              <div className="space-y-1.5">
                <div>🗣️ <strong className={isDark ? 'text-slate-200' : 'text-slate-700'}>Zoom (PDF):</strong> "Aumentar/Diminuir zoom", "Ajustar tela"</div>
                <div>🗣️ <strong className={isDark ? 'text-slate-200' : 'text-slate-700'}>Tamanho (EPUB):</strong> "Aumentar/Diminuir fonte"</div>
                <div>🗣️ <strong className={isDark ? 'text-slate-200' : 'text-slate-700'}>Marcadores:</strong> "Marcar página", "Abrir marcadores"</div>
                <div>🗣️ <strong className={isDark ? 'text-slate-200' : 'text-slate-700'}>Painéis:</strong> "Abrir histórico", "Tela cheia", "Recolher barra"</div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className={`px-6 py-4 border-t flex items-center justify-between shrink-0 ${
          isDark 
            ? 'border-slate-800 bg-[#121418]' 
            : isSepia 
            ? 'border-[#e2cfab] bg-[#ede0c8]' 
            : 'border-slate-100 bg-slate-50/70'
        }`}>
          <button
            onClick={handleResetDefaults}
            className={`text-xs font-medium flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg transition ${
              isDark 
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' 
                : isSepia 
                ? 'text-[#735c44] hover:text-[#382613] hover:bg-[#dfcca8]' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'
            }`}
          >
            <RotateCcw size={14} />
            <span>Restaurar Padrão</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePlaySample()}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                isPlayingSample
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : isDark 
                  ? 'bg-indigo-950/60 text-indigo-300 hover:bg-indigo-900/60 border border-indigo-800/60' 
                  : isSepia 
                  ? 'bg-[#ebd8b7] text-[#422c16] hover:bg-[#e4d4b8] border border-[#caa87c]' 
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
              }`}
            >
              {isPlayingSample ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              <span>{isPlayingSample ? 'Parar Demonstração' : 'Ouvir Teste de Voz'}</span>
            </button>

            <button
              onClick={onClose}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                isDark 
                  ? 'bg-slate-100 text-slate-900 hover:bg-white' 
                  : isSepia 
                  ? 'bg-[#8c6536] text-white hover:bg-[#73522b]' 
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              Concluir
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
