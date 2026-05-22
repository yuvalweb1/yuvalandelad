// Type definitions for whatsapp-wrapped-parser

export interface ParsedMessage {
  timestamp: Date;
  author: string;
  content: string;
  contentLength: number;
  isDeleted: boolean;
  hasMedia: boolean;
  isVoice: boolean;
  hasLink: boolean;
  linkCount: number;
  emojis: string[];
  wordCount: number;
  isQuestion: boolean;
  hour: number;
  weekday: number;
  dayKey: string;
  rawLineIdx: number;
  rawLine: string;
}

export interface Diagnostics {
  rawLineCount: number;
  nonEmptyLines: number;
  parsedMessages: number;
  continuationLines: number;
  systemMessages: number;
  deletedMessages: number;
  mediaMessages: number;
  voiceMessages: number;
  skippedUnparseable: number;
  detectedFormat: 'ios_bracket' | 'android_dash' | null;
  perAuthorCount: Record<string, number>;
  perAuthorWordCount: Record<string, number>;
  perAuthorMediaCount: Record<string, number>;
  perAuthorVoiceCount: Record<string, number>;
  hadBOM: boolean;
  hadDirectionalMarks: boolean;
  confidence: number;
  warnings: string[];
  sample: Array<{
    rawLineIdx: number;
    rawLine: string;
    timestamp: string;
    author: string;
    contentPreview: string;
    flags: string;
  }>;
}

export interface ParseResult {
  messages: ParsedMessage[];
  diagnostics: Diagnostics;
}

/** Parse a raw WhatsApp .txt export. Pure & deterministic. */
export function parseWhatsApp(rawText: string): ParseResult;

/** Build a local Date from header fields. Returns null for impossible dates. */
export function parseDate(
  d: string, mo: string, y: string, h: string, mi: string, ampm?: string
): Date | null;

/** Remove bidirectional control marks (LRM/RLM/isolates). */
export function stripDirectional(s: string): string;

/** Extract the chat transcript text from a WhatsApp .zip export (browser-native). */
export function readZipText(file: Blob): Promise<string>;
