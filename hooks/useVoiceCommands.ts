import { useState, useEffect, useRef, useCallback } from 'react';

interface VoiceCommandHandlers {
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onNextPage: () => void;
  onPrevPage: () => void;
  onGoToPage: (page: number) => void;
  // Paragraph Navigation Handlers
  onNextParagraph?: () => void;
  onPrevParagraph?: () => void;
  // Theme and Font Size Handlers
  onSetTheme?: (theme: 'clean' | 'sepia' | 'dark') => void;
  onIncreaseFontSize?: () => void;
  onDecreaseFontSize?: () => void;
  onIncreaseSpeed: () => void;
  onDecreaseSpeed: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitScreen: () => void;
  onFullScreen: () => void;
  onExitFullScreen: () => void;
  // Bookmark Handlers
  onToggleBookmark?: () => void;
  onRemoveBookmark?: () => void;
  onOpenBookmarks?: () => void;
  onCloseBookmarks?: () => void;
  onNextBookmark?: () => void;
  onPrevBookmark?: () => void;
  // History & TTS Settings Handlers
  onOpenHistory?: () => void;
  onCloseHistory?: () => void;
  onOpenTTSSettings?: () => void;
  onCloseTTSSettings?: () => void;
  // Header and Footer Collapse Handlers
  onToggleHeader?: () => void;
  onExpandHeader?: () => void;
  onCollapseHeader?: () => void;
  onToggleFooter?: () => void;
  onExpandFooter?: () => void;
  onCollapseFooter?: () => void;
  onImmersiveMode?: () => void;
}

export function useVoiceCommands(handlers: VoiceCommandHandlers) {
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const lastCommandTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(isListening); 
  const handlersRef = useRef(handlers);
  
  // Prevent double execution (Debounce)
  const lastCommandTimeRef = useRef<number>(0);
  const COMMAND_COOLDOWN = 1000; // 1 second cooldown between actions
  
  const isServiceRunningRef = useRef(false);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const startRecognition = useCallback(() => {
    // Browser support check
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech API not supported");
      return;
    }

    if (isServiceRunningRef.current) return;

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
        recognitionRef.current = null;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = true; 
      recognition.interimResults = false; // We only want final commands
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        console.log("🎤 Voice Service: ONLINE");
        isServiceRunningRef.current = true;
      };

      recognition.onend = () => {
        console.log("🎤 Voice Service: OFFLINE (End Event)");
        isServiceRunningRef.current = false;
        recognitionRef.current = null;

        // Auto-restart if usage is active
        if (isListeningRef.current) {
           setTimeout(() => {
             console.log("↻ Restarting Voice Service...");
             startRecognition();
           }, 250);
        }
      };

      recognition.onerror = (event: any) => {
        // Ignore "no-speech" as it just means silence
        if (event.error !== 'no-speech') {
            console.warn("🎤 Voice Error:", event.error);
        }
        
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setIsListening(false);
          isListeningRef.current = false;
          alert("Acesso ao microfone negado ou bloqueado pelo sistema.");
        }
      };

      recognition.onresult = (event: any) => {
        const now = Date.now();
        // Prevent rapid-fire duplicate commands
        if (now - lastCommandTimeRef.current < COMMAND_COOLDOWN) {
            return;
        }

        const lastIndex = event.results.length - 1;
        const rawTranscript = event.results?.[lastIndex]?.[0]?.transcript;
        if (!rawTranscript || typeof rawTranscript !== 'string') return;
        const transcript = rawTranscript.toLowerCase().trim();
        
        console.log(`🗣️ Heard: "${transcript}"`);
        if (lastCommandTimerRef.current) {
          clearTimeout(lastCommandTimerRef.current);
        }
        setLastCommand(transcript);
        lastCommandTimerRef.current = setTimeout(() => {
          setLastCommand(null);
        }, 2500);
        
        const executed = processCommand(transcript, handlersRef.current);
        if (executed) {
            lastCommandTimeRef.current = now;
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.error("Failed to start recognition:", e);
      isServiceRunningRef.current = false;
    }
  }, []);

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
      recognitionRef.current = null;
    }
    isServiceRunningRef.current = false;
  }, []);

  // --- ROBUSTNESS: Event Listeners ---
  useEffect(() => {
    // 1. Watchdog: Checks periodically if service died unexpectedly
    const watchdogInterval = setInterval(() => {
      if (isListeningRef.current && !isServiceRunningRef.current) {
        console.log("🐕 Watchdog: Reviving service...");
        startRecognition();
      }
    }, 2000);

    // 2. Visibility: Tab focus changes often kill audio context
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isListeningRef.current) {
        console.log("👁️ Focus Regained: Refreshing mic...");
        stopRecognition();
        setTimeout(startRecognition, 300);
      }
    };

    // 3. Fullscreen: The #1 cause of mic disconnects in Chrome
    const handleFullScreenChange = () => {
       if (isListeningRef.current) {
          console.log("📺 Screen Mode Changed: Hard Reset of Mic...");
          stopRecognition();
          // Wait longer (800ms) for visual transition to settle before requesting mic again
          setTimeout(() => {
             startRecognition();
          }, 800);
       }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullScreenChange);

    return () => {
      clearInterval(watchdogInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
    };
  }, [startRecognition, stopRecognition]);

  // --- Toggle Handler ---
  const toggleListening = useCallback(() => {
    if (isListening) {
      isListeningRef.current = false;
      setIsListening(false);
      stopRecognition();
    } else {
      setIsListening(true);
      isListeningRef.current = true;
      startRecognition();
    }
  }, [isListening, startRecognition, stopRecognition]);

  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      if (lastCommandTimerRef.current) {
        clearTimeout(lastCommandTimerRef.current);
      }
      stopRecognition();
    };
  }, [stopRecognition]);

  return {
    isListening,
    toggleListening,
    lastCommand
  };
}

