import * as React from 'react';
import { toast } from 'sonner';

import { cn } from '@workspace/ui/lib/utils';
import {
  type AiChatAbortableRequest,
  type AiChatConversationDetail,
  type AiChatGenerationSnapshot,
  cancelAiChatGeneration,
  createAiChatGenerationStreamRequest,
  getAiChatConversation,
  getAiChatConversationGeneration,
  getAiChatGeneration,
  isAiChatHttpError,
  parseAiChatStreamChunk,
} from '@/service/ai-chat';
import { getStoredAuthTokens } from '@/service/auth';

import { startAssistantStream } from './assistant-stream';
import { ChatMessage as ChatMessageView } from './components/chat-message';
import { ConversationLoadingSkeleton } from './components/conversation-loading-skeleton';
import { PromptComposer } from './components/prompt-composer';
import { ThinkingActivityPanel } from './components/thinking-activity-panel';
import {
  INITIAL_MESSAGES,
  MAX_ATTACHMENT_COUNT,
  MAX_ATTACHMENT_TOTAL_SIZE,
  SELECTED_CONVERSATION_STORAGE_KEY,
} from './constants';
import { useMessageListScroll } from './hooks/use-message-list-scroll';
import { useVoiceInput } from './hooks/use-voice-input';
import {
  getChatStatusFromGeneration,
  isActiveGenerationStatus,
  markGenerationMessageStopped,
  mergeGenerationSnapshotMessages,
} from './generation-state';
import type {
  ChatAttachment,
  ChatMessage,
  ChatMode,
  ChatRequestFile,
  GenerationState,
  PendingAttachment,
} from './types';
import {
  createAttachmentId,
  createMessageId,
  formatMessageTime,
  getAttachmentTotalSize,
  getFileRelativePath,
  getReasoningSourceAttachments,
  mapConversationMessages,
} from './utils';

const IDLE_GENERATION_STATE: GenerationState = {
  generationId: null,
  conversationId: null,
  status: 'idle',
  reasoningContent: '',
  content: '',
  error: null,
};

