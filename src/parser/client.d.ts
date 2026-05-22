import type { ParseResult } from './index';

export interface ParseChatOptions {
  /** A File or Blob — a .zip or .txt WhatsApp export. */
  file?: Blob & { name?: string };
  /** Raw transcript text (alternative to `file`). */
  text?: string;
  /** Progress callback. `phase` is 'unzip' (ZIP only) then 'parse'. */
  onProgress?: (phase: 'unzip' | 'parse') => void;
}

/**
 * Parse a WhatsApp export off the main thread via a Web Worker,
 * falling back to main-thread parsing where Workers are unavailable.
 */
export function parseChat(opts: ParseChatOptions): Promise<ParseResult>;
