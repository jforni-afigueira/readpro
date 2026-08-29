import { useState, useRef, useEffect, useCallback } from 'react';
import { TTSState } from '../types';

const TTS_SETTINGS_KEY = 'leitor_pro_tts_settings_v1';

// Global keeper to prevent browser garbage collection from killing active utterances
const activeUtteranceKeeper = new Set<SpeechSynthesisUtterance>();

interface TextChunk {
  text: string;
  start: number;
  end: number;
}

// Split large chapter/page text into natural, digestible sentences for SpeechSynthesis
function splitTextIntoChunks(fullText: string): TextChunk[] {
  if (!fullText || !fullText.trim()) return [];

  const chunks: TextChunk[] = [];
  // Regex matches sentences ending with . ! ? \n or comma/semicolon when long
  const sentenceRegex = /[^.!?\n\r]+(?:[.!?\n\r]+|$)/g;
  let match: RegExpExecArray | null;

  while ((match = sentenceRegex.exec(fullText)) !== null) {
    const rawSentence = match[0];
    const start = match.index;
    const end = start + rawSentence.length;

    // If sentence is reasonably sized, keep it as one chunk
    if (rawSentence.length <= 250) {
      if (rawSentence.trim().length > 0) {
        chunks.push({ text: rawSentence, start, end });
      }
    } else {
      // Subdivide extra-long sentences by punctuation/spaces
      const subRegex = /[^,;:—–\s]+(?:[,;:—–\s]+|$)/g;
      let subMatch: RegExpExecArray | null;
      let currentSubText = '';
      let subStart = start;

      while ((subMatch = subRegex.exec(rawSentence)) !== null) {
        const piece = subMatch[0];
        if (currentSubText.length + piece.length > 200 && currentSubText.trim().length > 0) {
          chunks.push({
            text: currentSubText,
            start: subStart,
            end: subStart + currentSubText.length
          });
          subStart += currentSubText.length;
          currentSubText = piece;
        } else {
          currentSubText += piece;
        }
      }

      if (currentSubText.trim().length > 0) {
        chunks.push({
          text: currentSubText,
          start: subStart,
          end: start + rawSentence.length
        });
      }
    }
  }

  return chunks.length > 0 ? chunks : [{ text: fullText, start: 0, end: fullText.length }];
}

