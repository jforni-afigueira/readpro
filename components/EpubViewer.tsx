import React, { useEffect, useRef, useState, useCallback } from 'react';
import JSZip from 'jszip';
import { 
  BookOpen, List, ChevronLeft, ChevronRight, AlertCircle, Loader2
} from 'lucide-react';
import { SmartTTSHook, ReadingTheme } from '../types';

interface EpubViewerProps {
  file: File;
  tts: SmartTTSHook;
  onPageChange: (current: number, total: number) => void;
  currentPage: number;
  scale: number;
  theme?: ReadingTheme;
  fontSizeScale?: number;
  onThemeChange?: (theme: ReadingTheme) => void;
  onFontSizeScaleChange?: (scale: number) => void;
}

interface ChapterData {
  id: string;
  href: string;
  title: string;
  htmlContent: string;
  plainText: string;
}

interface TocItem {
  title: string;
  href: string;
  targetChapterIndex: number;
}

interface TokenSpan {
  start: number;
  end: number;
  element: HTMLElement;
  parentBlock: HTMLElement | null;
}

const BLOCK_TAGS = new Set([
  'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 
  'BLOCKQUOTE', 'LI', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'PRE'
]);

export const EpubViewer: React.FC<EpubViewerProps> = ({
  file,
  tts,
  onPageChange,
  currentPage,
  scale,
  theme = 'clean',
  fontSizeScale = 1.15,
  onThemeChange,
  onFontSizeScaleChange,
}) => {
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('Processando livro EPUB...');
  const [error, setError] = useState<string | null>(null);

  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthor, setBookAuthor] = useState('');
  const [chapters, setChapters] = useState<ChapterData[]>([]);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [chapterText, setChapterText] = useState('');

  const chapterBodyRef = useRef<HTMLDivElement>(null);
  const contentContainerRef = useRef<HTMLDivElement>(null);

  const objectUrlsRef = useRef<string[]>([]);
  const tokensRef = useRef<TokenSpan[]>([]);
  const lastActiveWordRef = useRef<HTMLElement | null>(null);
  const lastActiveBlockRef = useRef<HTMLElement | null>(null);

  const currentPageRef = useRef(currentPage);
  const totalChaptersRef = useRef(chapters.length);
  const onPageChangeRef = useRef(onPageChange);
  const autoPlayNextRef = useRef(false);
  const ttsPlayRef = useRef(tts.play);

  useEffect(() => {
    currentPageRef.current = currentPage;
    totalChaptersRef.current = chapters.length;
    onPageChangeRef.current = onPageChange;
    ttsPlayRef.current = tts.play;
  }, [currentPage, chapters.length, onPageChange, tts.play]);

  // Clean up object URLs created for EPUB images
  const cleanupObjectUrls = useCallback(() => {
    objectUrlsRef.current.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    });
    objectUrlsRef.current = [];
  }, []);

  // 1. Native EPUB Parser
  useEffect(() => {
    let isCancelled = false;

    const parseEpub = async () => {
      try {
        setLoading(true);
        setError(null);
        setLoadingMsg('Descompactando arquivo EPUB...');
        cleanupObjectUrls();

        const zip = new JSZip();
        const zipData = await zip.loadAsync(file);

        // Find container.xml
        const containerFile = zipData.file('META-INF/container.xml');
        if (!containerFile) {
          throw new Error('Arquivo META-INF/container.xml não encontrado no EPUB.');
        }

        const containerXml = await containerFile.async('text');
        const parser = new DOMParser();
        const containerDoc = parser.parseFromString(containerXml, 'application/xml');
        const rootfileElem = containerDoc.querySelector('rootfile');
        const opfPath = rootfileElem?.getAttribute('full-path');

        if (!opfPath) {
          throw new Error('Não foi possível localizar o arquivo de manifesto (OPF).');
        }

        setLoadingMsg('Lendo manifesto e capítulos...');

        const opfFile = zipData.file(opfPath);
        if (!opfFile) {
          throw new Error(`Arquivo OPF não encontrado em: ${opfPath}`);
        }

        const opfXml = await opfFile.async('text');
        const opfDoc = parser.parseFromString(opfXml, 'application/xml');

        // Extract Title & Author
        const titleElem = opfDoc.querySelector('title') || opfDoc.querySelector('dc\\:title');
        const authorElem = opfDoc.querySelector('creator') || opfDoc.querySelector('dc\\:creator');
        const title = titleElem?.textContent?.trim() || file.name.replace(/\.epub$/i, '');
        const author = authorElem?.textContent?.trim() || '';

        setBookTitle(title);
        setBookAuthor(author);

        const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

        const resolvePath = (relative: string) => {
          if (!relative) return '';
          const parts = (opfDir + relative).split('/');
          const resolved: string[] = [];
          for (const p of parts) {
            if (p === '.' || p === '') continue;
            if (p === '..') {
              resolved.pop();
            } else {
              resolved.push(p);
            }
          }
          return resolved.join('/');
        };

        // Manifest map
        const manifest = new Map<string, { href: string; mediaType: string; resolvedPath: string }>();
        const itemElems = opfDoc.querySelectorAll('manifest > item');
        itemElems.forEach(item => {
          const id = item.getAttribute('id');
          const href = item.getAttribute('href');
          const mediaType = item.getAttribute('media-type') || '';
          if (id && href) {
            manifest.set(id, {
              href,
              mediaType,
              resolvedPath: resolvePath(href)
            });
          }
        });

        // Spine items
        const spineElems = opfDoc.querySelectorAll('spine > itemref');
        const spineIds: string[] = [];
        spineElems.forEach(ref => {
          const idref = ref.getAttribute('idref');
          if (idref) spineIds.push(idref);
        });

        if (spineIds.length === 0) {
          throw new Error('Nenhum capítulo legível encontrado no índice do EPUB.');
        }

        // Image Blobs cache
        setLoadingMsg('Extraindo ilustrações...');
        const imageBlobUrls = new Map<string, string>();
        for (const [_, item] of manifest.entries()) {
          if (item.mediaType.startsWith('image/')) {
            const imgFile = zipData.file(item.resolvedPath) || zipData.file(item.href);
            if (imgFile) {
              const blob = await imgFile.async('blob');
              const blobUrl = URL.createObjectURL(blob);
              objectUrlsRef.current.push(blobUrl);
              imageBlobUrls.set(item.resolvedPath, blobUrl);
              imageBlobUrls.set(item.href, blobUrl);
              const fileNameOnly = item.resolvedPath.split('/').pop() || '';
              if (fileNameOnly) {
                imageBlobUrls.set(fileNameOnly, blobUrl);
              }
            }
          }
        }

        // Parse Chapters
        setLoadingMsg('Processando conteúdo dos capítulos...');
        const parsedChapters: ChapterData[] = [];

        for (let i = 0; i < spineIds.length; i++) {
          const id = spineIds[i];
          const item = manifest.get(id);
          if (!item) continue;

          const chapterFile = zipData.file(item.resolvedPath) || zipData.file(item.href);
          if (!chapterFile) continue;

          let rawHtml = await chapterFile.async('text');
          const chapterDoc = parser.parseFromString(rawHtml, 'text/html');

          // Replace image references with blob URLs
          const images = chapterDoc.querySelectorAll('img, image');
          images.forEach(img => {
            const src = img.getAttribute('src') || img.getAttribute('xlink:href') || '';
            if (src && !src.startsWith('data:') && !src.startsWith('blob:') && !src.startsWith('http')) {
              const cleanSrc = src.split('#')[0].split('?')[0];
              const resolvedImgPath = resolvePath(cleanSrc);
              const fileNameOnly = cleanSrc.split('/').pop() || '';

              const matchingBlob = 
                imageBlobUrls.get(resolvedImgPath) || 
                imageBlobUrls.get(cleanSrc) || 
                imageBlobUrls.get(fileNameOnly);

              if (matchingBlob) {
                if (img.tagName.toLowerCase() === 'image') {
                  img.setAttribute('xlink:href', matchingBlob);
                } else {
                  img.setAttribute('src', matchingBlob);
                }
              }
            }
          });

          // Remove script, style, and link tags
          chapterDoc.querySelectorAll('script, style, link[rel="stylesheet"]').forEach(el => el.remove());

          // Extract Chapter Title
          const headerElem = chapterDoc.querySelector('h1, h2, h3, title');
          let chapterTitle = headerElem?.textContent?.trim() || `Capítulo ${parsedChapters.length + 1}`;
          if (chapterTitle.length > 50) {
            chapterTitle = chapterTitle.substring(0, 47) + '...';
          }

          const bodyContent = chapterDoc.body ? chapterDoc.body.innerHTML : rawHtml;
          const plainText = chapterDoc.body ? (chapterDoc.body.textContent || '').trim() : '';

          if (plainText.length > 5 || bodyContent.includes('<img')) {
            parsedChapters.push({
              id,
              href: item.href,
              title: chapterTitle,
              htmlContent: bodyContent,
              plainText
            });
          }
        }

        if (parsedChapters.length === 0) {
          throw new Error('Nenhum texto legível foi extraído dos capítulos deste livro.');
        }

        // Build Table of Contents
        const tocList: TocItem[] = parsedChapters.map((ch, idx) => ({
          title: ch.title,
          href: ch.href,
          targetChapterIndex: idx + 1
        }));

        if (isCancelled) return;

        setChapters(parsedChapters);
        setToc(tocList);

        const initialPage = currentPage && currentPage <= parsedChapters.length ? currentPage : 1;
        onPageChangeRef.current?.(initialPage, parsedChapters.length);

        setLoading(false);
      } catch (err: any) {
        console.error('Erro no processador EPUB:', err);
        if (!isCancelled) {
          setError(err?.message || 'Falha ao processar arquivo EPUB.');
          setLoading(false);
        }
      }
    };

    parseEpub();

    return () => {
      isCancelled = true;
      cleanupObjectUrls();
    };
  }, [file, cleanupObjectUrls]);

  const currentChapterIndex = Math.max(0, Math.min((currentPage || 1) - 1, Math.max(0, chapters.length - 1)));
  const currentChapter = chapters[currentChapterIndex];

  const handleChapterComplete = useCallback(() => {
    if (currentPageRef.current < totalChaptersRef.current) {
      autoPlayNextRef.current = true;
      onPageChangeRef.current?.(currentPageRef.current + 1, totalChaptersRef.current);
    }
  }, []);

  // 2. Tokenize DOM and prepare text with clean paragraph markers (\n\n)
  useEffect(() => {
    if (!currentChapter || !chapterBodyRef.current) return;

    const container = chapterBodyRef.current;
    container.innerHTML = currentChapter.htmlContent;

    tokensRef.current = [];
    lastActiveWordRef.current = null;
    lastActiveBlockRef.current = null;

    let accumulatedText = "";
    const tokens: TokenSpan[] = [];

    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (!node.parentElement) return NodeFilter.FILTER_REJECT;
          const tagName = node.parentElement.tagName;
          if (tagName === 'SCRIPT' || tagName === 'STYLE') {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes: Text[] = [];
    let currentNode = walker.nextNode();
    while (currentNode) {
      textNodes.push(currentNode as Text);
      currentNode = walker.nextNode();
    }

    let lastBlockElement: HTMLElement | null = null;

    textNodes.forEach(textNode => {
      const rawVal = textNode.nodeValue || "";
      if (!rawVal) return;

      const parent = textNode.parentNode;
      if (!parent) return;

      let blockParent: HTMLElement | null = textNode.parentElement;
      while (blockParent && blockParent !== container && !BLOCK_TAGS.has(blockParent.tagName)) {
        blockParent = blockParent.parentElement;
      }

      // Add clean paragraph break (\n\n) between different block elements
      if (blockParent && blockParent !== lastBlockElement) {
        if (accumulatedText.length > 0 && !accumulatedText.endsWith('\n\n')) {
          accumulatedText += '\n\n';
        }
      }
      lastBlockElement = blockParent;

      const fragment = document.createDocumentFragment();
      const regex = /(\s+)|(\S+)/g;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(rawVal)) !== null) {
        const matchText = match[0];
        const isWhitespace = match[1] !== undefined;

        if (isWhitespace) {
          const textNodeElem = document.createTextNode(matchText);
          fragment.appendChild(textNodeElem);
          accumulatedText += matchText;
        } else {
          const start = accumulatedText.length;
          const end = start + matchText.length;
          accumulatedText += matchText;

          const span = document.createElement('span');
          // Lightweight, non-shifting base style with smooth transition
          span.className = 'epub-word transition-colors duration-150 cursor-pointer rounded-xs px-0.5 inline';
          span.dataset.start = String(start);
          span.dataset.end = String(end);
          span.textContent = matchText;

          // Click-to-narrate from this exact word
          span.addEventListener('click', (e) => {
            e.stopPropagation();
            ttsPlayRef.current(accumulatedText, start, handleChapterComplete);
          });

          tokens.push({
            start,
            end,
            element: span,
            parentBlock: blockParent
          });

          fragment.appendChild(span);
        }
      }

      parent.replaceChild(fragment, textNode);
    });

    tokensRef.current = tokens;
    setChapterText(accumulatedText);

    if (contentContainerRef.current) {
      contentContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (autoPlayNextRef.current) {
      autoPlayNextRef.current = false;
      setTimeout(() => {
        if (accumulatedText.trim()) {
          ttsPlayRef.current(accumulatedText, 0, handleChapterComplete);
        }
      }, 150);
    }
  }, [currentChapter, handleChapterComplete]);

  // Dynamic Theme Highlight Classes Helper
  const getHighlightClasses = useCallback((t: ReadingTheme) => {
    switch (t) {
      case 'sepia':
        return ['bg-[#deb367]/60', 'text-[#241708]'];
      case 'dark':
        return ['bg-amber-500/35', 'text-amber-200'];
      case 'clean':
      default:
        return ['bg-amber-200/90', 'text-slate-950'];
    }
  }, []);

  const getBlockTintClass = useCallback((t: ReadingTheme) => {
    switch (t) {
      case 'sepia':
        return 'bg-[#f4e8cf]/50';
      case 'dark':
        return 'bg-white/[0.02]';
      case 'clean':
      default:
        return 'bg-slate-50/60';
    }
  }, []);

  const allHighlightClasses = ['bg-[#deb367]/60', 'text-[#241708]', 'bg-amber-500/35', 'text-amber-200', 'bg-amber-200/90', 'text-slate-950', 'bg-amber-300'];
  const allBlockTintClasses = ['bg-[#f4e8cf]/50', 'bg-white/[0.02]', 'bg-slate-50/60', 'bg-amber-50/70', 'ring-1', 'ring-amber-200/60', 'rounded-xl'];

  // 3. Smooth Text Highlighting & Auto-Scroll (NO font weight change, NO scaling, NO layout shifts)
  useEffect(() => {
    const idx = tts.currentGlobalIndex;
    const isPlayingOrPaused = tts.state.isPlaying || tts.state.isPaused;
    const tokens = tokensRef.current;

    if (!isPlayingOrPaused || tokens.length === 0) {
      if (lastActiveWordRef.current) {
        lastActiveWordRef.current.classList.remove(...allHighlightClasses);
        lastActiveWordRef.current = null;
      }
      if (lastActiveBlockRef.current) {
        lastActiveBlockRef.current.classList.remove(...allBlockTintClasses);
        lastActiveBlockRef.current = null;
      }
      return;
    }

    let activeToken = tokens.find(t => idx >= t.start && idx < t.end);

    if (!activeToken && idx > 0) {
      for (let i = tokens.length - 1; i >= 0; i--) {
        if (tokens[i].start <= idx) {
          activeToken = tokens[i];
          break;
        }
      }
    }

    if (activeToken) {
      const targetHighlight = getHighlightClasses(theme);

      // Highlight Active Word
      if (lastActiveWordRef.current !== activeToken.element) {
        if (lastActiveWordRef.current) {
          lastActiveWordRef.current.classList.remove(...allHighlightClasses);
        }
        
        activeToken.element.classList.add(...targetHighlight);
        lastActiveWordRef.current = activeToken.element;

        activeToken.element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }

      // Highlight Parent Block with subtle tint (no layout shifts or box borders)
      if (activeToken.parentBlock && lastActiveBlockRef.current !== activeToken.parentBlock) {
        if (lastActiveBlockRef.current) {
          lastActiveBlockRef.current.classList.remove(...allBlockTintClasses);
        }
        const blockTint = getBlockTintClass(theme);
        activeToken.parentBlock.classList.add(blockTint, 'transition-colors', 'duration-200');
        lastActiveBlockRef.current = activeToken.parentBlock;
      }
    }
  }, [tts.currentGlobalIndex, tts.state.isPlaying, tts.state.isPaused, theme, getHighlightClasses, getBlockTintClass]);

  const handleNextChapter = useCallback(() => {
    if (currentPage < chapters.length) {
      onPageChangeRef.current?.(currentPage + 1, chapters.length);
    }
  }, [currentPage, chapters.length]);

  const handlePrevChapter = useCallback(() => {
    if (currentPage > 1) {
      onPageChangeRef.current?.(currentPage - 1, chapters.length);
    }
  }, [currentPage, chapters.length]);

  // Combined scale factor (base scale * font scale)
  const calculatedFontPercent = Math.round(fontSizeScale * 105);

  return (
    <div className="w-full h-full flex flex-col items-center justify-start p-3 sm:p-5 md:p-8 select-text relative">
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-30 bg-slate-100/90 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-9 h-9 text-blue-600 animate-spin" />
          <p className="text-sm font-semibold text-slate-700">{loadingMsg}</p>
          <span className="text-xs text-slate-500 max-w-xs text-center">
            Processando capítulos e imagens com motor nativo ultrarrápido...
          </span>
        </div>
      )}

      {/* Error Card */}
      {error && (
        <div className="my-auto p-6 md:p-8 bg-white border border-rose-200 rounded-3xl text-center max-w-md shadow-lg">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h3 className="font-bold text-slate-900 text-base mb-1">Falha ao abrir EPUB</h3>
          <p className="text-xs text-rose-600 mb-4 leading-relaxed">{error}</p>
          <p className="text-xs text-slate-500">
            Dica: Verifique se o arquivo possui proteção DRM restritiva ou tente recarregar o livro.
          </p>
        </div>
      )}

      {/* Main EPUB Reader Surface */}
      {!loading && !error && currentChapter && (
        <div className="w-full max-w-3xl flex flex-col flex-1 pb-16">
          
          {/* Header with Title, Theme Selector & Table of Contents */}
          <div className="w-full flex items-center justify-between gap-3 mb-4 px-2">
            <div className="flex flex-col min-w-0">
              <span className={`text-xs font-bold uppercase tracking-wider truncate ${
                theme === 'dark' ? 'text-blue-400' : theme === 'sepia' ? 'text-[#8a5d28]' : 'text-blue-600'
              }`}>
                {bookTitle}
              </span>
              {bookAuthor && (
                <span className={`text-[11px] truncate ${
                  theme === 'dark' ? 'text-slate-400' : theme === 'sepia' ? 'text-[#705e4b]' : 'text-slate-500'
                }`}>
                  {bookAuthor}
                </span>
              )}
            </div>

            {/* Quick Action Controls: Table of Contents */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Table of Contents Button */}
              {toc.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setIsTocOpen(!isTocOpen)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition active:scale-95 border ${
                      theme === 'dark' 
                        ? 'bg-[#222631] border-[#333948] text-slate-200 hover:bg-[#2c3240]' 
                        : theme === 'sepia'
                        ? 'bg-[#f4e8cf] border-[#dfcfb0] text-[#4a3928] hover:bg-[#ebdcc0]'
                        : 'bg-white border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-600'
                    }`}
                    title="Tabela de Capítulos"
                    aria-label="Tabela de Capítulos"
                  >
                    <List size={15} className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} />
                    <span className="hidden sm:inline">Índice</span>
                  </button>

                  {/* TOC Dropdown Menu */}
                  {isTocOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setIsTocOpen(false)} 
                      />
                      <div className={`absolute right-0 mt-2 w-72 max-h-80 overflow-y-auto rounded-2xl shadow-xl z-50 p-2 text-xs divide-y border animate-in fade-in zoom-in-95 duration-150 ${
                        theme === 'dark' 
                          ? 'bg-[#1e222b] border-[#2f3544] divide-slate-800 text-slate-200' 
                          : theme === 'sepia'
                          ? 'bg-[#fcf5e8] border-[#e4d6bf] divide-[#ebdcc5] text-[#423324]'
                          : 'bg-white border-slate-200 divide-slate-100 text-slate-800'
                      }`}>
                        <div className="p-2 font-bold flex items-center gap-2">
                          <BookOpen size={14} className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} />
                          <span>Capítulos ({toc.length})</span>
                        </div>
                        <div className="py-1">
                          {toc.map((item, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                onPageChangeRef.current?.(item.targetChapterIndex, chapters.length);
                                setIsTocOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 rounded-xl transition flex items-center justify-between gap-2 ${
                                currentPage === item.targetChapterIndex
                                  ? theme === 'dark'
                                    ? 'bg-blue-900/40 text-blue-300 font-bold'
                                    : theme === 'sepia'
                                    ? 'bg-[#ecdcb9] text-[#2c1d0f] font-bold'
                                    : 'bg-blue-50 text-blue-700 font-bold'
                                  : theme === 'dark'
                                  ? 'hover:bg-[#282d3a] text-slate-300'
                                  : theme === 'sepia'
                                  ? 'hover:bg-[#f5e9d2] text-[#4a3928]'
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span className="truncate">{item.title}</span>
                              <span className="text-[10px] opacity-60 font-mono shrink-0">
                                {item.targetChapterIndex}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Rendered Chapter Container with Clean Highlighting & Dynamic Theme */}
          <div
            ref={contentContainerRef}
            style={{
              fontSize: `${calculatedFontPercent}%`,
              lineHeight: 1.8,
            }}
            className={`flex-1 w-full rounded-3xl p-6 sm:p-10 md:p-12 font-serif overflow-y-auto transition-colors duration-200 border ${
              theme === 'dark'
                ? 'bg-[#181a20] text-[#d8dce6] border-[#2c303c] shadow-md'
                : theme === 'sepia'
                ? 'bg-[#fbf0d9] text-[#3e3022] border-[#e4d6be] shadow-sm'
                : 'bg-white text-slate-800 border-slate-200/90 shadow-sm'
            }`}
          >
            <div
              ref={chapterBodyRef}
              className={`prose max-w-none 
                prose-headings:font-sans prose-headings:font-bold prose-headings:tracking-tight 
                prose-h1:text-2xl prose-h1:mb-6 prose-h1:mt-2
                prose-h2:text-xl prose-h2:mb-4 prose-h2:mt-6
                prose-h3:text-lg prose-h3:mb-3 prose-h3:mt-4
                prose-p:mb-5 prose-p:leading-relaxed prose-p:p-0.5
                prose-img:rounded-2xl prose-img:mx-auto prose-img:my-6 prose-img:shadow-sm prose-img:max-h-[500px] prose-img:object-contain
                prose-blockquote:border-l-4 prose-blockquote:pl-4 prose-blockquote:italic
                prose-ul:list-disc prose-ul:pl-6 prose-ul:my-4
                prose-ol:list-decimal prose-ol:pl-6 prose-ol:my-4
                prose-li:my-1 ${
                  theme === 'dark'
                    ? 'prose-invert prose-headings:text-slate-100 prose-blockquote:border-blue-400 prose-blockquote:text-slate-300 prose-p:text-[#d8dce6]'
                    : theme === 'sepia'
                    ? 'prose-stone prose-headings:text-[#2d2012] prose-blockquote:border-[#b4884f] prose-blockquote:text-[#5a4632] prose-p:text-[#3e3022]'
                    : 'prose-slate prose-headings:text-slate-900 prose-blockquote:border-blue-500 prose-blockquote:text-slate-600 prose-p:text-slate-800'
                }`}
            />
          </div>

          {/* Chapter Quick Pagination Buttons */}
          <div className="w-full flex items-center justify-between mt-4 px-2 text-xs">
            <button
              onClick={handlePrevChapter}
              disabled={currentPage <= 1}
              className={`px-4 py-2 rounded-xl font-medium shadow-2xs flex items-center gap-1.5 transition active:scale-95 border disabled:opacity-30 ${
                theme === 'dark'
                  ? 'bg-[#1e222b] border-[#2e3442] text-slate-300 hover:bg-[#282e3c]'
                  : theme === 'sepia'
                  ? 'bg-[#f8eed7] border-[#e2d3bb] text-[#4a3928] hover:bg-[#f2e4c8]'
                  : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              <ChevronLeft size={16} />
              <span>Capítulo Anterior</span>
            </button>

            <span className="font-mono opacity-60">
              {currentPage} de {chapters.length}
            </span>

            <button
              onClick={handleNextChapter}
              disabled={currentPage >= chapters.length}
              className={`px-4 py-2 rounded-xl font-medium shadow-2xs flex items-center gap-1.5 transition active:scale-95 border disabled:opacity-30 ${
                theme === 'dark'
                  ? 'bg-[#1e222b] border-[#2e3442] text-slate-300 hover:bg-[#282e3c]'
                  : theme === 'sepia'
                  ? 'bg-[#f8eed7] border-[#e2d3bb] text-[#4a3928] hover:bg-[#f2e4c8]'
                  : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              <span>Próximo Capítulo</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Text-to-Speech Data Bridge for App.tsx narration & bookmarks */}
      <div id="pdf-data-bridge" data-text={chapterText} className="hidden" aria-hidden="true" />
    </div>
  );
};
