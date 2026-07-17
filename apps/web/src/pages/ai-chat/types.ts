import type { AiChatGenerationStatus, AiChatThinkingMode } from '@/service/ai-chat';

export type ChatRole = 'assistant' | 'user';
export type ChatStatus = 'streaming' | 'stopped' | 'error' | 'done';
export type ChatMode = AiChatThinkingMode;

export type ChatAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  file?: File;
  relativePath?: string;
};

export type PendingAttachment = ChatAttachment & {
  file: File;
  relativePath: string;
};

export type ChatRequestFile = {
  file: File;
  relativePath: string;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  attachments?: ChatAttachment[];
  reasoningTitle?: string;
  reasoningContent?: string;
  reasoning?: string;
  generationStatus?: AiChatGenerationStatus;
  errorMessage?: string;
  status?: ChatStatus;
  time: string;
};

export type GenerationState = {
  generationId: string | null;
  conversationId: string | null;
  status: 'idle' | AiChatGenerationStatus;
  reasoningContent: string;
  content: string;
  error: string | null;
};

export type ReasoningStep = {
  id: string;
  title: string;
  body: string;
};

export type BrowserSpeechRecognitionAlternative = {
  transcript: string;
};

export type BrowserSpeechRecognitionResult = {
  isFinal: boolean;
  readonly [index: number]: BrowserSpeechRecognitionAlternative | undefined;
};

export type BrowserSpeechRecognitionEvent = {
  resultIndex: number;
  results: {
    length: number;
    readonly [index: number]: BrowserSpeechRecognitionResult | undefined;
  };
};

export type BrowserSpeechRecognitionErrorEvent = {
  error: string;
};

export type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onend: (() => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onstart: (() => void) | null;
  abort: () => void;
  start: () => void;
  stop: () => void;
};

export type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;