export function useSmartTTS() {
  const synth = useRef<SpeechSynthesis>(typeof window !== 'undefined' ? window.speechSynthesis : (null as any));
  const onCompleteRef = useRef<(() => void) | undefined>(undefined);
  
  // Load saved preferences if available
  const getInitialSettings = () => {
    try {
      const saved = localStorage.getItem(TTS_SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          rate: typeof parsed.rate === 'number' ? parsed.rate : 1.2,
          pitch: typeof parsed.pitch === 'number' ? parsed.pitch : 1.0,
          voiceURI: typeof parsed.voiceURI === 'string' ? parsed.voiceURI : null,
          volume: typeof parsed.volume === 'number' ? parsed.volume : 1.0,
        };
      }
    } catch {}
    return {
      rate: 1.2,
      pitch: 1.0,
      voiceURI: null,
      volume: 1.0,
    };
  };

  const initialSettings = getInitialSettings();

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [state, setState] = useState<TTSState>({
    isPlaying: false,
    isPaused: false,
    rate: initialSettings.rate,
    pitch: initialSettings.pitch,
    voiceURI: initialSettings.voiceURI,
    volume: initialSettings.volume,
  });

  const fullTextRef = useRef<string>("");
  const chunksRef = useRef<TextChunk[]>([]);
  const currentChunkIndexRef = useRef<number>(0);
  const isPlayingRef = useRef(false);
  const isPausedRef = useRef(false);
  const rateRef = useRef(initialSettings.rate);
  const pitchRef = useRef(initialSettings.pitch);
  const voiceURIRef = useRef<string | null>(initialSettings.voiceURI);

  const fallbackTimerRef = useRef<any>(null);
  const chunkStartTimeRef = useRef<number>(0);
  const boundaryFiredRecentlyRef = useRef<boolean>(false);

  // Drives UI highlight
  const [currentGlobalIndex, setCurrentGlobalIndex] = useState(0);

  // Keep state refs in sync
  useEffect(() => {
    rateRef.current = state.rate;
    pitchRef.current = state.pitch;
    voiceURIRef.current = state.voiceURI;
    isPlayingRef.current = state.isPlaying;
    isPausedRef.current = state.isPaused;
  }, [state]);

  // Persist settings
  const persistSettings = useCallback((updates: Partial<TTSState>) => {
    try {
      const current = localStorage.getItem(TTS_SETTINGS_KEY);
      const prev = current ? JSON.parse(current) : {};
      const next = { ...prev, ...updates };
      localStorage.setItem(TTS_SETTINGS_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  // Sorting Logic - Portuguese Priority, Natural/Neural Priority
  const sortVoices = (voiceList: SpeechSynthesisVoice[]) => {
    if (!Array.isArray(voiceList)) return [];
    const ptVoices = voiceList.filter(v => v && typeof v.lang === 'string' && v.lang.replace('_', '-').toLowerCase().startsWith('pt'));
    
    const getScore = (v: SpeechSynthesisVoice) => {
       if (!v) return 0;
       let score = 0;
       const name = (v.name || '').toLowerCase();
       const lang = v.lang || '';
       
       if (name.includes('daniel')) score += 1000;
       if (name.includes('luciana')) score += 950;
       if (name.includes('felipe')) score += 900;
       if (name.includes('maria')) score += 850;
       if (name.includes('francisca')) score += 800;
       if (name.includes('vitória') || name.includes('vitoria')) score += 750;
       if (name.includes('premium')) score += 50;
       if (name.includes('natural')) score += 50;
       if (name.includes('neural')) score += 50;
       if (name.includes('online')) score += 20;
       if (lang === 'pt-BR') score += 10;
       
       return score;
    };

    const sortedPt = ptVoices.sort((a, b) => getScore(b) - getScore(a));
    const nonPt = voiceList.filter(v => v && (typeof v.lang !== 'string' || !v.lang.replace('_', '-').toLowerCase().startsWith('pt')));
    return [...sortedPt, ...nonPt];
  };

  useEffect(() => {
    if (!synth.current) return;

    const loadVoices = () => {
      const allVoices = synth.current.getVoices() || [];
      const sorted = sortVoices(allVoices);
      setVoices(sorted);

      setState(s => {
        if (s.voiceURI && sorted.some(v => v?.voiceURI === s.voiceURI)) {
          return s;
        }
        if (sorted.length > 0) {
          const ptOnly = sorted.filter(v => v && typeof v.lang === 'string' && v.lang.replace('_', '-').toLowerCase().startsWith('pt'));
          const defaultVoice = ptOnly.length > 0 ? ptOnly[0] : sorted[0];
          return { ...s, voiceURI: defaultVoice?.voiceURI || '' };
        }
        return s;
      });
    };

    loadVoices();
    if (window.speechSynthesis && window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    
    return () => { 
      if (synth.current) synth.current.cancel(); 
    };
  }, []);

  // Chrome 14-second SpeechSynthesis freeze fix interval
  useEffect(() => {
    const keepAliveInterval = setInterval(() => {
      if (synth.current && synth.current.speaking && !synth.current.paused) {
        synth.current.pause();
        synth.current.resume();
      }
    }, 10000);

    return () => clearInterval(keepAliveInterval);
  }, []);

  // Clear fallback interpolation timer
  const stopFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearInterval(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    stopFallbackTimer();
    if (synth.current) {
      synth.current.cancel();
    }
    activeUtteranceKeeper.clear();
    currentChunkIndexRef.current = 0;
    isPlayingRef.current = false;
    isPausedRef.current = false;
    setCurrentGlobalIndex(0);
    setState(s => ({ ...s, isPlaying: false, isPaused: false }));
  }, [stopFallbackTimer]);

  // Play next chunk in sequence
  const playCurrentChunk = useCallback(() => {
    stopFallbackTimer();

    if (!synth.current) return;
    const chunks = chunksRef.current;
    const chunkIdx = currentChunkIndexRef.current;

    if (chunkIdx >= chunks.length || !isPlayingRef.current) {
      // Reached the end of text
      stop();
      if (onCompleteRef.current) {
        onCompleteRef.current();
      }
      return;
    }

    const chunk = chunks[chunkIdx];
    const chunkText = chunk.text.trim();

    if (!chunkText) {
      // Skip empty whitespace chunk
      currentChunkIndexRef.current++;
      playCurrentChunk();
      return;
    }

    // Set initial position
    setCurrentGlobalIndex(chunk.start);
    boundaryFiredRecentlyRef.current = false;
    chunkStartTimeRef.current = Date.now();

    // Utterance preparation
    const u = new SpeechSynthesisUtterance(chunk.text);
    u.rate = rateRef.current;
    u.pitch = pitchRef.current;
    u.volume = state.volume ?? 1.0;
    u.lang = 'pt-BR';

    if (voiceURIRef.current) {
      const allVoices = synth.current.getVoices();
      const matchedVoice = allVoices.find(v => v.voiceURI === voiceURIRef.current);
      if (matchedVoice) {
        u.voice = matchedVoice;
        u.lang = matchedVoice.lang || 'pt-BR';
      }
    }

    // 1. Boundary event handler (exact word position)
    u.onboundary = (e) => {
      boundaryFiredRecentlyRef.current = true;
      const calculatedIndex = chunk.start + e.charIndex;
      setCurrentGlobalIndex(calculatedIndex);
    };

    // 2. Fallback timer for browsers/voices that don't emit onboundary
    fallbackTimerRef.current = setInterval(() => {
      if (!isPlayingRef.current || isPausedRef.current) return;
      if (!boundaryFiredRecentlyRef.current) {
        const elapsedSec = (Date.now() - chunkStartTimeRef.current) / 1000;
        // Average speaking speed: ~15 chars/sec * rate
        const estimatedChars = Math.floor(elapsedSec * 16 * rateRef.current);
        const interpolatedIndex = Math.min(chunk.end, chunk.start + estimatedChars);
        setCurrentGlobalIndex(interpolatedIndex);
      }
    }, 120);

    // 3. Chunk completion
    u.onend = () => {
      stopFallbackTimer();
      activeUtteranceKeeper.delete(u);
      if (isPlayingRef.current) {
        currentChunkIndexRef.current++;
        playCurrentChunk();
      }
    };

    u.onerror = (e) => {
      stopFallbackTimer();
      activeUtteranceKeeper.delete(u);
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.warn('SpeechSynthesis error:', e.error);
        if (isPlayingRef.current) {
          currentChunkIndexRef.current++;
          playCurrentChunk();
        }
      }
    };

    activeUtteranceKeeper.add(u);

    if (synth.current.paused) {
      synth.current.resume();
    }

    if (synth.current && isPlayingRef.current) {
      synth.current.speak(u);
    }
  }, [stopFallbackTimer, stop, state.volume]);

  const play = useCallback((text: string, startOffset = 0, onComplete?: () => void) => {
    if (!text || !text.trim()) return;

    if (synth.current) {
      synth.current.cancel();
    }

    fullTextRef.current = text;
    onCompleteRef.current = onComplete;
    isPlayingRef.current = true;
    isPausedRef.current = false;

    setState(s => ({ ...s, isPlaying: true, isPaused: false }));

    // Segment text
    const chunks = splitTextIntoChunks(text);
    chunksRef.current = chunks;

    // Find appropriate start chunk
    let targetChunkIndex = 0;
    if (startOffset > 0) {
      const idx = chunks.findIndex(c => startOffset >= c.start && startOffset < c.end);
      if (idx !== -1) {
        targetChunkIndex = idx;
      } else {
        // Find closest preceding chunk
        for (let i = chunks.length - 1; i >= 0; i--) {
          if (chunks[i].start <= startOffset) {
            targetChunkIndex = i;
            break;
          }
        }
      }
    }

    currentChunkIndexRef.current = targetChunkIndex;
    setCurrentGlobalIndex(startOffset);

    playCurrentChunk();
  }, [playCurrentChunk]);

  const pause = useCallback(() => {
    stopFallbackTimer();
    if (synth.current) {
      synth.current.pause();
    }
    isPausedRef.current = true;
    setState(s => ({ ...s, isPaused: true }));
  }, [stopFallbackTimer]);

  const resume = useCallback(() => {
    if (synth.current && synth.current.paused) {
      synth.current.resume();
      isPausedRef.current = false;
      setState(s => ({ ...s, isPaused: false }));
    } else {
      isPausedRef.current = false;
      isPlayingRef.current = true;
      setState(s => ({ ...s, isPlaying: true, isPaused: false }));
      playCurrentChunk();
    }
  }, [playCurrentChunk]);

  const skip = useCallback((charOffset: number) => {
    if (!fullTextRef.current) return;

    const newPos = Math.max(0, Math.min(currentGlobalIndex + charOffset, fullTextRef.current.length));
    play(fullTextRef.current, newPos, onCompleteRef.current);
  }, [currentGlobalIndex, play]);

  // Navigate directly by paragraph (previous / next paragraph)
  const skipParagraph = useCallback((direction: 'prev' | 'next' | -1 | 1) => {
    const text = fullTextRef.current;
    if (!text || text.length === 0) return;

    // Collect all paragraph start indices
    const paragraphStarts: number[] = [0];
    
    // Check if text contains newlines
    if (text.includes('\n')) {
      const pRegex = /\r?\n+/g;
      let match: RegExpExecArray | null;
      while ((match = pRegex.exec(text)) !== null) {
        const nextStart = match.index + match[0].length;
        if (nextStart < text.length && !paragraphStarts.includes(nextStart)) {
          paragraphStarts.push(nextStart);
        }
      }
    } else {
      // Fallback if no newlines: sentence boundary clustering (~200 chars)
      const sRegex = /([.!?]\s+)/g;
      let match: RegExpExecArray | null;
      let lastStart = 0;
      while ((match = sRegex.exec(text)) !== null) {
        const candidate = match.index + match[0].length;
        if (candidate - lastStart > 180 && candidate < text.length) {
          paragraphStarts.push(candidate);
          lastStart = candidate;
        }
      }
    }

    const currentPos = currentGlobalIndex;
    const isPrev = direction === 'prev' || direction === -1;

    let targetIndex = 0;

    if (isPrev) {
      // Find the paragraph that contains or precedes currentPos
      let currentPIdx = 0;
      for (let i = 0; i < paragraphStarts.length; i++) {
        if (paragraphStarts[i] <= currentPos) {
          currentPIdx = i;
        } else {
          break;
        }
      }

      // If we are already more than 20 chars into this paragraph, rewind to the start of it.
      // Otherwise rewind to the previous paragraph start.
      if (currentPos - paragraphStarts[currentPIdx] > 25) {
        targetIndex = paragraphStarts[currentPIdx];
      } else {
        targetIndex = paragraphStarts[Math.max(0, currentPIdx - 1)];
      }
    } else {
      // Find next paragraph start that is strictly after currentPos
      const nextP = paragraphStarts.find(pos => pos > currentPos + 5);
      if (nextP !== undefined) {
        targetIndex = nextP;
      } else {
        // Already at or near the last paragraph
        targetIndex = Math.min(currentPos + 100, text.length - 1);
      }
    }

    play(text, targetIndex, onCompleteRef.current);
  }, [currentGlobalIndex, play]);

  const setRate = useCallback((r: number) => {
    const clamped = Math.max(0.5, Math.min(r, 3.0));
    rateRef.current = clamped;
    setState(s => ({ ...s, rate: clamped }));
    persistSettings({ rate: clamped });
    if (isPlayingRef.current) {
      play(fullTextRef.current, currentGlobalIndex, onCompleteRef.current);
    }
  }, [currentGlobalIndex, play, persistSettings]);

  const setPitch = useCallback((p: number) => {
    const clamped = Math.max(0.5, Math.min(p, 1.8));
    pitchRef.current = clamped;
    setState(s => ({ ...s, pitch: clamped }));
    persistSettings({ pitch: clamped });
    if (isPlayingRef.current) {
      play(fullTextRef.current, currentGlobalIndex, onCompleteRef.current);
    }
  }, [currentGlobalIndex, play, persistSettings]);

  const setVoice = useCallback((v: string) => {
    voiceURIRef.current = v;
    setState(s => ({ ...s, voiceURI: v }));
    persistSettings({ voiceURI: v });
    if (isPlayingRef.current) {
      play(fullTextRef.current, currentGlobalIndex, onCompleteRef.current);
    }
  }, [currentGlobalIndex, play, persistSettings]);

  return {
    play,
    pause,
    resume,
    stop,
    skip,
    skipParagraph,
    setRate,
    setPitch,
    setVoice,
    getVoices: () => voices,
    state,
    currentGlobalIndex,
    totalLength: fullTextRef.current.length
  };
}
