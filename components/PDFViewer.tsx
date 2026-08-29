import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TextMapItem, SmartTTSHook, ReadingTheme } from '../types';

interface PDFViewerProps {
  file: File;
  tts: SmartTTSHook;
  onPageChange: (pageNum: number, total: number) => void;
  currentPage: number;
  scale: number;
  theme?: ReadingTheme;
}

interface LineRegion {
  start: number;
  end: number;
  rect: { top: number; left: number; width: number; height: number };
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ 
  file, 
  tts, 
  onPageChange, 
  currentPage, 
  scale,
  theme = 'clean' 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  
  // Maps
  const [textMap, setTextMap] = useState<TextMapItem[]>([]);
  const [lineRegions, setLineRegions] = useState<LineRegion[]>([]);
  const [pageText, setPageText] = useState<string>("");
  
  const isRenderingRef = useRef(false);
  
  // Touch gesture zoom and pan states for mobile
  const [localScale, setLocalScale] = useState(1);
  const [localTranslate, setLocalTranslate] = useState({ x: 0, y: 0 });
  const [isGestureActive, setIsGestureActive] = useState(false);

  const touchStateRef = useRef({
    scale: 1,
    translate: { x: 0, y: 0 },
    startX: 0,
    startY: 0,
    lastY: 0,
    startDist: 0,
    startScale: 1,
    startTranslate: { x: 0, y: 0 },
    isPinching: false,
    isPanning: false
  });
  
  // Logic Control Refs
  const autoPlayPageRef = useRef<number | null>(null);
  const onPageChangeRef = useRef(onPageChange);
  const currentPageRef = useRef(currentPage);
  const numPagesRef = useRef(numPages);
  
  const lastScrolledElementRef = useRef<HTMLElement | null>(null);
  
  useEffect(() => {
    onPageChangeRef.current = onPageChange;
    currentPageRef.current = currentPage;
    numPagesRef.current = numPages;
  }, [onPageChange, currentPage, numPages]);

