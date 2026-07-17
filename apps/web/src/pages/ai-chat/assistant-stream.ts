import { toast } from 'sonner';

import {
  AI_CHAT_THINKING_MAX_TOKENS,
  type AiChatAbortableRequest,
  type AiChatGenerationStatus,
  createAiChatStreamRequest,
  getAiChatFriendlyErrorMessage,
  parseAiChatStreamChunk,
} from '@/service/ai-chat';

import type { ChatMessage, ChatMode, ChatRequestFile, GenerationState } from './types';
import { createMessageId } from './utils';

type MutableRef<T> = {
  current: T;
};

type AssistantMessageUpdater = (
  conversationId: string | null,
  messageId: string,
  updater: (message: ChatMessage) => ChatMessage,
) => void;

const NEW_CONVERSATION_TITLE = '新聊天';

export function startAssistantStream({
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
  onStreamingChange,
  updateStreamingConversationId,
  publishConversationTitle,
  updateAssistantMessage,
  discardTransientConversationSelection,
  refreshSidebarConversations,
  onGenerationChange,
  onGenerationInterrupted,
}: {
  accessToken: string;
  assistantMessageId: string;
  conversationIdAtStart: string | null;
  mode: ChatMode;
  prompt: string;
  requestFiles: ChatRequestFile[];
  activeRequestIdRef: MutableRef<string | null>;
  messagesRef: MutableRef<ChatMessage[]>;
  requestRef: MutableRef<AiChatAbortableRequest | null>;
  sessionIdRef: MutableRef<string | null>;
  streamingConversationIdRef: MutableRef<string | null>;
  streamingMessagesRef: MutableRef<ChatMessage[] | null>;
  onStreamingChange: (isStreaming: boolean) => void;
  updateStreamingConversationId: (conversationId: string, title?: string | null) => void;
  publishConversationTitle: (conversation: { id: string; title: string }) => void;
  updateAssistantMessage: AssistantMessageUpdater;
  discardTransientConversationSelection: (conversation: {
    conversationId: string | null;
    conversationIdAtStart: string | null;
  }) => void;
  refreshSidebarConversations: (options?: {
    preserveConversation?: {
      id: string;
      title?: string | null;
    };
  }) => void;
  onGenerationChange: (state: GenerationState) => void;
  onGenerationInterrupted: (
    generationId: string,
    conversationId: string,
    assistantMessageId: string,
  ) => void;
}) {
  const shouldShowReasoning = mode !== 'fast';
  const requestId = createMessageId('request');
  let requestConversationId = conversationIdAtStart;
  let streamedContent = '';
  let streamedReasoning = '';
  let streamedReasoningTitle: string | undefined;
  let streamedReasoningContent: string | undefined;
  let streamedConversationTitle: string | null = null;
  let publishedPendingConversationId: string | null = null;
  let streamCompleted = false;
  let streamFailed = false;
  let generationId: string | null = null;
  let generationStatus: AiChatGenerationStatus = 'queued';

  function publishGenerationState(error: string | null = null) {
    onGenerationChange({
      generationId,
      conversationId: requestConversationId,
      status: generationId ? generationStatus : 'idle',
      reasoningContent: streamedReasoningContent ?? streamedReasoning,
      content: streamedContent,
      error,
    });
  }

  function updateGenerationStatus(status: AiChatGenerationStatus) {
    generationStatus = status;
    publishGenerationState(status === 'failed' ? 'AI 服务返回错误。' : null);
    updateAssistantMessage(requestConversationId, assistantMessageId, (message) => ({
      ...message,
      generationStatus: status,
      status:
        status === 'completed'
          ? 'done'
          : status === 'cancelled'
            ? 'stopped'
            : status === 'failed'
              ? 'error'
              : 'streaming',
    }));
  }

  activeRequestIdRef.current = requestId;
  streamingConversationIdRef.current = requestConversationId;
  streamingMessagesRef.current = messagesRef.current;
  onStreamingChange(true);

  const request = createAiChatStreamRequest(accessToken, {
    onUpdate: (chunk) => {
      if (activeRequestIdRef.current !== requestId) {
        return;
      }

      const event = parseAiChatStreamChunk(chunk);

      if (event.generationId) {
        generationId = event.generationId;
      }

      if (event.sessionId) {
        requestConversationId = event.sessionId;
        updateStreamingConversationId(event.sessionId);

        if (!conversationIdAtStart && publishedPendingConversationId !== event.sessionId) {
          publishedPendingConversationId = event.sessionId;
          publishConversationTitle({
            id: event.sessionId,
            title: NEW_CONVERSATION_TITLE,
          });
        }
      }

      if (event.type === 'generation') {
        generationStatus = 'queued';
        publishGenerationState();
        updateGenerationStatus('queued');
        refreshSidebarConversations({
          preserveConversation: requestConversationId
            ? {
                id: requestConversationId,
                title: NEW_CONVERSATION_TITLE,
              }
            : undefined,
        });
        return;
      }

      if (event.type === 'session') {
        return;
      }

      if (event.type === 'status') {
        if (event.status) {
          updateGenerationStatus(event.status);
        }
        return;
      }

      if (event.type === 'title') {
        const title = event.title?.trim();
        const conversationId = event.sessionId?.trim() || requestConversationId;

        if (title && conversationId) {
          requestConversationId = conversationId;
          streamedConversationTitle = title;
          updateStreamingConversationId(conversationId);
          publishConversationTitle({
            id: conversationId,
            title,
          });
          refreshSidebarConversations({
            preserveConversation: {
              id: conversationId,
              title,
            },
          });
        }

        return;
      }

      if (event.type === 'reasoning') {
        if (!shouldShowReasoning) {
          return;
        }

        if (!event.content && !event.reasoningTitle && event.reasoningContent === null) {
          return;
        }

        if (event.content) {
          streamedReasoning += event.content;
        }

        if (event.reasoningTitle) {
          streamedReasoningTitle = event.reasoningTitle;
        }

        if (event.reasoningContent !== null) {
          streamedReasoningContent = event.reasoningContent;
        } else if (event.content) {
          streamedReasoningContent = streamedReasoning;
        }

        updateAssistantMessage(requestConversationId, assistantMessageId, (message) => ({
          ...message,
          reasoningTitle: streamedReasoningTitle,
          reasoningContent: streamedReasoningContent,
          reasoning: streamedReasoning || undefined,
        }));
        publishGenerationState();
        return;
      }

      if (event.type === 'delta') {
        if (!event.content) {
          return;
        }

        streamedContent += event.content;
        updateAssistantMessage(requestConversationId, assistantMessageId, (message) => ({
          ...message,
          content: streamedContent,
        }));
        publishGenerationState();
        return;
      }

      if (event.type === 'done') {
        streamCompleted = true;
        streamedContent = event.message || streamedContent;
        streamedReasoning = shouldShowReasoning ? (event.reasoning ?? streamedReasoning) : '';
        streamedReasoningTitle = shouldShowReasoning
          ? (event.reasoningTitle ?? streamedReasoningTitle)
          : undefined;
        streamedReasoningContent = shouldShowReasoning
          ? (event.reasoningContent ?? streamedReasoningContent)
          : undefined;
        updateAssistantMessage(requestConversationId, assistantMessageId, (message) => ({
          ...message,
          content: streamedContent,
          reasoningTitle: streamedReasoningTitle,
          reasoningContent: streamedReasoningContent ?? (streamedReasoning || undefined),
          reasoning: streamedReasoning || undefined,
          status: 'done',
          generationStatus: 'completed',
          errorMessage: undefined,
        }));
        generationStatus = 'completed';
        publishGenerationState();
        return;
      }

      if (event.type === 'error') {
        const streamErrorMessage = event.errorMessage || 'AI 服务返回错误。';

        streamFailed = true;
        generationStatus = 'failed';
        activeRequestIdRef.current = null;
        requestRef.current = null;
        onStreamingChange(false);
        toast.error(streamErrorMessage);
        updateAssistantMessage(requestConversationId, assistantMessageId, (message) => ({
          ...message,
          content: message.content,
          errorMessage: streamErrorMessage,
          generationStatus: 'failed',
          status: 'error',
        }));
        publishGenerationState(streamErrorMessage);
        if (!generationId) {
          discardTransientConversationSelection({
            conversationId: requestConversationId,
            conversationIdAtStart,
          });
        } else {
          refreshSidebarConversations({
            preserveConversation: requestConversationId
              ? {
                  id: requestConversationId,
                  title: streamedConversationTitle,
                }
              : undefined,
          });
        }
        return;
      }

      if (!event.content) {
        return;
      }

      streamedContent += event.content;
      updateAssistantMessage(requestConversationId, assistantMessageId, (message) => ({
        ...message,
        content: streamedContent,
      }));
    },
    onSuccess: () => {
      if (activeRequestIdRef.current !== requestId || streamFailed) {
        return;
      }

      if (generationId && !streamCompleted) {
        requestRef.current = null;
        onGenerationInterrupted(
          generationId,
          requestConversationId ?? conversationIdAtStart ?? '',
          assistantMessageId,
        );
        return;
      }

      activeRequestIdRef.current = null;
      requestRef.current = null;
      onStreamingChange(false);
      updateAssistantMessage(requestConversationId, assistantMessageId, (message) => ({
        ...message,
        content:
          message.content ||
          (message.reasoning || message.reasoningTitle || message.reasoningContent
            ? '服务没有返回正式回答，请稍后重试或关闭思考模式。'
            : '服务没有返回可展示的内容。'),
        status: 'done',
        generationStatus: generationId ? 'completed' : message.generationStatus,
      }));

      if (requestConversationId && streamedConversationTitle) {
        publishConversationTitle({
          id: requestConversationId,
          title: streamedConversationTitle,
        });
      }

      refreshSidebarConversations({
        preserveConversation:
          !conversationIdAtStart && requestConversationId
            ? {
                id: requestConversationId,
                title: streamedConversationTitle,
              }
            : undefined,
      });
    },
    onError: (error) => {
      if (activeRequestIdRef.current !== requestId) {
        return;
      }

      if (generationId && error.name !== 'AbortError') {
        requestRef.current = null;
        onGenerationInterrupted(
          generationId,
          requestConversationId ?? conversationIdAtStart ?? '',
          assistantMessageId,
        );
        return;
      }

      if (error.name === 'AbortError' && streamCompleted) {
        activeRequestIdRef.current = null;
        requestRef.current = null;
        onStreamingChange(false);

        if (requestConversationId && streamedConversationTitle) {
          publishConversationTitle({
            id: requestConversationId,
            title: streamedConversationTitle,
          });
        }

        refreshSidebarConversations({
          preserveConversation:
            !conversationIdAtStart && requestConversationId
              ? {
                  id: requestConversationId,
                  title: streamedConversationTitle,
                }
              : undefined,
        });
        return;
      }

      const isManualAbort = error.name === 'AbortError';
      const friendlyMessage = getAiChatFriendlyErrorMessage(error);

      activeRequestIdRef.current = null;
      requestRef.current = null;
      onStreamingChange(false);

      if (!isManualAbort) {
        toast.error(friendlyMessage);
      }

      if (isManualAbort) {
        return;
      }

      updateAssistantMessage(requestConversationId, assistantMessageId, (message) => ({
        ...message,
        content: friendlyMessage,
        reasoningTitle: undefined,
        reasoningContent: undefined,
        reasoning: undefined,
        status: 'error',
        errorMessage: friendlyMessage,
      }));

      discardTransientConversationSelection({
        conversationId: requestConversationId,
        conversationIdAtStart,
      });
    },
  });

  requestRef.current = request;
  request.run({
    message: prompt,
    session_id: sessionIdRef.current,
    thinking_mode: mode,
    resumable: true,
    max_tokens: mode === 'thinking' ? AI_CHAT_THINKING_MAX_TOKENS : undefined,
    files: requestFiles.length ? requestFiles : undefined,
  });
}