// --- INTELLIGENT COMMAND PROCESSOR ---
// Returns true if a command was successfully matched
function processCommand(transcript: string, h: VoiceCommandHandlers): boolean {
    const t = transcript;
    
    // Helper: checks if any word in the list exists in the transcript
    const has = (words: string[]) => words.some(w => t.includes(w));
    
    // --- 1. PRIORITY: Jump to Specific Page (Must check before "Next Page") ---
    // Matches: "página 10", "vá para a página 5", "ir para 30"
    const pageRegex = /(?:ir|vá|vai|pule|pular|acessar|mostrar|abra)\s+(?:para|pra|na|à)?\s*(?:a\s+)?(?:página\s+)?(\d+)|(?:página)\s+(\d+)/i;
    const pageMatch = t.match(pageRegex);
    
    if (pageMatch) {
        const numStr = pageMatch[1] || pageMatch[2];
        if (numStr) {
            const pageNum = parseInt(numStr, 10);
            if (!isNaN(pageNum)) {
                h.onGoToPage(pageNum);
                return true;
            }
        }
    }

    // --- 2. Bookmark Commands (Marcadores) ---
    if (h.onRemoveBookmark && has(['remover marcador', 'excluir marcador', 'apagar marcador', 'desmarcar página', 'desmarcar'])) {
        h.onRemoveBookmark();
        return true;
    }
    if (h.onNextBookmark && has(['próximo marcador', 'proximo marcador', 'avançar marcador', 'seguir marcador'])) {
        h.onNextBookmark();
        return true;
    }
    if (h.onPrevBookmark && has(['marcador anterior', 'voltar marcador', 'recuar marcador'])) {
        h.onPrevBookmark();
        return true;
    }
    if (h.onCloseBookmarks && has(['fechar marcadores', 'ocultar marcadores', 'esconder marcadores', 'sair dos marcadores'])) {
        h.onCloseBookmarks();
        return true;
    }
    if (h.onOpenBookmarks && has(['abrir marcadores', 'ver marcadores', 'mostrar marcadores', 'meus marcadores', 'listar marcadores', 'painel de marcadores', 'exibir marcadores', 'marcadores'])) {
        h.onOpenBookmarks();
        return true;
    }
    if (h.onToggleBookmark && has(['salvar marcador', 'adicionar marcador', 'criar marcador', 'marcar página', 'marcar pagina', 'marcar esta página', 'novo marcador', 'salvar esta página', 'marcar'])) {
        h.onToggleBookmark();
        return true;
    }

    // --- 2.5 History & TTS Voice Settings Commands ---
    if (h.onCloseHistory && has(['fechar histórico', 'fechar historico', 'ocultar histórico', 'esconder histórico'])) {
        h.onCloseHistory();
        return true;
    }
    if (h.onOpenHistory && has(['abrir histórico', 'abrir historico', 'ver histórico', 'ver historico', 'mostrar histórico', 'meus livros', 'livros recentes', 'histórico de leitura', 'histórico', 'historico'])) {
        h.onOpenHistory();
        return true;
    }
    if (h.onCloseTTSSettings && has(['fechar voz', 'fechar vozes', 'fechar configurações de voz', 'ocultar voz'])) {
        h.onCloseTTSSettings();
        return true;
    }
    if (h.onOpenTTSSettings && has(['configurar voz', 'ajustar tom', 'mudar voz', 'trocar voz', 'abrir voz', 'opções de voz', 'configurações de voz', 'ajustar voz', 'tom da voz', 'voz do narrador'])) {
        h.onOpenTTSSettings();
        return true;
    }

    // --- 2.8 Header & Footer Collapse/Expand Commands ---
    if (h.onCollapseHeader && has(['contrair cabeçalho', 'contrair cabecalho', 'ocultar cabeçalho', 'ocultar cabecalho', 'esconder cabeçalho', 'fechar cabeçalho', 'minimizar cabeçalho', 'ocultar topo', 'esconder topo'])) {
        h.onCollapseHeader();
        return true;
    }
    if (h.onExpandHeader && has(['expandir cabeçalho', 'expandir cabecalho', 'mostrar cabeçalho', 'mostrar cabecalho', 'exibir cabeçalho', 'abrir cabeçalho', 'mostrar topo', 'exibir topo'])) {
        h.onExpandHeader();
        return true;
    }
    if (h.onToggleHeader && has(['alternar cabeçalho', 'alternar cabecalho', 'barra superior'])) {
        h.onToggleHeader();
        return true;
    }
    if (h.onCollapseFooter && has(['contrair rodapé', 'contrair rodape', 'contrair player', 'minimizar player', 'contrair barra', 'minimizar barra', 'ocultar player', 'ocultar barra', 'esconder player', 'esconder barra', 'ocultar rodapé', 'esconder rodapé'])) {
        h.onCollapseFooter();
        return true;
    }
    if (h.onExpandFooter && has(['expandir rodapé', 'expandir rodape', 'expandir player', 'expandir barra', 'mostrar player', 'mostrar barra', 'exibir player', 'exibir barra', 'mostrar rodapé', 'exibir rodapé'])) {
        h.onExpandFooter();
        return true;
    }
    if (h.onToggleFooter && has(['alternar player', 'alternar barra', 'barra inferior'])) {
        h.onToggleFooter();
        return true;
    }
    if (h.onImmersiveMode && has(['modo imersivo', 'modo leitura imersiva', 'contrair tudo', 'esconder tudo', 'ocultar barras', 'esconder barras', 'expandir tudo', 'mostrar barras'])) {
        h.onImmersiveMode();
        return true;
    }

    // --- 3. Screen Modes ---
    if (has(['sair da tela', 'sair do modo', 'minimizar', 'restaurar', 'voltar ao normal', 'janela normal', 'fechar tela', 'sair de tela', 'esc'])) {
        h.onExitFullScreen();
        return true;
    }
    if (has(['tela cheia', 'modo cheio', 'maximizar', 'expandir', 'modo foco', 'modo leitura', 'ocupar tudo', 'tela inteira'])) {
        h.onFullScreen();
        return true;
    }
    if (has(['ajustar tela', 'ajuste de tela', 'tamanho normal', 'resetar tela', 'resetar zoom', 'caber na tela'])) {
        h.onFitScreen();
        return true;
    }

    // --- 3. Zoom Controls ---
    if (has(['aumentar zoom', 'mais zoom', 'aproximar', 'ampliar', 'aumentar letra', 'chegar perto', 'perto', 'zoom in', 'mais grande'])) {
        h.onZoomIn();
        return true;
    }
    if (has(['diminuir zoom', 'menos zoom', 'afastar', 'reduzir', 'diminuir letra', 'ver de longe', 'longe', 'zoom out', 'pequeno'])) {
        h.onZoomOut();
        return true;
    }

    // --- 4. Speed Controls ---
    if (has(['aumentar velocidade', 'mais rápido', 'acelerar', 'agilizar', 'aumentar ritmo', 'fala mais rápido', 'correr', 'rápido'])) {
        h.onIncreaseSpeed();
        return true;
    }
    if (has(['diminuir velocidade', 'mais devagar', 'desacelerar', 'reduzir ritmo', 'com calma', 'vai com calma', 'fala mais devagar', 'lento'])) {
        h.onDecreaseSpeed();
        return true;
    }

    // --- 4.5 Reading Theme & Font Size Voice Commands ---
    if (h.onSetTheme) {
      if (has(['modo sépia', 'modo sepia', 'tema sépia', 'tema sepia', 'ativar sépia', 'ativar sepia', 'leitura sépia'])) {
        h.onSetTheme('sepia');
        return true;
      }
      if (has(['modo escuro', 'tema escuro', 'modo dark', 'tema dark', 'ativar dark', 'modo noturno', 'tema noturno', 'ativar modo escuro'])) {
        h.onSetTheme('dark');
        return true;
      }
      if (has(['modo clean', 'tema clean', 'modo claro', 'tema claro', 'modo branco', 'tema branco', 'ativar clean', 'leitura clean'])) {
        h.onSetTheme('clean');
        return true;
      }
    }

    if (h.onIncreaseFontSize && has(['aumentar fonte', 'letra maior', 'fonte maior', 'aumentar texto', 'texto maior', 'letra grande', 'fonte grande'])) {
      h.onIncreaseFontSize();
      return true;
    }

    if (h.onDecreaseFontSize && has(['diminuir fonte', 'letra menor', 'fonte menor', 'diminuir texto', 'texto menor', 'letra pequena', 'fonte pequena'])) {
      h.onDecreaseFontSize();
      return true;
    }

    // --- 5. Playback Controls ---
    // Strict Stop commands must be checked before Pause because "parar" could be ambiguous
    if (has(['parar leitura', 'encerrar leitura', 'cancelar leitura', 'stop reading', 'parar tudo', 'resetar leitura'])) {
        h.onStop();
        return true;
    }

    if (has(['pausar', 'parar', 'interromper', 'dar um tempo', 'silenciar', 'quieto', 'stop', 'pause', 'chega', 'aguarda', 'espera'])) {
        h.onPause();
        return true;
    }
    
    if (has(['ler', 'continuar', 'tocar', 'reproduzir', 'iniciar', 'retomar', 'prosseguir', 'começar', 'play', 'volta a ler', 'fale', 'diga'])) {
        h.onResume();
        return true;
    }

    // --- 5.5 Paragraph Navigation (Must precede broad Next/Prev) ---
    if (h.onNextParagraph && has(['próximo parágrafo', 'proximo paragrafo', 'avançar parágrafo', 'avancar paragrafo', 'seguir parágrafo', 'pular parágrafo', 'outro parágrafo'])) {
        h.onNextParagraph();
        return true;
    }

    if (h.onPrevParagraph && has(['parágrafo anterior', 'paragrafo anterior', 'voltar parágrafo', 'voltar paragrafo', 'recuar parágrafo', 'retornar parágrafo'])) {
        h.onPrevParagraph();
        return true;
    }

    // --- 6. Navigation (Next/Prev) ---
    // Extensive list for reliability
    if (has([
        'próxima', 'próximo', 'avançar', 'seguir', 'passar', 'frente', 'adiante', 
        'virar a página', 'passa a página', 'página seguinte', 'vai pra frente', 
        'avançar página', 'vira', 'passa'
    ])) {
        h.onNextPage();
        return true;
    }

    if (has([
        'anterior', 'voltar', 'retornar', 'recuar', 'trás', 'atrás', 'precedente',
        'página anterior', 'volta a página', 'voltar página', 'volta'
    ])) {
        h.onPrevPage();
        return true;
    }
    
    return false; // No command matched
}