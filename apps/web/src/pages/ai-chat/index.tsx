import * as React from 'react';
import { toast } from 'sonner';
import {
  AudioLinesIcon,
  ArrowUpIcon,
  BotIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Clock3Icon,
  CopyIcon,
  FileTextIcon,
  FolderIcon,
  LoaderCircleIcon,
  PlusIcon,
  RotateCcwIcon,
  SquareIcon,
  XIcon,
} from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Card, CardContent, CardFooter } from '@workspace/ui/components/card';
import { Field, FieldGroup, FieldLabel } from '@workspace/ui/components/field';
import { Textarea } from '@workspace/ui/components/textarea';
import { cn } from '@workspace/ui/lib/utils';
import {
  AI_CHAT_THINKING_MAX_TOKENS,
  type AiChatConversationDetail,
  type AiChatThinkingMode,
  type AiChatStreamRequest,
  createAiChatStreamRequest,
  getAiChatConversation,
  getAiChatFriendlyErrorMessage,
  parseAiChatStreamChunk,
} from '@/service/ai-chat';
import { MarkdownContent } from '@/components/markdown-content';
import { getStoredAuthTokens } from '@/service/auth';

type ChatRole = 'assistant' | 'user';
type ChatStatus = 'streaming' | 'error' | 'done';
type ChatMode = AiChatThinkingMode;

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  attachments?: ChatAttachment[];
  reasoning?: string;
  status?: ChatStatus;
  time: string;
};

type ChatAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  file?: File;
  relativePath?: string;
};

type PendingAttachment = ChatAttachment & {
  file: File;
  relativePath: string;
};

type ChatRequestFile = {
  file: File;
  relativePath: string;
};

type BrowserSpeechRecognitionAlternative = {
  transcript: string;
};

type BrowserSpeechRecognitionResult = {
  isFinal: boolean;
  readonly [index: number]: BrowserSpeechRecognitionAlternative | undefined;
};

type BrowserSpeechRecognitionEvent = {
  resultIndex: number;
  results: {
    length: number;
    readonly [index: number]: BrowserSpeechRecognitionResult | undefined;
  };
};

type BrowserSpeechRecognitionErrorEvent = {
  error: string;
};

type BrowserSpeechRecognition = {
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

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type BrowserSpeechRecognitionWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };

type BrowserAudioContextWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const initialMessages: ChatMessage[] = [];

const MAX_ATTACHMENT_COUNT = 20;
const MAX_ATTACHMENT_TOTAL_SIZE = 20 * 1024 * 1024;
const chatModeOptions: Array<{
  value: ChatMode;
  label: string;
  description: string;
}> = [
  { value: 'auto', label: '自动', description: '由服务自动选择回复策略' },
  { value: 'thinking', label: '思考', description: '更深入的分析和推理' },
  { value: 'fast', label: '快速', description: '快速响应，适合简单问题' },
];
const directoryInputProps = {
  directory: '',
  webkitdirectory: '',
} as React.InputHTMLAttributes<HTMLInputElement>;
const VOICE_WAVEFORM_BAR_COUNT = 72;
const VOICE_WAVEFORM_MIN_LEVEL = 0.08;

function createVoiceWaveformLevels() {
  return Array.from({ length: VOICE_WAVEFORM_BAR_COUNT }, () => VOICE_WAVEFORM_MIN_LEVEL);
}

function createMessageId(role: ChatRole) {
  return `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createAttachmentId() {
  return `attachment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatMessageTime(date = new Date()) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function mapConversationMessages(conversation: AiChatConversationDetail): ChatMessage[] {
  if (!conversation.messages.length) {
    return [];
  }

  return conversation.messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    reasoning: message.reasoning_content || undefined,
    status: 'done',
    time: formatMessageTime(new Date(message.created_at)),
  }));
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function getAttachmentKind(attachment: Pick<ChatAttachment, 'name' | 'type'>) {
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

function getFileRelativePath(file: File) {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}

function getAttachmentTotalSize(attachments: PendingAttachment[]) {
  return attachments.reduce((total, attachment) => total + attachment.size, 0);
}

function getSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') {
    return null;
  }

  const speechWindow = window as BrowserSpeechRecognitionWindow;

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function getAudioContextConstructor() {
  if (typeof window === 'undefined') {
    return null;
  }

  const audioWindow = window as BrowserAudioContextWindow;

  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext ?? null;
}

function mergeVoiceTranscript(baseInput: string, transcript: string) {
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

function getVoiceInputErrorMessage(error: string) {
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

function AttachmentList({ attachments }: { attachments: ChatAttachment[] }) {
  return (
    <div className="flex flex-col gap-2">
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="flex min-w-0 items-center gap-2 rounded-lg border bg-background/70 px-2.5 py-1.5 text-xs"
        >
          <FileTextIcon className="shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{attachment.name}</span>
          <span className="shrink-0 text-muted-foreground">{formatFileSize(attachment.size)}</span>
        </div>
      ))}
    </div>
  );
}

function PendingAttachmentCard({
  attachment,
  onRemove,
}: {
  attachment: PendingAttachment;
  onRemove: (id: string) => void;
}) {
  const kind = getAttachmentKind(attachment);
  const iconLabel = kind === 'HTML' || kind === 'XML' ? '</>' : kind.slice(0, 2);

  return (
    <div className="relative flex h-[4.5rem] w-56 shrink-0 items-center gap-3 rounded-2xl border bg-background px-3 py-2">
      <div
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-semibold text-muted-foreground',
          iconLabel === '</>' && 'font-mono text-base',
        )}
      >
        {iconLabel}
      </div>
      <div className="min-w-0 flex-1 pr-5">
        <div className="truncate text-sm font-semibold text-foreground" title={attachment.name}>
          {attachment.name}
        </div>
        <div className="mt-0.5 text-sm text-muted-foreground">{kind}</div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`移除 ${attachment.name}`}
        className="absolute end-1.5 top-1.5 size-6 rounded-full bg-foreground text-background hover:bg-foreground/90 hover:text-background focus-visible:ring-foreground/20"
        onClick={() => onRemove(attachment.id)}
      >
        <XIcon />
      </Button>
    </div>
  );
}