export function AiChatPage() {
  const [initiallySelectedConversationId] = React.useState(() => {
    try {
      return window.localStorage.getItem(SELECTED_CONVERSATION_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [messages, setMessages] = React.useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = React.useState('');
  const [attachments, setAttachments] = React.useState<PendingAttachment[]>([]);
  const [chatMode, setChatMode] = React.useState<ChatMode>('thinking');
  const [selectedConversationId, setSelectedConversationId] = React.useState<string | null>(
    initiallySelectedConversationId,
  );
  const [isConversationLoading, setIsConversationLoading] = React.useState(
    Boolean(initiallySelectedConversationId),
  );
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [activeReasoningMessageId, setActiveReasoningMessageId] = React.useState<string | null>(
    null,
  );
  const messagesRef = React.useRef<ChatMessage[]>(INITIAL_MESSAGES);
  const selectedConversationIdRef = React.useRef<string | null>(initiallySelectedConversationId);
  const sessionIdRef = React.useRef<string | null>(initiallySelectedConversationId);
  const requestRef = React.useRef<AiChatAbortableRequest | null>(null);
  const activeRequestIdRef = React.useRef<string | null>(null);
  const conversationLoadControllerRef = React.useRef<AbortController | null>(null);
  const generationStateRef = React.useRef<GenerationState>(IDLE_GENERATION_STATE);
  const streamingConversationIdRef = React.useRef<string | null>(null);
  const streamingMessagesRef = React.useRef<ChatMessage[] | null>(null);
  const stoppedConversationVerificationRef = React.useRef<{
    conversationId: string;
    verification: Promise<AiChatConversationDetail | null>;
  } | null>(null);
  const retryPendingRef = React.useRef(false);
  const loadConversationRef = React.useRef<
    | ((
        conversation: { id: string; title?: string | null },
        options?: { isInitialRestore?: boolean },
      ) => Promise<void>)
    | null
  >(null);
  const {
    isActive: isVoiceInputActive,
    transcript: voiceTranscript,
    levels: voiceLevels,
    toggle: toggleVoiceInput,
    cancel: cancelVoiceInput,
    confirm: confirmVoiceInput,
    stop: stopVoiceInput,
    clearTranscript: clearVoiceTranscript,
  } = useVoiceInput({
    input,
    onInputChange: setInput,
  });
  const {
    messageListRef,
    isUserScrolling,
    handleScroll: handleMessageListScroll,
    showUserScrollbar,
    followLatestMessage,
    showLoadedConversationFromTop,
  } = useMessageListScroll({
    messages,
    isConversationLoading,
  });

  React.useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  React.useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  const activeReasoningMessage = React.useMemo(() => {
    if (!activeReasoningMessageId) {
      return null;
    }

    return (
      messages.find(
        (message) =>
          (message.id === activeReasoningMessageId &&
            message.role === 'assistant' &&
            message.reasoning) ||
          message.reasoningTitle ||
          message.reasoningContent,
      ) ?? null
    );
  }, [activeReasoningMessageId, messages]);

  const activeReasoningAttachments = React.useMemo(() => {
    if (!activeReasoningMessageId) {
      return [];
    }

    return getReasoningSourceAttachments(messages, activeReasoningMessageId);
  }, [activeReasoningMessageId, messages]);

  const isReasoningPanelOpen = Boolean(activeReasoningMessage);

  React.useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('ai-chat:streaming-changed', {
        detail: { isStreaming },
      }),
    );
  }, [isStreaming]);

  const setVisibleMessages = React.useCallback((nextMessages: ChatMessage[]) => {
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
  }, []);

  function storeSelectedConversationId(conversationId: string | null) {
    try {
      if (conversationId) {
        window.localStorage.setItem(SELECTED_CONVERSATION_STORAGE_KEY, conversationId);
      } else {
        window.localStorage.removeItem(SELECTED_CONVERSATION_STORAGE_KEY);
      }
    } catch {
      // Storage can be unavailable in private or restricted browser contexts.
    }
  }

  const updateGenerationState = React.useCallback((state: GenerationState) => {
    generationStateRef.current = state;
  }, []);

  const abortActiveRequest = React.useCallback(() => {
    requestRef.current?.abort();
  }, []);

  const resetConversation = React.useCallback(() => {
    abortActiveRequest();
    conversationLoadControllerRef.current?.abort();
    activeRequestIdRef.current = null;
    streamingConversationIdRef.current = null;
    streamingMessagesRef.current = null;
    stoppedConversationVerificationRef.current = null;
    retryPendingRef.current = false;
    stopVoiceInput({ abort: true });
    sessionIdRef.current = null;
    selectedConversationIdRef.current = null;
    setSelectedConversationId(null);
    storeSelectedConversationId(null);
    window.dispatchEvent(
      new CustomEvent('ai-chat:selected-conversation-changed', {
        detail: { id: null },
      }),
    );
    setVisibleMessages(INITIAL_MESSAGES);
    setInput('');
    setAttachments([]);
    clearVoiceTranscript();
    setIsStreaming(false);
    setActiveReasoningMessageId(null);
    updateGenerationState(IDLE_GENERATION_STATE);
  }, [
    abortActiveRequest,
    clearVoiceTranscript,
    setVisibleMessages,
    stopVoiceInput,
    updateGenerationState,
  ]);

  React.useEffect(() => {
    function handleNewConversation() {
      resetConversation();
    }

    window.addEventListener('ai-chat:new-conversation', handleNewConversation);

    return () => {
      window.removeEventListener('ai-chat:new-conversation', handleNewConversation);
    };
  }, [resetConversation]);

  React.useEffect(() => {
    return () => {
      abortActiveRequest();
      conversationLoadControllerRef.current?.abort();
      stopVoiceInput({ abort: true });
    };
  }, [abortActiveRequest, stopVoiceInput]);

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

  function applyGenerationSnapshot(
    conversationId: string,
    snapshot: AiChatGenerationSnapshot,
    baseMessages = messagesRef.current,
    preferredAssistantMessageId?: string,
  ) {
    const merged = mergeGenerationSnapshotMessages(
      baseMessages,
      snapshot,
      preferredAssistantMessageId,
    );

    updateGenerationState({
      generationId: snapshot.generation_id,
      conversationId,
      status: snapshot.status,
      reasoningContent: snapshot.reasoning_content,
      content: snapshot.content,
      error: snapshot.error,
    });
    streamingConversationIdRef.current = conversationId;
    streamingMessagesRef.current = merged.messages;

    if (selectedConversationIdRef.current === conversationId) {
      setVisibleMessages(merged.messages);
    }

    return merged.assistantMessageId;
  }

  function finishGenerationRequest(requestId: string) {
    if (activeRequestIdRef.current !== requestId) {
      return;
    }

    activeRequestIdRef.current = null;
    requestRef.current = null;
    setIsStreaming(false);
    refreshSidebarConversations();
  }

  function handleRecoveredGenerationFailure(
    conversationId: string,
    assistantMessageId: string,
    errorMessage: string,
  ) {
    toast.error(errorMessage);
    updateAssistantMessageForConversation(conversationId, assistantMessageId, (message) => ({
      ...message,
      generationStatus: 'failed',
      status: 'error',
      errorMessage,
    }));
    updateGenerationState({
      ...generationStateRef.current,
      status: 'failed',
      error: errorMessage,
    });
  }

  async function recoverGenerationById({
    accessToken,
    conversationId,
    generationId,
    assistantMessageId,
    requestId,
  }: {
    accessToken: string;
    conversationId: string;
    generationId: string;
    assistantMessageId: string;
    requestId: string;
  }) {
    try {
      const snapshot = await getAiChatGeneration(accessToken, generationId);

      if (
        activeRequestIdRef.current !== requestId ||
        selectedConversationIdRef.current !== conversationId
      ) {
        return;
      }

      const nextAssistantMessageId = applyGenerationSnapshot(conversationId, snapshot);

      if (snapshot.title) {
        publishConversationTitle({ id: conversationId, title: snapshot.title });
      }

      if (isActiveGenerationStatus(snapshot.status)) {
        subscribeToGeneration({
          accessToken,
          conversationId,
          snapshot,
          assistantMessageId: nextAssistantMessageId || assistantMessageId,
        });
        return;
      }

      if (snapshot.status === 'failed') {
        handleRecoveredGenerationFailure(
          conversationId,
          nextAssistantMessageId || assistantMessageId,
          snapshot.error || '生成失败。',
        );
      }

      finishGenerationRequest(requestId);
    } catch (error) {
      if (activeRequestIdRef.current !== requestId) {
        return;
      }

      finishGenerationRequest(requestId);
      toast.error(
        error instanceof Error && error.message
          ? `生成连接已中断，恢复状态查询失败：${error.message}`
          : '生成连接已中断，恢复状态查询失败。',
      );
    }
  }

  function subscribeToGeneration({
    accessToken,
    conversationId,
    snapshot,
    assistantMessageId,
  }: {
    accessToken: string;
    conversationId: string;
    snapshot: AiChatGenerationSnapshot;
    assistantMessageId: string;
  }) {
    abortActiveRequest();

    const requestId = createMessageId('request');
    let reasoningContent = snapshot.reasoning_content;
    let content = snapshot.content;

    activeRequestIdRef.current = requestId;
    streamingConversationIdRef.current = conversationId;
    setIsStreaming(true);

    const request = createAiChatGenerationStreamRequest(
      accessToken,
      snapshot.generation_id,
      {
        reasoningOffset: reasoningContent.length,
        contentOffset: content.length,
      },
      {
        onUpdate: (chunk) => {
          if (
            activeRequestIdRef.current !== requestId ||
            selectedConversationIdRef.current !== conversationId
          ) {
            return;
          }

          const event = parseAiChatStreamChunk(chunk);

          if (event.type === 'status' && event.status) {
            updateGenerationState({
              ...generationStateRef.current,
              status: event.status,
            });
            updateAssistantMessageForConversation(
              conversationId,
              assistantMessageId,
              (message) => ({
                ...message,
                generationStatus: event.status ?? message.generationStatus,
                status: event.status ? getChatStatusFromGeneration(event.status) : message.status,
              }),
            );
            return;
          }

          if (event.type === 'title') {
            const title = event.title?.trim();

            if (title) {
              publishConversationTitle({ id: conversationId, title });
              refreshSidebarConversations({
                preserveConversation: { id: conversationId, title },
              });
            }
            return;
          }

          if (event.type === 'reasoning' && event.content) {
            reasoningContent += event.content;
            updateGenerationState({
              ...generationStateRef.current,
              reasoningContent,
            });
            updateAssistantMessageForConversation(
              conversationId,
              assistantMessageId,
              (message) => ({
                ...message,
                reasoning: reasoningContent,
                reasoningContent,
              }),
            );
            return;
          }

          if (event.type === 'delta' && event.content) {
            content += event.content;
            updateGenerationState({
              ...generationStateRef.current,
              content,
            });
            updateAssistantMessageForConversation(
              conversationId,
              assistantMessageId,
              (message) => ({
                ...message,
                content,
                generationStatus: 'answering',
                status: 'streaming',
              }),
            );
            return;
          }

          if (event.type === 'done') {
            content = event.message || content;
            reasoningContent = event.reasoningContent ?? event.reasoning ?? reasoningContent;
            updateGenerationState({
              generationId: snapshot.generation_id,
              conversationId,
              status: 'completed',
              reasoningContent,
              content,
              error: null,
            });
            updateAssistantMessageForConversation(
              conversationId,
              assistantMessageId,
              (message) => ({
                ...message,
                content,
                reasoning: reasoningContent || message.reasoning,
                reasoningContent: reasoningContent || message.reasoningContent,
                generationStatus: 'completed',
                errorMessage: undefined,
                status: 'done',
              }),
            );
            finishGenerationRequest(requestId);
            return;
          }

          if (event.type === 'error') {
            const errorMessage = event.errorMessage || '生成失败。';

            handleRecoveredGenerationFailure(conversationId, assistantMessageId, errorMessage);
            finishGenerationRequest(requestId);
          }
        },
        onSuccess: () => {
          if (activeRequestIdRef.current !== requestId) {
            return;
          }

          void recoverGenerationById({
            accessToken,
            conversationId,
            generationId: snapshot.generation_id,
            assistantMessageId,
            requestId,
          });
        },
        onError: (error) => {
          if (activeRequestIdRef.current !== requestId) {
            return;
          }

          if (error.name === 'AbortError') {
            return;
          }

          requestRef.current = null;
          void recoverGenerationById({
            accessToken,
            conversationId,
            generationId: snapshot.generation_id,
            assistantMessageId,
            requestId,
          });
        },
      },
    );

    requestRef.current = request;
  }

  async function handleStop() {
    const request = requestRef.current;

    if (!activeRequestIdRef.current || !request) {
      return;
    }

    const generationState = generationStateRef.current;
    const conversationId = generationState.conversationId ?? streamingConversationIdRef.current;
    const activeMessages = streamingMessagesRef.current ?? messagesRef.current;
    const assistantMessage = activeMessages.findLast(
      (message) => message.role === 'assistant' && message.status === 'streaming',
    );
    const accessToken = generationState.generationId ? getActiveAccessToken() : null;
    const cancellation =
      accessToken && generationState.generationId
        ? cancelAiChatGeneration(accessToken, generationState.generationId)
        : null;

    activeRequestIdRef.current = null;
    requestRef.current = null;
    request.abort();
    setIsStreaming(false);
    updateGenerationState({
      ...generationState,
      status: generationState.generationId ? 'cancelled' : 'idle',
      error: null,
    });

    if (assistantMessage) {
      updateAssistantMessageForConversation(
        conversationId,
        assistantMessage.id,
        markGenerationMessageStopped,
      );
    }

    if (!cancellation) {
      refreshSidebarConversations();
      return;
    }

    try {
      const snapshot = await cancellation;
      const snapshotConversationId = conversationId ?? snapshot.session_id;

      applyGenerationSnapshot(
        snapshotConversationId,
        snapshot,
        streamingMessagesRef.current ?? messagesRef.current,
        assistantMessage?.id,
      );
      setIsStreaming(false);
      refreshSidebarConversations({
        preserveConversation: {
          id: snapshotConversationId,
          title: snapshot.title,
        },
      });
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? `停止生成失败：${error.message}`
          : '停止生成失败，请稍后重试。',
      );
    }
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

  function refreshSidebarConversations(
    options: {
      preserveConversation?: {
        id: string;
        title?: string | null;
      };
    } = {},
  ) {
    window.dispatchEvent(
      new CustomEvent('ai-chat:refresh-conversations', {
        detail: options,
      }),
    );
  }

  function discardTransientConversationSelection({
    conversationId,
    conversationIdAtStart,
  }: {
    conversationId: string | null;
    conversationIdAtStart: string | null;
  }) {
    if (conversationIdAtStart || !conversationId) {
      return;
    }

    if (sessionIdRef.current === conversationId) {
      sessionIdRef.current = null;
    }

    if (streamingConversationIdRef.current === conversationId) {
      streamingConversationIdRef.current = null;
    }

    if (selectedConversationIdRef.current === conversationId) {
      selectedConversationIdRef.current = null;
      setSelectedConversationId(null);
      storeSelectedConversationId(null);
      window.dispatchEvent(
        new CustomEvent('ai-chat:selected-conversation-changed', {
          detail: { id: null },
        }),
      );
    }

    refreshSidebarConversations();
  }

  function markSelectedConversation({ id, title }: { id: string; title?: string | null }) {
    selectedConversationIdRef.current = id;
    setSelectedConversationId(id);
    storeSelectedConversationId(id);
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

  async function loadConversation(
    conversation: { id: string; title?: string | null },
    options: { isInitialRestore?: boolean } = {},
  ) {
    if (streamingConversationIdRef.current === conversation.id && streamingMessagesRef.current) {
      selectActiveConversation(conversation);
      followLatestMessage();
      setVisibleMessages(streamingMessagesRef.current);
      setAttachments([]);
      setInput('');
      return;
    }

    const accessToken = getActiveAccessToken();

    if (!accessToken) {
      if (options.isInitialRestore) {
        setIsConversationLoading(false);
      }
      return;
    }

    abortActiveRequest();
    activeRequestIdRef.current = null;
    requestRef.current = null;
    streamingConversationIdRef.current = null;
    streamingMessagesRef.current = null;
    setIsStreaming(false);
    updateGenerationState(IDLE_GENERATION_STATE);
    conversationLoadControllerRef.current?.abort();
    const loadController = new AbortController();

    conversationLoadControllerRef.current = loadController;
    markSelectedConversation(conversation);
    setIsConversationLoading(true);

    try {
      const detail = await getAiChatConversation(
        accessToken,
        conversation.id,
        loadController.signal,
      );

      if (loadController.signal.aborted || selectedConversationIdRef.current !== conversation.id) {
        return;
      }

      showLoadedConversationFromTop();
      selectActiveConversation({
        id: detail.id,
        sessionId: detail.session_id,
        title: detail.title,
      });
      const persistedMessages = mapConversationMessages(detail);

      setVisibleMessages(persistedMessages);
      stoppedConversationVerificationRef.current = null;
      setAttachments([]);
      setInput('');

      try {
        const snapshot = await getAiChatConversationGeneration(
          accessToken,
          conversation.id,
          loadController.signal,
        );

        if (
          loadController.signal.aborted ||
          selectedConversationIdRef.current !== conversation.id
        ) {
          return;
        }

        const assistantMessageId = applyGenerationSnapshot(
          conversation.id,
          snapshot,
          persistedMessages,
        );

        if (snapshot.title) {
          publishConversationTitle({ id: conversation.id, title: snapshot.title });
        }

        if (isActiveGenerationStatus(snapshot.status)) {
          subscribeToGeneration({
            accessToken,
            conversationId: conversation.id,
            snapshot,
            assistantMessageId,
          });
        } else {
          setIsStreaming(false);
        }
      } catch (error) {
        if (!isAiChatHttpError(error, 404) && !loadController.signal.aborted) {
          toast.error(
            error instanceof Error && error.message ? error.message : '生成快照加载失败。',
          );
        }
      }
    } catch (error) {
      if (!loadController.signal.aborted) {
        if (options.isInitialRestore && isAiChatHttpError(error, 404)) {
          selectedConversationIdRef.current = null;
          sessionIdRef.current = null;
          setSelectedConversationId(null);
          storeSelectedConversationId(null);
          setVisibleMessages(INITIAL_MESSAGES);
          window.dispatchEvent(
            new CustomEvent('ai-chat:selected-conversation-changed', {
              detail: { id: null },
            }),
          );
        } else {
          toast.error(
            error instanceof Error && error.message ? error.message : '会话详情加载失败。',
          );
        }
      }
    } finally {
      if (conversationLoadControllerRef.current === loadController) {
        conversationLoadControllerRef.current = null;
        setIsConversationLoading(false);
      }
    }
  }

  loadConversationRef.current = loadConversation;

  React.useEffect(() => {
    if (!initiallySelectedConversationId) {
      return;
    }

    void loadConversationRef.current?.(
      {
        id: initiallySelectedConversationId,
      },
      {
        isInitialRestore: true,
      },
    );
  }, [initiallySelectedConversationId]);

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
    startAssistantStream({
      accessToken,
      assistantMessageId,
      conversationIdAtStart,
      mode,
      prompt,
      requestFiles,
      activeRequestIdRef,
      messagesRef,
      requestRef,
      sessionIdRef,
      streamingConversationIdRef,
      streamingMessagesRef,
      onStreamingChange: setIsStreaming,
      updateStreamingConversationId,
      publishConversationTitle,
      updateAssistantMessage: updateAssistantMessageForConversation,
      discardTransientConversationSelection,
      refreshSidebarConversations,
      onGenerationChange: updateGenerationState,
      onGenerationInterrupted: (generationId, conversationId, assistantMessageId) => {
        if (!conversationId) {
          setIsStreaming(false);
          return;
        }

        const requestId = activeRequestIdRef.current;

        if (!requestId) {
          return;
        }

        void recoverGenerationById({
          accessToken,
          conversationId,
          generationId,
          assistantMessageId,
          requestId,
        });
      },
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

  async function handleRetryAssistantMessage(assistantMessageId: string) {
    if (retryPendingRef.current) {
      toast.info('正在同步已停止的会话，请稍候。');
      return;
    }

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

    const assistantMessage = messages[assistantIndex];
    const selectedConversationId = selectedConversationIdRef.current;
    const stoppedVerification = stoppedConversationVerificationRef.current;

    if (assistantMessage?.status === 'stopped' && selectedConversationId) {
      retryPendingRef.current = true;

      try {
        let persistedConversation: AiChatConversationDetail | null = null;

        if (stoppedVerification?.conversationId === selectedConversationId) {
          persistedConversation = await stoppedVerification.verification;
        } else {
          try {
            persistedConversation = await getAiChatConversation(
              accessToken,
              selectedConversationId,
            );
          } catch {
            persistedConversation = null;
          }
        }

        if (!persistedConversation) {
          stoppedConversationVerificationRef.current = null;
          toast.info('会话仍在保存，请稍后再试。');
          return;
        }

        sessionIdRef.current = persistedConversation.session_id;
      } finally {
        retryPendingRef.current = false;
      }
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

    followLatestMessage();
    setVisibleMessages(
      messages.map((message) =>
        message.id === assistantMessageId
          ? {
              ...message,
              content: '',
              reasoningTitle: undefined,
              reasoningContent: undefined,
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
    stoppedConversationVerificationRef.current = null;
  }

  function handleFilesSelected(selectedFiles: File[]) {
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
  }

  function removeAttachment(id: string) {
    setAttachments((current) => current.filter((attachment) => attachment.id !== id));
  }

  function handleChatModeChange(nextMode: ChatMode) {
    setChatMode(nextMode);
  }

  function handleOpenAssistantReasoning(messageId: string) {
    setActiveReasoningMessageId((current) => (current === messageId ? null : messageId));
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

    followLatestMessage();
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

  return (
    <div
      className={cn(
        'box-border flex h-full min-h-0 flex-1 flex-col overflow-hidden',
        isNewConversation ? 'bg-background' : 'bg-muted/20',
      )}
    >
      <div
        className={cn(
          'grid min-h-0 flex-1 overflow-hidden bg-background transition-[grid-template-columns] duration-300 ease-out',
          isReasoningPanelOpen
            ? 'grid-cols-[minmax(0,1fr)_24rem]'
            : 'grid-cols-[minmax(0,1fr)_0rem]',
        )}
      >
        <div
          className={cn(
            'grid min-h-0 overflow-hidden bg-background py-[8px]',
            isNewConversation ? 'grid-rows-[minmax(0,1fr)]' : 'grid-rows-[minmax(0,1fr)_auto]',
          )}
        >
          <div className="min-h-0 overflow-hidden bg-background p-0">
            {isNewConversation ? (
              <div className="flex h-full min-h-0 items-center justify-center px-6 pb-28">
                <div className="flex w-full max-w-[49.5rem] flex-col items-center gap-7">
                  <h1 className="text-center text-[2rem] leading-tight font-semibold text-foreground">
                    我们该从哪里开始?
                  </h1>
                  <PromptComposer
                    variant="center"
                    input={input}
                    attachments={attachments}
                    chatMode={chatMode}
                    isStreaming={isStreaming}
                    isVoiceInputActive={isVoiceInputActive}
                    voiceTranscript={voiceTranscript}
                    voiceLevels={voiceLevels}
                    onInputChange={setInput}
                    onSubmit={handleSubmit}
                    onFilesSelected={handleFilesSelected}
                    onRemoveAttachment={removeAttachment}
                    onChatModeChange={handleChatModeChange}
                    onStop={handleStop}
                    onVoiceInputToggle={toggleVoiceInput}
                    onVoiceInputCancel={cancelVoiceInput}
                    onVoiceInputConfirm={confirmVoiceInput}
                  />
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
                  <ConversationLoadingSkeleton />
                ) : (
                  messages.map((message, index) => (
                    <ChatMessageView
                      key={message.id}
                      message={message}
                      canRetry={messages.slice(0, index).some((item) => item.role === 'user')}
                      isReasoningActive={activeReasoningMessageId === message.id}
                      onCopyAssistant={handleCopyAssistantMessage}
                      onOpenAssistantReasoning={handleOpenAssistantReasoning}
                      onRetryAssistant={handleRetryAssistantMessage}
                      onStopAssistant={handleStop}
                    />
                  ))
                )}
              </div>
            )}
          </div>
          {!isNewConversation ? (
            <div className="sticky bottom-0 z-10 shrink-0 bg-background px-5 py-4">
              <PromptComposer
                variant="footer"
                input={input}
                attachments={attachments}
                chatMode={chatMode}
                isStreaming={isStreaming}
                isVoiceInputActive={isVoiceInputActive}
                voiceTranscript={voiceTranscript}
                voiceLevels={voiceLevels}
                onInputChange={setInput}
                onSubmit={handleSubmit}
                onFilesSelected={handleFilesSelected}
                onRemoveAttachment={removeAttachment}
                onChatModeChange={handleChatModeChange}
                onStop={handleStop}
                onVoiceInputToggle={toggleVoiceInput}
                onVoiceInputCancel={cancelVoiceInput}
                onVoiceInputConfirm={confirmVoiceInput}
              />
            </div>
          ) : null}
        </div>
        <ThinkingActivityPanel
          message={activeReasoningMessage}
          attachments={activeReasoningAttachments}
          isOpen={isReasoningPanelOpen}
          onClose={() => setActiveReasoningMessageId(null)}
        />
      </div>
    </div>
  );
}
