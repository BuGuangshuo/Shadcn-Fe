import type {
  AiChatConversationAttachment,
  AiChatConversationDetail,
} from '@/service/ai-chat';

import { VOICE_WAVEFORM_BAR_COUNT, VOICE_WAVEFORM_MIN_LEVEL } from './constants';
import type {
  BrowserSpeechRecognitionConstructor,
  ChatAttachment,
  ChatMessage,
  ChatRole,
  PendingAttachment,
  ReasoningStep,
} from './types';

type BrowserSpeechRecognitionWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };

type BrowserAudioContextWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const DOCUMENT_ATTACHMENT_KINDS = new Set(['DOC', 'DOCX', 'ODT', 'PDF', 'RTF', 'TXT']);

export function createVoiceWaveformLevels() {
  return Array.from({ length: VOICE_WAVEFORM_BAR_COUNT }, () => VOICE_WAVEFORM_MIN_LEVEL);
}

export function createMessageId(role: ChatRole | 'request') {
  return `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createAttachmentId() {
  return `attachment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function formatMessageTime(date = new Date()) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function mapConversationAttachments(
  messageId: string,
  attachments?: AiChatConversationAttachment[],
): ChatAttachment[] | undefined {
  if (!attachments?.length) {
    return undefined;
  }

  return attachments.map((attachment, index) => ({
    id: `${messageId}-attachment-${index}`,
    name: attachment.filename,
    size: attachment.size,
    type: attachment.content_type ?? '',
  }));
}

export function mapConversationMessages(conversation: AiChatConversationDetail): ChatMessage[] {
  if (!conversation.messages.length) {
    return [];
  }

  return conversation.messages.map((message) => {
    const attachments =
      message.role === 'user'
        ? mapConversationAttachments(message.id, message.attachments)
        : undefined;

    return {
      id: message.id,
      role: message.role,
      content: message.content,
      ...(attachments ? { attachments } : {}),
      reasoningTitle: message.reasoning_title || undefined,
      reasoningContent: message.reasoning_content || undefined,
      reasoning: message.reasoning_content || undefined,
      status: 'done',
      time: formatMessageTime(new Date(message.created_at)),
    };
  });
}

export function getAttachmentKind(attachment: Pick<ChatAttachment, 'name' | 'type'>) {
  const extension = attachment.name.split('.').pop();

  if (extension && extension !== attachment.name) {
    return extension.slice(0, 6).toUpperCase();
  }

  const subtype = attachment.type.split('/')[1];

  if (subtype) {
    return subtype.split(/[+.-]/)[0].slice(0, 6).toUpperCase();
  }

  return 'FILE';
}

function getAttachmentDisplayKind(attachment: Pick<ChatAttachment, 'name' | 'type'>) {
  const kind = getAttachmentKind(attachment);

  return DOCUMENT_ATTACHMENT_KINDS.has(kind) ? '文档' : kind;
}

export function formatAttachmentSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return '未知大小';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** unitIndex;
  const precision = unitIndex === 0 || value >= 10 ? 0 : 1;

  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

export function getAttachmentDescription(
  attachment: Pick<ChatAttachment, 'name' | 'type' | 'size'>,
) {
  return [
    getAttachmentDisplayKind(attachment),
    attachment.type,
    formatAttachmentSize(attachment.size),
  ]
    .filter(Boolean)
    .join(' · ');
}

export function getReasoningStatusLabel(message: Pick<ChatMessage, 'status'>) {
  if (message.status === 'streaming') {
    return '正在思考';
  }

  return message.status === 'stopped' ? '思考已停止' : '已思考';
}

function cleanReasoningSectionTitle(title: string) {
  return title
    .replace(/^\s{0,3}#{1,6}\s+/, '')
    .replace(/\s+#+\s*$/, '')
    .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s*)?/, '')
    .replace(/^\*\*/, '')
    .replace(/\*\*:?$/, '')
    .replace(/[：:]\s*$/, '')
    .trim();
}

function getExplicitReasoningSectionHeading(line: string) {
  const trimmedLine = line.trim();

  if (!trimmedLine) {
    return null;
  }

  const markdownHeading = trimmedLine.match(/^#{1,6}\s+(.+)$/);

  if (markdownHeading?.[1]) {
    return {
      title: cleanReasoningSectionTitle(markdownHeading[1]),
      rest: '',
    };
  }

  const numberedBoldTitle = trimmedLine.match(/^\d+[.)]\s+\*\*(.+?)\*\*:?\s*(.*)$/);

  if (numberedBoldTitle?.[1]) {
    return {
      title: cleanReasoningSectionTitle(numberedBoldTitle[1]),
      rest: numberedBoldTitle[2]?.trim() ?? '',
    };
  }

  const standaloneBoldTitle = trimmedLine.match(/^\*\*(.+?)\*\*:?\s*$/);

  if (standaloneBoldTitle?.[1]) {
    return {
      title: cleanReasoningSectionTitle(standaloneBoldTitle[1]),
      rest: '',
    };
  }

  return null;
}

function getExplicitReasoningSteps(message: ChatMessage, body: string) {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const steps: ReasoningStep[] = [];
  let currentTitle: string | null = null;
  let currentBodyLines: string[] = [];

  function pushStep() {
    if (!currentTitle) {
      return;
    }

    steps.push({
      id: `${message.id}-reasoning-${steps.length}`,
      title: currentTitle,
      body: currentBodyLines.join('\n').trim(),
    });
  }

  for (const line of lines) {
    const nextHeading = getExplicitReasoningSectionHeading(line);

    if (nextHeading) {
      pushStep();
      currentTitle = nextHeading.title;
      currentBodyLines = nextHeading.rest ? [nextHeading.rest] : [];
      continue;
    }

    if (currentTitle) {
      currentBodyLines.push(line);
    }
  }

  pushStep();

  return steps;
}

export function getReasoningSteps(message: ChatMessage | null): ReasoningStep[] {
  if (!message) {
    return [];
  }

  const body = message.reasoningContent ?? message.reasoning ?? '';

  if (!body && !message.reasoningTitle) {
    return [];
  }

  const explicitSteps = getExplicitReasoningSteps(message, body);

  if (explicitSteps.length) {
    return explicitSteps;
  }

  return [
    {
      id: `${message.id}-reasoning`,
      title: '思考过程',
      body,
    },
  ];
}

export function getReasoningSourceAttachments(messages: ChatMessage[], assistantMessageId: string) {
  const assistantIndex = messages.findIndex((message) => message.id === assistantMessageId);

  if (assistantIndex <= 0) {
    return [];
  }

  for (let index = assistantIndex - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message?.role === 'user') {
      return message.attachments ?? [];
    }
  }

  return [];
}

