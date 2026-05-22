import type { ParseResult } from './index';

export interface ParseChatOptions {
  /** A File or Blob — a .zip or .txt WhatsApp export. */
  file?: Blob & { name?: string };
  /** Raw transcript text (alternative to `file`). */
  text?: string;
  /** Progress callback. `phase` is 'unzip' (ZIP only) then 'parse'. */
  onProgress?: (phase: 'unzip' | 'parse') => void;
}

/** A photo extracted from a "with media" .zip, ready for an <img>. */
export interface ChatPhoto {
  name: string;
  mime: string;
  /** Sender the chat references for this file, if matched. */
  author: string | null;
  /** Timestamp of the message that sent it, if matched. */
  ts: Date | null;
  /** Object URL (createObjectURL). Call URL.revokeObjectURL when done. */
  url: string;
}

export interface ParseChatResult extends ParseResult {
  /** Images extracted on-device from a "with media" export (empty otherwise). */
  media: ChatPhoto[];
}

/**
 * Parse a WhatsApp export off the main thread via a Web Worker,
 * falling back to main-thread parsing where Workers are unavailable.
 */
export function parseChat(opts: ParseChatOptions): Promise<ParseChatResult>;
