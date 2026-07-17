type GenerationStatus = 'queued' | 'thinking' | 'answering' | 'completed' | 'cancelled' | 'failed';
type GenerationMessageStatus = 'streaming' | 'stopped' | 'error' | 'done';

type GenerationSnapshot = {
  generation_id: string;
  prompt: string;
  status: GenerationStatus;
  reasoning_content: string;
  content: string;
  error: string | null;
};

type GenerationMessage = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  reasoningContent?: string;
  reasoning?: string;
  generationStatus?: GenerationStatus;
  errorMessage?: string;
  status?: GenerationMessageStatus;
  time: string;
};

export function isActiveGenerationStatus(status: GenerationStatus) {
  return status === 'queued' || status === 'thinking' || status === 'answering';
}

export function getChatStatusFromGeneration(status: GenerationStatus): GenerationMessageStatus {
  if (status === 'failed') {
    return 'error';
  }

  if (status === 'completed') {
    return 'done';
  }

  if (status === 'cancelled') {
    return 'stopped';
  }

  return 'streaming';
}

export function markGenerationMessageStopped<T extends GenerationMessage>(message: T): T {
  return {
    ...message,
    status: 'stopped',
  };
}

export function mergeGenerationSnapshotMessages(
  messages: GenerationMessage[],
  snapshot: GenerationSnapshot,
  preferredAssistantMessageId?: string,
) {
  const lastUserMessageIndex = messages.findLastIndex((message) => message.role === 'user');
  const assistantMessageIndex = messages.findLastIndex(
    (message, index) => message.role === 'assistant' && index > lastUserMessageIndex,
  );
  const snapshotStatus = getChatStatusFromGeneration(snapshot.status);
  const applySnapshot = (message: GenerationMessage): GenerationMessage => {
    const shouldPreserveLocalText = snapshot.status === 'cancelled';
    const reasoningContent =
      snapshot.reasoning_content ||
      (shouldPreserveLocalText ? (message.reasoningContent ?? message.reasoning ?? '') : '');

    return {
      ...message,
      content: snapshot.content || (shouldPreserveLocalText ? message.content : ''),
      reasoningContent: reasoningContent || undefined,
      reasoning: reasoningContent || undefined,
      generationStatus: snapshot.status,
      errorMessage: snapshot.error || undefined,
      status: snapshotStatus,
    };
  };

  if (assistantMessageIndex >= 0) {
    const assistantMessage = messages[assistantMessageIndex];
    const persistedReasoning =
      assistantMessage?.reasoningContent ?? assistantMessage?.reasoning ?? '';
    const snapshotHasText = Boolean(snapshot.content || snapshot.reasoning_content);
    const assistantMatchesSnapshot =
      assistantMessage?.id === preferredAssistantMessageId ||
      assistantMessage?.id === `generation-${snapshot.generation_id}` ||
      (snapshotHasText &&
        snapshot.content.startsWith(assistantMessage?.content ?? '') &&
        snapshot.reasoning_content.startsWith(persistedReasoning));

    if (assistantMessage && assistantMatchesSnapshot) {
      return {
        assistantMessageId: assistantMessage.id,
        messages: messages.map((message, index) =>
          index === assistantMessageIndex ? applySnapshot(message) : message,
        ),
      };
    }
  }

  const prompt = snapshot.prompt.trim();
  const latestMessage = messages.at(-1);
  const messagesWithPrompt =
    prompt && !(latestMessage?.role === 'user' && latestMessage.content === prompt)
      ? [
          ...messages,
          {
            id: `generation-${snapshot.generation_id}-user`,
            role: 'user' as const,
            content: prompt,
            status: 'done' as const,
            time: new Intl.DateTimeFormat('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }).format(new Date()),
          },
        ]
      : messages;
  const assistantMessage: GenerationMessage = applySnapshot({
    id: `generation-${snapshot.generation_id}`,
    role: 'assistant',
    content: '',
    status: snapshotStatus,
    time: new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date()),
  });

  return {
    assistantMessageId: assistantMessage.id,
    messages: [...messagesWithPrompt, assistantMessage],
  };
}