function ModelAction({
  icon: Icon,
  label,
  className,
  ...props
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon className="size-4" />
    </button>
  );
}

function VoiceInputPreview({
  transcript,
  levels,
  onCancel,
  onConfirm,
}: {
  transcript: string;
  levels: number[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const hasTranscript = Boolean(transcript.trim());

  return (
    <div className="flex h-10 min-w-0 flex-1 items-center gap-4" role="status">
      <div
        className="flex h-8 min-w-0 flex-1 items-center justify-between overflow-hidden px-1"
        aria-hidden="true"
      >
        {levels.map((level, index) => (
          <span
            key={index}
            className="w-0.5 shrink-0 rounded-full bg-muted-foreground/70 transition-[height,opacity] duration-75 ease-linear"
            style={{
              height: `${8 + level * 24}px`,
              opacity: 0.35 + level * 0.65,
            }}
          />
        ))}
      </div>
      <span className="sr-only" aria-live="polite">
        {hasTranscript ? transcript : '正在听'}
      </span>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label="取消语音输入"
          title="取消语音输入"
          className="size-8 rounded-full text-foreground hover:bg-muted/70"
          onClick={onCancel}
        >
          <XIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label="确认语音输入"
          title="确认语音输入"
          className="size-8 rounded-full text-foreground hover:bg-muted/70"
          onClick={onConfirm}
        >
          <CheckIcon />
        </Button>
      </div>
    </div>
  );
}

function ThinkingPanel({ reasoning, isStreaming }: { reasoning: string; isStreaming: boolean }) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="overflow-hidden rounded-[10px] border bg-muted/20">
      <button
        type="button"
        className="flex h-10 w-full items-center justify-between gap-3 px-3 text-start text-sm font-semibold text-muted-foreground transition-colors outline-none hover:bg-muted/30 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Clock3Icon className="size-4 shrink-0" />
          <span className="truncate">{isStreaming ? 'Thinking...' : 'Thinking'}</span>
        </span>
        <ChevronUpIcon
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            !isOpen && 'rotate-180',
          )}
        />
      </button>
      {isOpen && (
        <div className="max-h-[25rem] overflow-y-auto border-t px-4 py-4 text-[0.8125rem] leading-6 text-muted-foreground">
          <p className="break-words whitespace-pre-wrap">{reasoning}</p>
        </div>
      )}
    </div>
  );
}

function UserMessageBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex justify-end ps-10">
      <div className="flex max-w-[min(24rem,72%)] flex-col gap-2 rounded-full bg-muted/45 px-4 py-2 text-sm leading-6 text-foreground">
        {message.attachments?.length ? <AttachmentList attachments={message.attachments} /> : null}
        {message.content ? (
          <p className="break-words whitespace-pre-wrap">{message.content}</p>
        ) : null}
      </div>
    </div>
  );
}