export function getFileRelativePath(file: File) {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}

export function getAttachmentTotalSize(attachments: PendingAttachment[]) {
  return attachments.reduce((total, attachment) => total + attachment.size, 0);
}

export function getSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') {
    return null;
  }

  const speechWindow = window as BrowserSpeechRecognitionWindow;

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function getAudioContextConstructor() {
  if (typeof window === 'undefined') {
    return null;
  }

  const audioWindow = window as BrowserAudioContextWindow;

  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext ?? null;
}

export function mergeVoiceTranscript(baseInput: string, transcript: string) {
  const normalizedTranscript = transcript.trim();

  if (!baseInput.trim()) {
    return normalizedTranscript;
  }

  if (!normalizedTranscript) {
    return baseInput;
  }

  const needsSeparator =
    !/[\s\n]$/.test(baseInput) && !/^[,.!?;:，。！？；：]/.test(normalizedTranscript);

  return `${baseInput}${needsSeparator ? ' ' : ''}${normalizedTranscript}`;
}

export function getVoiceInputErrorMessage(error: string) {
  if (error === 'not-allowed' || error === 'service-not-allowed') {
    return '浏览器没有麦克风权限，请允许后再试。';
  }

  if (error === 'audio-capture') {
    return '没有检测到可用麦克风。';
  }

  if (error === 'no-speech') {
    return '没有识别到语音，请再试一次。';
  }

  if (error === 'network') {
    return '语音识别服务连接失败，请检查网络后再试。';
  }

  return '语音输入暂时不可用，请稍后再试。';
}
