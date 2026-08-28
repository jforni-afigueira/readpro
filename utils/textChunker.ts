/**
 * Utility functions for text preprocessing, chunking and paragraph splitting for Speech Synthesis.
 */

export interface TextChunk {
  text: string;
  globalIndex: number;
}

export function cleanTextForSpeech(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \u00A0]+/g, ' ')
    .trim();
}

/**
 * Splits text into readable chunks (sentences or short paragraphs)
 * optimized for Web Speech API to prevent browser speech cutoff bugs.
 */
export function splitTextIntoParagraphs(text: string, maxChunkLength: number = 220): string[] {
  if (!text || !text.trim()) return [];

  const rawParagraphs = text
    .split(/\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const finalChunks: string[] = [];

  for (const para of rawParagraphs) {
    if (para.length <= maxChunkLength) {
      finalChunks.push(para);
      continue;
    }

    // Split large paragraph into sentences
    const sentences = para.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [para];
    let currentChunk = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;

      if ((currentChunk + ' ' + trimmedSentence).trim().length <= maxChunkLength) {
        currentChunk = (currentChunk + ' ' + trimmedSentence).trim();
      } else {
        if (currentChunk) {
          finalChunks.push(currentChunk);
        }
        if (trimmedSentence.length > maxChunkLength) {
          // Break very long sentence by commas or clauses
          const clauses = trimmedSentence.split(/([,;:]\s+)/);
          let subChunk = '';
          for (const clause of clauses) {
            if ((subChunk + clause).length <= maxChunkLength) {
              subChunk += clause;
            } else {
              if (subChunk.trim()) finalChunks.push(subChunk.trim());
              subChunk = clause;
            }
          }
          if (subChunk.trim()) finalChunks.push(subChunk.trim());
          currentChunk = '';
        } else {
          currentChunk = trimmedSentence;
        }
      }
    }

    if (currentChunk.trim()) {
      finalChunks.push(currentChunk.trim());
    }
  }

  return finalChunks;
}