  // 1. Load Document
  useEffect(() => {
    const loadPdf = async () => {
      try {
        autoPlayPageRef.current = null;
        
        const arrayBuffer = await file.arrayBuffer();
        if (!window.pdfjsLib) {
          throw new Error("Biblioteca PDF.js não encontrada.");
        }
        if (window.pdfjsLib.GlobalWorkerOptions && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
        const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        const initialPage = currentPageRef.current && currentPageRef.current <= doc.numPages ? currentPageRef.current : 1;
        onPageChangeRef.current(initialPage, doc.numPages);
      } catch (error) {
        console.error("Error loading PDF:", error);
      }
    };
    loadPdf();
  }, [file]);

  const handlePageComplete = useCallback(() => {
    const curr = currentPageRef.current;
    const total = numPagesRef.current;

    if (curr < total) {
       const nextPage = curr + 1;
       autoPlayPageRef.current = nextPage;
       onPageChangeRef.current(nextPage, total);
    } else {
       autoPlayPageRef.current = null;
    }
  }, []);

  // 2. Render Page & Handle Autoplay
  useEffect(() => {
    if (!pdfDoc || !containerRef.current) return;
    
    const isAutoPlayAdvance = autoPlayPageRef.current === currentPage;
    const isManualOrExisting = tts.state.isPlaying;
    const shouldPlay = isAutoPlayAdvance || isManualOrExisting;

    let isCancelled = false;

    const renderPage = async () => {
      if (isRenderingRef.current) return;
      isRenderingRef.current = true;

      try {
        if (tts.state.isPlaying && !isAutoPlayAdvance) {
          tts.stop();
        }

        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale: scale });
        
        if (containerRef.current) containerRef.current.innerHTML = '';
        
        const pageWrapper = document.createElement('div');
        pageWrapper.className = `relative shadow-lg mx-auto transition-all duration-200 ${
          theme === 'dark' ? 'bg-[#181a20]' : theme === 'sepia' ? 'bg-[#fbf0d9]' : 'bg-white'
        }`;
        pageWrapper.style.width = `${viewport.width}px`;
        pageWrapper.style.height = `${viewport.height}px`;
        pageWrapper.style.setProperty('--scale-factor', String(viewport.scale));
        
        if (containerRef.current) containerRef.current.appendChild(pageWrapper);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        // Theme filter for Canvas
        if (theme === 'dark') {
          canvas.style.filter = 'invert(0.88) hue-rotate(180deg) contrast(0.92)';
        } else if (theme === 'sepia') {
          canvas.style.filter = 'sepia(0.28) contrast(0.96) brightness(0.98)';
        } else {
          canvas.style.filter = 'none';
        }

        pageWrapper.appendChild(canvas);
        
        await page.render({ canvasContext: ctx!, viewport }).promise;

        if (isCancelled) return;

        // Highlight Layer (Subtle, theme-aware tint)
        const highlightDiv = document.createElement('div');
        highlightDiv.id = 'tts-highlight';
        highlightDiv.className = 'absolute z-0 pointer-events-none transition-all duration-100 ease-out';
        
        if (theme === 'dark') {
          highlightDiv.style.backgroundColor = 'rgba(245, 158, 11, 0.3)';
        } else if (theme === 'sepia') {
          highlightDiv.style.backgroundColor = 'rgba(217, 119, 6, 0.28)';
        } else {
          highlightDiv.style.backgroundColor = 'rgba(251, 191, 36, 0.35)';
        }

        highlightDiv.style.borderRadius = '3px';
        highlightDiv.style.opacity = '0';
        pageWrapper.appendChild(highlightDiv);

        // Text Layer
        const textDiv = document.createElement('div');
        textDiv.className = 'textLayer absolute inset-0 leading-none origin-top-left z-10';
        textDiv.style.setProperty('--scale-factor', String(viewport.scale));
        pageWrapper.appendChild(textDiv);

        const textContent = await page.getTextContent();
        await window.pdfjsLib.renderTextLayer({
          textContentSource: textContent,
          container: textDiv,
          viewport: viewport,
          textDivs: []
        }).promise;

        // Text Extraction with paragraph breaks
        const spans = Array.from(textDiv.querySelectorAll('span')) as HTMLElement[];
        let accumulatedText = "";
        const mapItems: TextMapItem[] = [];

        let lastTop = -1;
        let lastHeight = 16;

        spans.forEach(span => {
          const content = span.textContent || "";
          const rect = span.getBoundingClientRect();

          // If there's a significant vertical gap indicating a new paragraph, add \n\n
          if (lastTop > 0 && rect.top - lastTop > lastHeight * 1.6) {
            if (accumulatedText.length > 0 && !accumulatedText.endsWith('\n\n')) {
              accumulatedText += '\n\n';
            }
          }

          const suffix = (content.endsWith(' ') || content.endsWith('-')) ? '' : ' ';
          const fullSegment = content + suffix;

          mapItems.push({
            start: accumulatedText.length,
            end: accumulatedText.length + fullSegment.length, 
            element: span
          });
          
          accumulatedText += fullSegment;
          lastTop = rect.top;
          if (rect.height > 0) lastHeight = rect.height;
        });

        // Line Grouping for Highlight
        const groups: LineRegion[] = [];
        if (mapItems.length > 0) {
            const wrapperRect = pageWrapper.getBoundingClientRect();
            let currentGroup = [mapItems[0]];

            const finalizeGroup = (items: TextMapItem[]) => {
                let minTop = Infinity, maxBottom = -Infinity; 
                let minLeft = Infinity, maxRight = -Infinity;

                items.forEach(it => {
                   const r = it.element.getBoundingClientRect();
                   const top = r.top - wrapperRect.top;
                   const bottom = r.bottom - wrapperRect.top;
                   const left = r.left - wrapperRect.left;
                   const right = r.right - wrapperRect.left;

                   if (top < minTop) minTop = top;
                   if (bottom > maxBottom) maxBottom = bottom;
                   if (left < minLeft) minLeft = left;
                   if (right > maxRight) maxRight = right;
                });

                const V_PAD = 2 * (scale / 1.5);
                const H_PAD = 4 * (scale / 1.5);

                groups.push({
                    start: items[0].start,
                    end: items[items.length - 1].end,
                    rect: {
                        top: minTop - V_PAD,
                        left: minLeft - H_PAD,
                        width: (maxRight - minLeft) + (H_PAD * 2),
                        height: (maxBottom - minTop) + (V_PAD * 2)
                    }
                });
            };

            for (let i = 1; i < mapItems.length; i++) {
                const prev = mapItems[i-1];
                const curr = mapItems[i];
                const prevR = prev.element.getBoundingClientRect();
                const currR = curr.element.getBoundingClientRect();
                
                const prevMidY = prevR.top + (prevR.height / 2);
                const currMidY = currR.top + (currR.height / 2);
                const isSameLine = Math.abs(prevMidY - currMidY) < (prevR.height * 0.5);
                const isGap = (currR.left - prevR.right) > (50 * (scale/1.5)); 

                if (isSameLine && !isGap) {
                    currentGroup.push(curr);
                } else {
                    finalizeGroup(currentGroup);
                    currentGroup = [curr];
                }
            }
            finalizeGroup(currentGroup);
        }

        setPageText(accumulatedText);
        setTextMap(mapItems);
        setLineRegions(groups);

        // Text Layer Click Handler to start narrating from clicked sentence beginning
        textDiv.addEventListener('click', (e) => {
          const target = e.target as HTMLElement;
          if (target && target.tagName === 'SPAN') {
            const item = mapItems.find(it => it.element === target);
            if (item) {
              const sentenceStartIdx = findSentenceStart(accumulatedText, item.start);
              tts.play(accumulatedText, sentenceStartIdx, handlePageComplete);
            }
          }
        });
        
        // Trigger Autoplay
        if (shouldPlay) {
           setTimeout(() => {
             if (currentPage === currentPageRef.current && !isCancelled) {
                if (autoPlayPageRef.current === currentPage) {
                    autoPlayPageRef.current = null;
                }
                
                tts.play(accumulatedText, 0, handlePageComplete);
             }
           }, 100);
        }

      } catch (err) {
        console.error("Page render error:", err);
      } finally {
        isRenderingRef.current = false;
      }
    };

    renderPage();

    return () => { isCancelled = true; };
  }, [pdfDoc, currentPage, scale, theme]);

  // 3. Highlight Updates
  useEffect(() => {
    const idx = tts.currentGlobalIndex;
    const highlightDiv = containerRef.current?.querySelector('#tts-highlight') as HTMLElement;
    
    const activeRegion = lineRegions.find(r => idx >= r.start && idx < r.end);

    if (activeRegion && highlightDiv) {
       const r = activeRegion.rect;
       highlightDiv.style.top = `${r.top}px`;
       highlightDiv.style.left = `${r.left}px`;
       highlightDiv.style.width = `${r.width}px`;
       highlightDiv.style.height = `${r.height}px`;
       highlightDiv.style.opacity = '1';

       const mapItem = textMap.find(m => idx >= m.start && idx < m.end);
       if (mapItem && lastScrolledElementRef.current !== mapItem.element) {
           mapItem.element.scrollIntoView({ 
               behavior: 'smooth', 
               block: 'center',
               inline: 'center'
           });
           lastScrolledElementRef.current = mapItem.element;
       }
    } else if (highlightDiv && idx === 0) {
       highlightDiv.style.opacity = '0';
    }
  }, [tts.currentGlobalIndex, lineRegions, textMap]);

  // Reset local zoom/pan when scale prop changes from control bar
  useEffect(() => {
    const state = touchStateRef.current;
    state.scale = 1;
    state.translate = { x: 0, y: 0 };
    setLocalScale(1);
    setLocalTranslate({ x: 0, y: 0 });
  }, [scale]);

  // Touch Gestures for mobile zoom and pan
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const state = touchStateRef.current;
    
    if (e.touches.length === 1) {
      // Single touch = Panning / Window scrolling
      const touch = e.touches[0];
      state.startX = touch.clientX;
      state.startY = touch.clientY;
      state.lastY = touch.clientY; // Track last touch position for scrolling delta
      state.startTranslate = { ...state.translate };
      state.isPanning = true;
      state.isPinching = false;
    } else if (e.touches.length === 2) {
      // Two touches = Pinching (+ optional panning)
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      state.startDist = Math.sqrt(dx * dx + dy * dy);
      
      state.startScale = state.scale;
      state.startX = (touch1.clientX + touch2.clientX) / 2;
      state.startY = (touch1.clientY + touch2.clientY) / 2;
      state.startTranslate = { ...state.translate };
      
      state.isPinching = true;
      state.isPanning = false;
    }
    
    setIsGestureActive(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const state = touchStateRef.current;
    if (!state.isPanning && !state.isPinching) return;
    
    if (state.isPanning && e.touches.length === 1) {
      const touch = e.touches[0];
      const dx = touch.clientX - state.startX;
      const dy = touch.clientY - state.startY;
      
      if (state.scale > 1) {
        if (e.cancelable) e.preventDefault();
        state.translate = {
          x: state.startTranslate.x + dx / state.scale,
          y: state.startTranslate.y + dy / state.scale
        };
        setLocalTranslate({ ...state.translate });
      } else {
        // When not zoomed in, vertical drag scrolls the browser viewport manually
        // since we use touch-action: none to block default browser zooming.
        if (state.lastY !== undefined) {
          const deltaY = state.lastY - touch.clientY;
          state.lastY = touch.clientY;
          if (deltaY !== 0) {
            window.scrollBy(0, deltaY);
          }
        }
      }
    } else if (state.isPinching && e.touches.length === 2) {
      if (e.cancelable) e.preventDefault();
      
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (state.startDist > 0) {
        const scaleFactor = dist / state.startDist;
        const newScale = Math.max(0.75, Math.min(state.startScale * scaleFactor, 4.0));
        state.scale = newScale;
        setLocalScale(newScale);
        
        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;
        const panX = centerX - state.startX;
        const panY = centerY - state.startY;
        
        state.translate = {
          x: state.startTranslate.x + panX / newScale,
          y: state.startTranslate.y + panY / newScale
        };
        setLocalTranslate({ ...state.translate });
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    const state = touchStateRef.current;
    state.isPanning = false;
    state.isPinching = false;
    setIsGestureActive(false);
  }, []);

  const lastTapRef = useRef<number>(0);
  const handleTouchStartWithDoubleTap = useCallback((e: React.TouchEvent) => {
    const state = touchStateRef.current;
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap to reset
      state.scale = 1;
      state.translate = { x: 0, y: 0 };
      setLocalScale(1);
      setLocalTranslate({ x: 0, y: 0 });
      setIsGestureActive(false);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      handleTouchStart(e);
    }
  }, [handleTouchStart]);

  return (
    <div className={`w-full flex justify-center py-8 min-h-[calc(100vh-8rem)] overflow-visible transition-colors duration-200 ${
      theme === 'dark' ? 'bg-[#0f1115]' : theme === 'sepia' ? 'bg-[#ede0c8]' : 'bg-slate-100'
    }`}>
      <style>{`
        .textLayer {
          opacity: 1 !important;
          mix-blend-mode: normal !important;
        }
        .textLayer span {
          color: transparent;
        }
      `}</style>
      <div 
        ref={containerRef} 
        style={{ 
          '--scale-factor': scale,
          transform: `scale(${localScale}) translate(${localTranslate.x}px, ${localTranslate.y}px)`,
          transformOrigin: 'center center',
          transition: isGestureActive ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          touchAction: 'none',
          cursor: isGestureActive ? 'grabbing' : 'grab'
        } as React.CSSProperties}
        onTouchStart={handleTouchStartWithDoubleTap}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      {/* Data bridge for App.tsx */}
      <div id="pdf-data-bridge" data-text={pageText} className="hidden"></div>
    </div>
  );
};

function findSentenceStart(text: string, index: number): number {
  if (index <= 0) return 0;
  let pos = index - 1;
  while (pos >= 0) {
    const char = text[pos];
    if (/[.!?\n]/.test(char)) {
      let start = pos + 1;
      while (start < index && /\s/.test(text[start])) {
        start++;
      }
      return start;
    }
    pos--;
  }
  return 0;
}
