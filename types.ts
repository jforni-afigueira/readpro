export type DocFormat = 'pdf' | 'epub' | null;

export type ReadingTheme = 'clean' | 'sepia' | 'dark';
export type ThemeMode = ReadingTheme;

export interface Bookmark {
  id: string;
  bookId: string;
  page: number;
  title: string;
  note?: string;
  snippet?: string;
  createdAt: number;
}

export interface ReadingHistoryItem {
  id: string;
  fileName: string;
  fileType: 'pdf' | 'epub';
  fileSize: number;
  currentPage: number;
  totalPages: number;
  lastReadAt: number;
}

// Map a text range to a specific DOM element for highlighting
export interface TextMapItem {
  start: number;
  end: number;
  element: HTMLElement;
}

export interface TTSState {
  isPlaying: boolean;
  isPaused: boolean;
  rate: number;
  pitch: number;
  voiceURI: string | null;
  volume: number;
}

export interface SmartTTSHook {
  play: (text: string, startOffset?: number, onComplete?: () => void) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  skip: (charOffset: number) => void;
  skipParagraph: (direction: 'prev' | 'next' | -1 | 1) => void;
  setRate: (rate: number) => void;
  setPitch: (pitch: number) => void;
  setVoice: (voiceURI: string) => void;
  getVoices: () => SpeechSynthesisVoice[];
  state: TTSState;
  currentGlobalIndex: number;
  totalLength: number;
}

declare global {
  interface Window {
    pdfjsLib: any;
    ePub: any;
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}