function AssistantMessageCard({
  message,
  canRetry,
  onCopy,
  onRetry,
  onStop,
}: {
  message: ChatMessage;
  canRetry: boolean;
  onCopy: (message: ChatMessage) => void;
  onRetry: (messageId: string) => void;
  onStop: () => void;
}) {
  const hasReasoning = Boolean(message.reasoning);
  const isStreaming = message.status === 'streaming';
  const hasContent = Boolean(message.content);

  return (
    <div className="flex w-full justify-start pe-2">
      <div
        className={cn(
          'w-full max-w-[48rem] overflow-hidden rounded-[14px] border bg-card text-card-foreground shadow-none',
          message.status === 'error' && 'border-destructive/40',
        )}
      >
        <div className="flex h-11 items-center justify-between gap-3 border-b px-3">
          <div className="flex min-w-0 items-center gap-2">
            <BotIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-semibold">AI小助手</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isStreaming ? (
              <ModelAction icon={SquareIcon} label="停止生成" onClick={onStop} />
            ) : (
              <>
                <ModelAction
                  icon={CopyIcon}
                  label="复制回答"
                  disabled={!hasContent}
                  onClick={() => onCopy(message)}
                />
                {canRetry ? (
                  <ModelAction
                    icon={RotateCcwIcon}
                    label="重新生成"
                    onClick={() => onRetry(message.id)}
                  />
                ) : null}
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col px-3 py-3 text-sm leading-7">
          {hasReasoning && isStreaming ? (
            <span className="mb-3 font-mono text-xs leading-4 text-muted-foreground">
              Thinking •••
            </span>
          ) : null}
          {hasReasoning ? (
            <ThinkingPanel
              key={message.status}
              reasoning={message.reasoning ?? ''}
              isStreaming={isStreaming}
            />
          ) : null}
          {hasContent ? (
            <MarkdownContent content={message.content} className={cn(hasReasoning && 'mt-5')} />
          ) : !hasReasoning ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <LoaderCircleIcon className="size-4 animate-spin" />
              正在思考...
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  canRetry,
  onCopyAssistant,
  onRetryAssistant,
  onStopAssistant,
}: {
  message: ChatMessage;
  canRetry: boolean;
  onCopyAssistant: (message: ChatMessage) => void;
  onRetryAssistant: (messageId: string) => void;
  onStopAssistant: () => void;
}) {
  const isUser = message.role === 'user';

  return isUser ? (
    <UserMessageBubble message={message} />
  ) : (
    <AssistantMessageCard
      message={message}
      canRetry={canRetry}
      onCopy={onCopyAssistant}
      onRetry={onRetryAssistant}
      onStop={onStopAssistant}
    />
  );
}

export function AiChatPage() {
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = React.useState('');
  const [attachments, setAttachments] = React.useState<PendingAttachment[]>([]);
  const [chatMode, setChatMode] = React.useState<ChatMode>('thinking');
  const [selectedConversationId, setSelectedConversationId] = React.useState<string | null>(null);
  const [isConversationLoading, setIsConversationLoading] = React.useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = React.useState(false);
  const [isChatModeMenuOpen, setIsChatModeMenuOpen] = React.useState(false);
  const [isVoiceInputActive, setIsVoiceInputActive] = React.useState(false);
  const [voiceTranscript, setVoiceTranscript] = React.useState('');
  const [voiceLevels, setVoiceLevels] = React.useState(createVoiceWaveformLevels);
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [isUserScrolling, setIsUserScrolling] = React.useState(false);
  const messagesRef = React.useRef<ChatMessage[]>(initialMessages);
  const selectedConversationIdRef = React.useRef<string | null>(null);
  const sessionIdRef = React.useRef<string | null>(null);
  const requestRef = React.useRef<AiChatStreamRequest | null>(null);
  const activeRequestIdRef = React.useRef<string | null>(null);
  const streamingConversationIdRef = React.useRef<string | null>(null);
  const streamingMessagesRef = React.useRef<ChatMessage[] | null>(null);
  const messageListRef = React.useRef<HTMLDivElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const directoryInputRef = React.useRef<HTMLInputElement | null>(null);
  const attachmentMenuRef = React.useRef<HTMLDivElement | null>(null);
  const chatModeMenuRef = React.useRef<HTMLDivElement | null>(null);
  const speechRecognitionRef = React.useRef<BrowserSpeechRecognition | null>(null);
  const voiceAudioContextRef = React.useRef<AudioContext | null>(null);
  const voiceAudioSourceRef = React.useRef<MediaStreamAudioSourceNode | null>(null);
  const voiceMediaStreamRef = React.useRef<MediaStream | null>(null);
  const voiceAnimationFrameRef = React.useRef<number | null>(null);
  const voiceBaseInputRef = React.useRef('');
  const voiceDraftTranscriptRef = React.useRef('');
  const voiceFinalTranscriptRef = React.useRef('');
  const isVoiceInputStoppingRef = React.useRef(false);
  const isAtMessageListBottomRef = React.useRef(true);
  const ignoreMessageScrollRef = React.useRef(false);
  const shouldScrollLoadedConversationToTopRef = React.useRef(false);
  const scrollbarHideTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  React.useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  React.useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('ai-chat:streaming-changed', {
        detail: { isStreaming },
      }),
    );
  }, [isStreaming]);

  const stopVoiceMeter = React.useCallback(() => {
    if (voiceAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(voiceAnimationFrameRef.current);
      voiceAnimationFrameRef.current = null;
    }

    voiceAudioSourceRef.current?.disconnect();
    voiceAudioSourceRef.current = null;
    void voiceAudioContextRef.current?.close();
    voiceAudioContextRef.current = null;

    voiceMediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    voiceMediaStreamRef.current = null;
    setVoiceLevels(createVoiceWaveformLevels());
  }, []);

  const startVoiceMeter = React.useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('media-devices-unavailable');
    }

    const AudioContextConstructor = getAudioContextConstructor();

    if (!AudioContextConstructor) {
      throw new Error('audio-context-unavailable');
    }

    stopVoiceMeter();

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    const audioContext = new AudioContextConstructor();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.58;
    const samples = new Uint8Array(analyser.fftSize);

    source.connect(analyser);
    voiceMediaStreamRef.current = stream;
    voiceAudioContextRef.current = audioContext;
    voiceAudioSourceRef.current = source;

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    function sampleVoiceLevel() {
      analyser.getByteTimeDomainData(samples);

      let sum = 0;

      for (const sample of samples) {
        const centered = (sample - 128) / 128;
        sum += centered * centered;
      }

      const rms = Math.sqrt(sum / samples.length);
      const level = Math.min(1, Math.max(VOICE_WAVEFORM_MIN_LEVEL, (rms - 0.015) * 8));

      setVoiceLevels((current) => [...current.slice(1), level]);
      voiceAnimationFrameRef.current = window.requestAnimationFrame(sampleVoiceLevel);
    }

    sampleVoiceLevel();
  }, [stopVoiceMeter]);

  const stopVoiceInput = React.useCallback(
    (options: { abort?: boolean } = {}) => {
      const recognition = speechRecognitionRef.current;
      const { abort = false } = options;

      stopVoiceMeter();

      if (!recognition) {
        setIsVoiceInputActive(false);
        return;
      }

      isVoiceInputStoppingRef.current = true;

      if (abort) {
        recognition.abort();
      } else {
        recognition.stop();
      }

      speechRecognitionRef.current = null;
      setIsVoiceInputActive(false);
    },
    [stopVoiceMeter],
  );

  const setVisibleMessages = React.useCallback((nextMessages: ChatMessage[]) => {
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
  }, []);

  const resetConversation = React.useCallback(() => {
    requestRef.current?.abort();
    activeRequestIdRef.current = null;
    streamingConversationIdRef.current = null;
    streamingMessagesRef.current = null;
    stopVoiceInput({ abort: true });
    sessionIdRef.current = null;
    selectedConversationIdRef.current = null;
    setSelectedConversationId(null);
    window.dispatchEvent(
      new CustomEvent('ai-chat:selected-conversation-changed', {
        detail: { id: null },
      }),
    );
    setVisibleMessages(initialMessages);
    setInput('');
    setAttachments([]);
    setVoiceTranscript('');
    setIsStreaming(false);
  }, [setVisibleMessages, stopVoiceInput]);

  React.useEffect(() => {
    function handleNewConversation() {
      resetConversation();
    }

    window.addEventListener('ai-chat:new-conversation', handleNewConversation);

    return () => {
      window.removeEventListener('ai-chat:new-conversation', handleNewConversation);
    };
  }, [resetConversation]);

  React.useLayoutEffect(() => {
    const messageList = messageListRef.current;

    if (!messageList) {
      return;
    }

    if (shouldScrollLoadedConversationToTopRef.current) {
      if (isConversationLoading) {
        return;
      }

      ignoreMessageScrollRef.current = true;
      messageList.scrollTo({
        top: 0,
        behavior: 'auto',
      });

      window.requestAnimationFrame(() => {
        ignoreMessageScrollRef.current = false;
        shouldScrollLoadedConversationToTopRef.current = false;
        updateIsAtMessageListBottom(messageList);
      });
      return;
    }

    if (!isAtMessageListBottomRef.current) {
      return;
    }

    ignoreMessageScrollRef.current = true;
    messageList.scrollTo({
      top: messageList.scrollHeight,
      behavior: 'auto',
    });

    window.requestAnimationFrame(() => {
      ignoreMessageScrollRef.current = false;
      updateIsAtMessageListBottom(messageList);
    });
  }, [isConversationLoading, messages]);

  React.useEffect(() => {
    return () => {
      requestRef.current?.abort();
      stopVoiceInput({ abort: true });

      if (scrollbarHideTimerRef.current) {
        window.clearTimeout(scrollbarHideTimerRef.current);
      }
    };
  }, [stopVoiceInput]);

  React.useEffect(() => {
    function handleSelectConversation(event: Event) {
      const detail = (event as CustomEvent<{ id?: string; title?: string | null }>).detail;

      if (detail?.id) {
        void loadConversation({ id: detail.id, title: detail.title });
      }
    }

    window.addEventListener('ai-chat:select-conversation', handleSelectConversation);

    return () => {
      window.removeEventListener('ai-chat:select-conversation', handleSelectConversation);
    };
  });

  React.useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!isAttachmentMenuOpen && !isChatModeMenuOpen) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (isAttachmentMenuOpen && !attachmentMenuRef.current?.contains(target)) {
        setIsAttachmentMenuOpen(false);
      }

      if (isChatModeMenuOpen && !chatModeMenuRef.current?.contains(target)) {
        setIsChatModeMenuOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isAttachmentMenuOpen, isChatModeMenuOpen]);

  function updateIsAtMessageListBottom(element: HTMLDivElement) {
    const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;

    isAtMessageListBottomRef.current = distanceToBottom <= 48;
  }

  function showUserScrollbar() {
    setIsUserScrolling(true);

    if (scrollbarHideTimerRef.current) {
      window.clearTimeout(scrollbarHideTimerRef.current);
    }

    scrollbarHideTimerRef.current = window.setTimeout(() => {
      setIsUserScrolling(false);
    }, 900);
  }

  function handleMessageListScroll(event: React.UIEvent<HTMLDivElement, UIEvent>) {
    updateIsAtMessageListBottom(event.currentTarget);

    if (!ignoreMessageScrollRef.current && event.nativeEvent.isTrusted) {
      showUserScrollbar();
    }
  }

  function updateMessageList(
    messagesToUpdate: ChatMessage[],
    messageId: string,
    updater: (message: ChatMessage) => ChatMessage,
  ) {
    return messagesToUpdate.map((message) =>
      message.id === messageId ? updater(message) : message,
    );
  }

  function updateAssistantMessageForConversation(
    conversationId: string | null,
    messageId: string,
    updater: (message: ChatMessage) => ChatMessage,
  ) {
    let nextStreamingMessages: ChatMessage[] | null = null;

    if (streamingConversationIdRef.current === conversationId) {
      nextStreamingMessages = updateMessageList(
        streamingMessagesRef.current ?? messagesRef.current,
        messageId,
        updater,
      );
      streamingMessagesRef.current = nextStreamingMessages;
    }

    if (selectedConversationIdRef.current !== conversationId) {
      return;
    }

    const nextMessages =
      nextStreamingMessages ?? updateMessageList(messagesRef.current, messageId, updater);

    setVisibleMessages(nextMessages);
  }

  function handleStop() {
    requestRef.current?.abort();
    setIsStreaming(false);
  }

  function getActiveAccessToken() {
    const tokens = getStoredAuthTokens();

    if (!tokens?.accessToken) {
      const message = '登录状态已失效，请重新登录后再试。';
      toast.error(message);
      return null;
    }

    return tokens.accessToken;
  }

  function refreshSidebarConversations(options: { selectFirst?: boolean } = {}) {
    window.dispatchEvent(
      new CustomEvent('ai-chat:refresh-conversations', {
        detail: options,
      }),
    );
  }

  function markSelectedConversation({ id, title }: { id: string; title?: string | null }) {
    selectedConversationIdRef.current = id;
    setSelectedConversationId(id);
    window.dispatchEvent(
      new CustomEvent('ai-chat:selected-conversation-changed', {
        detail: { id, title },
      }),
    );
  }

  function selectActiveConversation({
    id,
    sessionId = id,
    title,
  }: {
    id: string;
    sessionId?: string;
    title?: string | null;
  }) {
    sessionIdRef.current = sessionId;
    markSelectedConversation({ id, title });
  }

  function publishConversationTitle({ id, title }: { id: string; title: string }) {
    window.dispatchEvent(
      new CustomEvent('ai-chat:conversation-title-updated', {
        detail: { id, title },
      }),
    );
  }

  function updateStreamingConversationId(nextConversationId: string, title?: string | null) {
    const previousConversationId = streamingConversationIdRef.current;
    const isViewingStreamingConversation =
      selectedConversationIdRef.current === previousConversationId;

    streamingConversationIdRef.current = nextConversationId;

    if (!isViewingStreamingConversation) {
      return;
    }

    selectActiveConversation({
      id: nextConversationId,
      title,
    });
  }

  async function loadConversation(conversation: { id: string; title?: string | null }) {
    if (streamingConversationIdRef.current === conversation.id && streamingMessagesRef.current) {
      selectActiveConversation(conversation);
      shouldScrollLoadedConversationToTopRef.current = false;
      isAtMessageListBottomRef.current = true;
      setVisibleMessages(streamingMessagesRef.current);
      setAttachments([]);
      setInput('');
      return;
    }

    const accessToken = getActiveAccessToken();

    if (!accessToken) {
      return;
    }

    markSelectedConversation(conversation);
    setIsConversationLoading(true);

    try {
      const detail = await getAiChatConversation(accessToken, conversation.id);

      shouldScrollLoadedConversationToTopRef.current = true;
      isAtMessageListBottomRef.current = false;
      selectActiveConversation({
        id: detail.id,
        sessionId: detail.session_id,
        title: detail.title,
      });
      setVisibleMessages(mapConversationMessages(detail));
      setAttachments([]);
      setInput('');
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : '会话详情加载失败。');
    } finally {
      setIsConversationLoading(false);
    }
  }

  function startAssistantRequest({
    accessToken,
    assistantMessageId,
    conversationIdAtStart,
    mode,
    prompt,
    requestFiles,
  }: {
    accessToken: string;
    assistantMessageId: string;
    conversationIdAtStart: string | null;
    mode: ChatMode;
    prompt: string;
    requestFiles: ChatRequestFile[];
  }) {
    const shouldShowReasoning = mode !== 'fast';
    const requestId = createMessageId('request');
    let requestConversationId = conversationIdAtStart;
    let streamedContent = '';
    let streamedReasoning = '';
    let streamFailed = false;

    activeRequestIdRef.current = requestId;
    streamingConversationIdRef.current = requestConversationId;
    streamingMessagesRef.current = messagesRef.current;
    setIsStreaming(true);

    const request = createAiChatStreamRequest(accessToken, {
      onUpdate: (chunk) => {
        if (activeRequestIdRef.current !== requestId) {
          return;
        }

        const event = parseAiChatStreamChunk(chunk);

        if (event.sessionId) {
          requestConversationId = event.sessionId;
          updateStreamingConversationId(event.sessionId);
        }

        if (event.type === 'session') {
          return;
        }

        if (event.type === 'title') {
          const title = event.title?.trim();
          const conversationId = event.sessionId?.trim();

          if (title && conversationId) {
            requestConversationId = conversationId;
            updateStreamingConversationId(conversationId, title);
            publishConversationTitle({ id: conversationId, title });
          }

          return;
        }

        if (event.type === 'reasoning') {
          if (!shouldShowReasoning) {
            return;
          }

          if (!event.content) {
            return;
          }

          streamedReasoning += event.content;
          updateAssistantMessageForConversation(
            requestConversationId,
            assistantMessageId,
            (message) => ({
              ...message,
              reasoning: streamedReasoning,
            }),
          );
          return;
        }

        if (event.type === 'delta') {
          if (!event.content) {
            return;
          }

          streamedContent += event.content;
          updateAssistantMessageForConversation(
            requestConversationId,
            assistantMessageId,
            (message) => ({
              ...message,
              content: streamedContent,
            }),
          );
          return;
        }

        if (event.type === 'done') {
          streamedContent = event.message ?? streamedContent;
          streamedReasoning = shouldShowReasoning ? (event.reasoning ?? streamedReasoning) : '';
          updateAssistantMessageForConversation(
            requestConversationId,
            assistantMessageId,
            (message) => ({
              ...message,
              content: streamedContent,
              reasoning: streamedReasoning || undefined,
              status: 'done',
            }),
          );
          return;
        }

        if (event.type === 'error') {
          const streamErrorMessage = event.errorMessage || 'AI 服务返回错误。';

          streamFailed = true;
          activeRequestIdRef.current = null;
          requestRef.current = null;
          setIsStreaming(false);
          toast.error(streamErrorMessage);
          updateAssistantMessageForConversation(
            requestConversationId,
            assistantMessageId,
            (message) => ({
              ...message,
              content: streamErrorMessage,
              reasoning: undefined,
              status: 'error',
            }),
          );
          return;
        }

        if (!event.content) {
          return;
        }

        streamedContent += event.content;
        updateAssistantMessageForConversation(
          requestConversationId,
          assistantMessageId,
          (message) => ({
            ...message,
            content: streamedContent,
          }),
        );
      },
      onSuccess: () => {
        if (activeRequestIdRef.current !== requestId) {
          return;
        }

        if (streamFailed) {
          return;
        }

        activeRequestIdRef.current = null;
        requestRef.current = null;
        setIsStreaming(false);
        updateAssistantMessageForConversation(
          requestConversationId,
          assistantMessageId,
          (message) => ({
            ...message,
            content:
              message.content ||
              (message.reasoning
                ? '服务没有返回正式回答，请稍后重试或关闭思考模式。'
                : '服务没有返回可展示的内容。'),
            status: 'done',
          }),
        );
        refreshSidebarConversations({
          selectFirst:
            !conversationIdAtStart &&
            selectedConversationIdRef.current === streamingConversationIdRef.current,
        });
      },
      onError: (error) => {
        if (activeRequestIdRef.current !== requestId) {
          return;
        }

        const friendlyMessage = getAiChatFriendlyErrorMessage(error);

        activeRequestIdRef.current = null;
        requestRef.current = null;
        setIsStreaming(false);

        if (error.name !== 'AbortError') {
          toast.error(friendlyMessage);
        }

        updateAssistantMessageForConversation(
          requestConversationId,
          assistantMessageId,
          (message) => ({
            ...message,
            content:
              error.name === 'AbortError' ? message.content || friendlyMessage : friendlyMessage,
            reasoning: error.name === 'AbortError' ? message.reasoning : undefined,
            status: error.name === 'AbortError' ? 'done' : 'error',
          }),
        );
      },
    });

    requestRef.current = request;
    request.run({
      message: prompt,
      session_id: sessionIdRef.current,
      thinking_mode: mode,
      max_tokens: mode === 'thinking' ? AI_CHAT_THINKING_MAX_TOKENS : undefined,
      files: requestFiles.length ? requestFiles : undefined,
    });
  }

  async function handleCopyAssistantMessage(message: ChatMessage) {
    if (!message.content) {
      return;
    }

    try {
      await navigator.clipboard.writeText(message.content);
      toast.success('已复制回答');
    } catch {
      toast.error('复制失败，请手动选择内容复制。');
    }
  }

  function handleRetryAssistantMessage(assistantMessageId: string) {
    if (isStreaming) {
      toast.info('上一条回复仍在生成，请先停止或等待完成。');
      return;
    }

    const assistantIndex = messages.findIndex((message) => message.id === assistantMessageId);

    if (assistantIndex < 0) {
      return;
    }

    const sourceUserMessage = messages
      .slice(0, assistantIndex)
      .findLast((message) => message.role === 'user');

    if (!sourceUserMessage) {
      toast.info('没有可重试的用户问题。');
      return;
    }

    const prompt =
      sourceUserMessage.content.trim() ||
      (sourceUserMessage.attachments?.length ? '请分析我上传的文件。' : '');

    if (!prompt) {
      toast.info('没有可重试的用户问题。');
      return;
    }

    const accessToken = getActiveAccessToken();

    if (!accessToken) {
      return;
    }

    const requestFiles =
      sourceUserMessage.attachments
        ?.filter(
          (
            attachment,
          ): attachment is ChatAttachment & {
            file: File;
            relativePath: string;
          } => Boolean(attachment.file && attachment.relativePath),
        )
        .map((attachment) => ({
          file: attachment.file,
          relativePath: attachment.relativePath,
        })) ?? [];

    if (
      sourceUserMessage.attachments?.length &&
      requestFiles.length !== sourceUserMessage.attachments.length
    ) {
      toast.info('部分历史附件无法重新上传，将仅重试可用内容。');
    }

    isAtMessageListBottomRef.current = true;
    setVisibleMessages(
      messages.map((message) =>
        message.id === assistantMessageId
          ? {
              ...message,
              content: '',
              reasoning: undefined,
              status: 'streaming',
              time: formatMessageTime(),
            }
          : message,
      ),
    );
    startAssistantRequest({
      accessToken,
      assistantMessageId,
      conversationIdAtStart: selectedConversationIdRef.current,
      mode: chatMode,
      prompt,
      requestFiles,
    });
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.currentTarget.files ?? []);

    if (!selectedFiles.length) {
      return;
    }

    setAttachments((current) => {
      const availableSlots = MAX_ATTACHMENT_COUNT - current.length;
      let nextTotalSize = getAttachmentTotalSize(current);

      if (availableSlots <= 0) {
        toast.error(`最多上传 ${MAX_ATTACHMENT_COUNT} 个文件。`);
        return current;
      }

      const acceptedFiles: PendingAttachment[] = [];

      for (const file of selectedFiles) {
        if (acceptedFiles.length >= availableSlots) {
          break;
        }

        if (nextTotalSize + file.size > MAX_ATTACHMENT_TOTAL_SIZE) {
          toast.error(`${file.name} 加入后总大小超过 20 MB，已忽略该文件。`);
          continue;
        }

        const relativePath = getFileRelativePath(file);

        acceptedFiles.push({
          id: createAttachmentId(),
          name: relativePath,
          size: file.size,
          type: file.type || 'application/octet-stream',
          file,
          relativePath,
        });
        nextTotalSize += file.size;
      }

      if (selectedFiles.length > availableSlots) {
        toast.info(`最多上传 ${MAX_ATTACHMENT_COUNT} 个文件，已忽略多余文件。`);
      }

      return [...current, ...acceptedFiles];
    });

    setIsAttachmentMenuOpen(false);
    event.currentTarget.value = '';
  }

  function removeAttachment(id: string) {
    setAttachments((current) => current.filter((attachment) => attachment.id !== id));
  }

  function handleChatModeChange(nextMode: ChatMode) {
    setChatMode(nextMode);
    setIsChatModeMenuOpen(false);
  }

  function clearVoiceTranscript() {
    voiceDraftTranscriptRef.current = '';
    voiceFinalTranscriptRef.current = '';
    setVoiceTranscript('');
  }

  function handleVoiceInputCancel() {
    const baseInput = voiceBaseInputRef.current;

    stopVoiceInput({ abort: true });
    clearVoiceTranscript();
    setInput(baseInput);
  }

  function handleVoiceInputConfirm() {
    const nextInput = mergeVoiceTranscript(
      voiceBaseInputRef.current,
      voiceDraftTranscriptRef.current,
    );

    stopVoiceInput();
    clearVoiceTranscript();
    setInput(nextInput);
  }

  async function handleVoiceInputToggle() {
    if (isVoiceInputActive) {
      stopVoiceInput();
      return;
    }

    const SpeechRecognitionConstructor = getSpeechRecognitionConstructor();

    if (!SpeechRecognitionConstructor) {
      toast.error('当前浏览器不支持语音输入，请使用 Chrome 或 Edge。');
      return;
    }

    const recognition = new SpeechRecognitionConstructor();

    voiceBaseInputRef.current = input;
    clearVoiceTranscript();
    isVoiceInputStoppingRef.current = false;

    try {
      await startVoiceMeter();
    } catch {
      clearVoiceTranscript();
      toast.error('无法访问麦克风，请允许麦克风权限后再试。');
      return;
    }

    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setIsVoiceInputActive(true);
      toast.info('正在听，请开始说话。');
    };
    recognition.onresult = (event) => {
      let finalTranscript = voiceFinalTranscriptRef.current;
      let interimTranscript = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript ?? '';

        if (!transcript) {
          continue;
        }

        if (result?.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const nextTranscript = `${finalTranscript}${interimTranscript}`;

      voiceDraftTranscriptRef.current = nextTranscript;
      voiceFinalTranscriptRef.current = finalTranscript;
      setVoiceTranscript(nextTranscript);
    };
    recognition.onerror = (event) => {
      if (event.error !== 'aborted' && !isVoiceInputStoppingRef.current) {
        toast.error(getVoiceInputErrorMessage(event.error));
        setInput(voiceBaseInputRef.current);
        clearVoiceTranscript();
      }

      speechRecognitionRef.current = null;
      stopVoiceMeter();
      setIsVoiceInputActive(false);
    };
    recognition.onend = () => {
      const shouldKeepReview =
        !isVoiceInputStoppingRef.current && Boolean(voiceDraftTranscriptRef.current.trim());

      stopVoiceMeter();

      speechRecognitionRef.current = null;
      setIsVoiceInputActive(shouldKeepReview);
      isVoiceInputStoppingRef.current = false;
    };

    speechRecognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      speechRecognitionRef.current = null;
      stopVoiceMeter();
      setIsVoiceInputActive(false);
      toast.error('语音输入启动失败，请稍后再试。');
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    stopVoiceInput();
    clearVoiceTranscript();

    const typedPrompt = input.trim();
    const pendingAttachments = attachments;
    const prompt = typedPrompt || (pendingAttachments.length ? '请分析我上传的文件。' : '');

    if (!prompt) {
      return;
    }

    if (isStreaming) {
      toast.info('上一条回复仍在生成，请先停止或等待完成。');
      return;
    }

    const accessToken = getActiveAccessToken();

    if (!accessToken) {
      return;
    }

    const userMessage: ChatMessage = {
      id: createMessageId('user'),
      role: 'user',
      content: prompt,
      attachments: pendingAttachments.map((attachment) => ({
        id: attachment.id,
        name: attachment.name,
        size: attachment.size,
        type: attachment.type,
        file: attachment.file,
        relativePath: attachment.relativePath,
      })),
      status: 'done',
      time: formatMessageTime(),
    };
    const assistantMessage: ChatMessage = {
      id: createMessageId('assistant'),
      role: 'assistant',
      content: '',
      status: 'streaming',
      time: formatMessageTime(),
    };
    const nextMessages = [...messages, userMessage, assistantMessage];

    isAtMessageListBottomRef.current = true;
    setVisibleMessages(nextMessages);
    setInput('');
    setAttachments([]);

    startAssistantRequest({
      accessToken,
      assistantMessageId: assistantMessage.id,
      conversationIdAtStart: selectedConversationIdRef.current,
      mode: chatMode,
      prompt,
      requestFiles: pendingAttachments.map((attachment) => ({
        file: attachment.file,
        relativePath: attachment.relativePath,
      })),
    });
  }

  const isNewConversation =
    !selectedConversationId && !isConversationLoading && messages.length === 0 && !isStreaming;

  function renderPromptForm(variant: 'center' | 'footer') {
    const isCentered = variant === 'center';
    const hasPrompt = Boolean(input.trim() || attachments.length);
    const inputId = isCentered ? 'ai-chat-input-empty' : 'ai-chat-input';
    const selectedModeLabel =
      chatModeOptions.find((option) => option.value === chatMode)?.label ?? '思考';

    return (
      <form
        className={cn(isCentered ? 'w-full' : 'mx-auto flex w-full max-w-[49.5rem] flex-col gap-2')}
        onSubmit={handleSubmit}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={inputId} className="sr-only">
              输入消息
            </FieldLabel>
            <div
              className={cn(
                'bg-secondary/70',
                attachments.length
                  ? 'flex min-h-[8.75rem] flex-col gap-2 rounded-[1.75rem] px-3 py-2'
                  : 'flex h-14 items-center gap-2 rounded-full px-3',
              )}
            >
              {attachments.length ? (
                <div className="flex max-w-full gap-2 overflow-x-auto pb-1 pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {attachments.map((attachment) => (
                    <PendingAttachmentCard
                      key={attachment.id}
                      attachment={attachment}
                      onRemove={removeAttachment}
                    />
                  ))}
                </div>
              ) : null}
              <div
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-2',
                  attachments.length && 'min-h-12 px-1',
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
                <input
                  ref={directoryInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                  {...directoryInputProps}
                />
                <div ref={attachmentMenuRef} className="relative shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    aria-label="添加附件"
                    aria-haspopup="menu"
                    aria-expanded={isAttachmentMenuOpen}
                    title="添加附件"
                    className="size-9 rounded-full bg-background text-foreground hover:bg-background"
                    disabled={isStreaming}
                    onClick={() => setIsAttachmentMenuOpen((current) => !current)}
                  >
                    <PlusIcon />
                  </Button>
                  {isAttachmentMenuOpen && (
                    <div
                      role="menu"
                      className={cn(
                        'absolute start-0 z-30 w-60 rounded-2xl border border-transparent bg-background p-1.5 text-sm text-foreground shadow-[0_16px_34px_rgb(15_23_42/0.14)] ring-1 ring-border/40',
                        isCentered ? 'top-full mt-2' : 'bottom-full mb-2',
                      )}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        className="flex h-10 w-full items-center gap-1.5 rounded-xl px-3.5 text-start text-sm font-normal text-foreground transition-colors hover:bg-muted/45"
                        onClick={() => {
                          fileInputRef.current?.click();
                          setIsAttachmentMenuOpen(false);
                        }}
                      >
                        <FileTextIcon className="size-4 text-foreground" />
                        <span>文件</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="flex h-10 w-full items-center gap-1.5 rounded-xl px-3.5 text-start text-sm font-normal text-foreground transition-colors hover:bg-muted/45"
                        onClick={() => {
                          directoryInputRef.current?.click();
                          setIsAttachmentMenuOpen(false);
                        }}
                      >
                        <FolderIcon className="size-4 text-foreground" />
                        <span>文件夹</span>
                      </button>
                    </div>
                  )}
                </div>
                {isVoiceInputActive ? (
                  <VoiceInputPreview
                    transcript={voiceTranscript}
                    levels={voiceLevels}
                    onCancel={handleVoiceInputCancel}
                    onConfirm={handleVoiceInputConfirm}
                  />
                ) : (
                  <>
                    <Textarea
                      id={inputId}
                      rows={1}
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          if (!event.currentTarget.value.trim() && attachments.length === 0) {
                            return;
                          }
                          event.currentTarget.form?.requestSubmit();
                        }
                      }}
                      placeholder="有什么我能帮您的吗?"
                      disabled={isStreaming}
                      className={cn(
                        'min-h-0 flex-1 resize-none overflow-hidden border-0 bg-transparent px-0 text-sm leading-6 text-foreground shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0',
                        attachments.length ? 'h-12 py-3' : 'h-10 py-2',
                      )}
                    />
                    <div className="flex shrink-0 items-center gap-2">
                      <div ref={chatModeMenuRef} className="relative">
                        <button
                          type="button"
                          className={cn(
                            'flex h-9 items-center gap-1.5 rounded-full text-sm text-foreground transition-colors outline-none hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50',
                            'px-2 text-xs text-foreground/75',
                          )}
                          aria-haspopup="menu"
                          aria-expanded={isChatModeMenuOpen}
                          disabled={isStreaming}
                          onClick={() => setIsChatModeMenuOpen((current) => !current)}
                        >
                          <span>{selectedModeLabel}</span>
                          <ChevronDownIcon
                            className={cn(
                              'size-3 text-muted-foreground/75 transition-transform',
                              isChatModeMenuOpen && 'rotate-180',
                            )}
                          />
                        </button>
                        {isChatModeMenuOpen && (
                          <div
                            role="menu"
                            className={cn(
                              'absolute end-0 z-30 w-60 rounded-2xl border border-transparent bg-background p-1.5 text-sm text-foreground shadow-[0_16px_34px_rgb(15_23_42/0.14)] ring-1 ring-border/40',
                              isCentered ? 'top-full mt-2' : 'bottom-full mb-2',
                            )}
                          >
                            {chatModeOptions.map((option) => {
                              const isSelected = chatMode === option.value;

                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  role="menuitemradio"
                                  aria-checked={isSelected}
                                  className={cn(
                                    'flex h-10 w-full items-center justify-between rounded-xl px-3.5 text-start text-sm font-normal text-foreground transition-colors hover:bg-muted/45',
                                    isSelected && 'bg-muted/45',
                                  )}
                                  onClick={() => handleChatModeChange(option.value)}
                                >
                                  <span>{option.label}</span>
                                  {isSelected && <CheckIcon className="text-primary" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <Button
                        type={isStreaming || !hasPrompt ? 'button' : 'submit'}
                        size="icon-lg"
                        aria-label={isStreaming ? '停止生成' : hasPrompt ? '发送' : '语音输入'}
                        aria-pressed={!isStreaming && !hasPrompt && isVoiceInputActive}
                        title={isStreaming ? '停止生成' : hasPrompt ? '发送' : '语音输入'}
                        className={cn(
                          'size-9 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/80',
                          isVoiceInputActive &&
                            !isStreaming &&
                            !hasPrompt &&
                            'ring-3 ring-primary/20',
                        )}
                        onClick={
                          isStreaming ? handleStop : hasPrompt ? undefined : handleVoiceInputToggle
                        }
                      >
                        {isStreaming ? (
                          <SquareIcon />
                        ) : hasPrompt ? (
                          <ArrowUpIcon />
                        ) : (
                          <AudioLinesIcon />
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Field>
        </FieldGroup>
      </form>
    );
  }

  return (
    <div
      className={cn(
        'box-border flex h-full min-h-0 flex-1 flex-col overflow-hidden p-4',
        isNewConversation ? 'bg-background' : 'bg-muted/20',
      )}
    >
      <Card
        className={cn(
          'grid min-h-0 flex-1 overflow-hidden bg-card py-[8px]',
          isNewConversation
            ? 'grid-rows-[minmax(0,1fr)] border-0 shadow-none'
            : 'grid-rows-[minmax(0,1fr)_auto] rounded-2xl border shadow-[0_10px_30px_rgb(15_23_42/0.06)]',
        )}
      >
        <CardContent className="min-h-0 overflow-hidden bg-card p-0">
          {isNewConversation ? (
            <div className="flex h-full min-h-0 items-center justify-center px-6 pb-28">
              <div className="flex w-full max-w-[49.5rem] flex-col items-center gap-7">
                <h1 className="text-center text-[2rem] leading-tight font-semibold text-foreground">
                  我们该从哪里开始?
                </h1>
                {renderPromptForm('center')}
              </div>
            </div>
          ) : (
            <div
              ref={messageListRef}
              className={cn(
                'flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-5 py-5',
                isUserScrolling
                  ? '[scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent'
                  : '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
              )}
              onScroll={handleMessageListScroll}
              onTouchMove={showUserScrollbar}
              onWheel={showUserScrollbar}
            >
              {isConversationLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  正在加载会话...
                </div>
              ) : (
                messages.map((message, index) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    canRetry={messages.slice(0, index).some((item) => item.role === 'user')}
                    onCopyAssistant={handleCopyAssistantMessage}
                    onRetryAssistant={handleRetryAssistantMessage}
                    onStopAssistant={handleStop}
                  />
                ))
              )}
            </div>
          )}
        </CardContent>
        {!isNewConversation ? (
          <>
            <CardFooter className="sticky bottom-0 z-10 shrink-0 bg-card px-5 py-4">
              {renderPromptForm('footer')}
            </CardFooter>
          </>
        ) : null}
      </Card>
    </div>
  );
}
