import * as React from 'react';
import {
  BotIcon,
  ChevronDownIcon,
  CopyIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
  SquareIcon,
} from 'lucide-react';

import { Marker, MarkerContent, MarkerIcon } from '@workspace/ui/components/marker';
import { cn } from '@workspace/ui/lib/utils';
import { MarkdownContent } from '@/components/markdown-content';

import type { ChatMessage } from '../types';
import { getReasoningStatusLabel } from '../utils';
import { AttachmentList } from './chat-attachments';

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

function ThinkingSummaryButton({
  message,
  isActive,
  onOpen,
}: {
  message: ChatMessage;
  isActive: boolean;
  onOpen: (messageId: string) => void;
}) {
  const statusLabel = getReasoningStatusLabel(message);

  return (
    <Marker
      asChild
      className={cn(
        'w-fit rounded-full px-0 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30',
        isActive && 'text-foreground',
      )}
    >
      <button
        type="button"
        aria-expanded={isActive}
        aria-label={`${statusLabel}，打开思考活动`}
        onClick={() => onOpen(message.id)}
      >
        <MarkerContent className={cn(message.status === 'streaming' && 'shimmer')}>
          {statusLabel}
        </MarkerContent>
        <MarkerIcon className={cn('transition-transform', isActive && 'rotate-180')}>
          <ChevronDownIcon />
        </MarkerIcon>
      </button>
    </Marker>
  );
}

function UserMessageBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex justify-end ps-10">
      <div className="flex w-full max-w-[min(40rem,72%)] flex-col items-end gap-3">
        {message.attachments?.length ? <AttachmentList attachments={message.attachments} /> : null}
        {message.content ? (
          <div className="max-w-[min(24rem,100%)] rounded-full bg-muted/45 px-4 py-2 text-sm leading-6 text-foreground">
            <p className="break-words whitespace-pre-wrap">{message.content}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AssistantMessageCard({
  message,
  canRetry,
  isReasoningActive,
  onCopy,
  onOpenReasoning,
  onRetry,
  onStop,
}: {
  message: ChatMessage;
  canRetry: boolean;
  isReasoningActive: boolean;
  onCopy: (message: ChatMessage) => void;
  onOpenReasoning: (messageId: string) => void;
  onRetry: (messageId: string) => void;
  onStop: () => void;
}) {
  const hasReasoning = Boolean(
    message.reasoning || message.reasoningTitle || message.reasoningContent,
  );
  const isStreaming = message.status === 'streaming';
  const isStopped = message.status === 'stopped';
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
          {hasReasoning ? (
            <ThinkingSummaryButton
              message={message}
              isActive={isReasoningActive}
              onOpen={onOpenReasoning}
            />
          ) : null}
          {hasContent ? (
            <MarkdownContent content={message.content} className={cn(hasReasoning && 'mt-3')} />
          ) : isStreaming && !hasReasoning ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <LoaderCircleIcon className="size-4 animate-spin" />
              正在思考...
            </span>
          ) : isStopped && !hasReasoning ? (
            <span className="text-muted-foreground">已停止生成</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ChatMessage({
  message,
  canRetry,
  isReasoningActive,
  onCopyAssistant,
  onOpenAssistantReasoning,
  onRetryAssistant,
  onStopAssistant,
}: {
  message: ChatMessage;
  canRetry: boolean;
  isReasoningActive: boolean;
  onCopyAssistant: (message: ChatMessage) => void;
  onOpenAssistantReasoning: (messageId: string) => void;
  onRetryAssistant: (messageId: string) => void;
  onStopAssistant: () => void;
}) {
  return message.role === 'user' ? (
    <UserMessageBubble message={message} />
  ) : (
    <AssistantMessageCard
      message={message}
      canRetry={canRetry}
      isReasoningActive={isReasoningActive}
      onCopy={onCopyAssistant}
      onOpenReasoning={onOpenAssistantReasoning}
      onRetry={onRetryAssistant}
      onStop={onStopAssistant}
    />
  );
}
