import * as React from 'react';
import { CircleCheckIcon, FileTextIcon, LoaderCircleIcon, XIcon } from 'lucide-react';

import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from '@workspace/ui/components/attachment';
import { Button } from '@workspace/ui/components/button';
import { Separator } from '@workspace/ui/components/separator';
import { cn } from '@workspace/ui/lib/utils';
import { MarkdownContent } from '@/components/markdown-content';

import type { ChatAttachment, ChatMessage } from '../types';
import { getAttachmentKind, getReasoningStatusLabel, getReasoningSteps } from '../utils';

function ReasoningMarkdownContent({ content }: { content: string }) {
  return <MarkdownContent content={content} className="mt-1 text-muted-foreground" />;
}

export function ThinkingActivityPanel({
  message,
  attachments,
  isOpen,
  onClose,
}: {
  message: ChatMessage | null;
  attachments: ChatAttachment[];
  isOpen: boolean;
  onClose: () => void;
}) {
  const steps = React.useMemo(() => getReasoningSteps(message), [message]);
  const statusLabel = message ? getReasoningStatusLabel(message) : '已思考';

  return (
    <aside
      aria-hidden={!isOpen}
      className={cn(
        'h-full min-h-0 overflow-hidden bg-background transition-[border-color,opacity,transform] duration-300 ease-out',
        isOpen
          ? 'translate-x-0 border-l opacity-100'
          : 'pointer-events-none translate-x-5 border-l border-transparent opacity-0',
      )}
    >
      <div className="flex h-full w-96 flex-col">
        <header className="flex h-[3.25rem] shrink-0 items-center justify-between gap-3 border-b px-5">
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
            <span className="truncate">活动</span>
            <span className="text-muted-foreground">·</span>
            <span className="truncate text-muted-foreground">{statusLabel}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="关闭思考活动"
            title="关闭思考活动"
            className="rounded-full"
            onClick={onClose}
          >
            <XIcon />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <section className="flex flex-col gap-4">
            <h2 className="text-base font-semibold">思考</h2>
            {steps.length ? (
              <ol className="flex flex-col">
                {steps.map((step, index) => {
                  const isLast = index === steps.length - 1;
                  const isStreamingStep = message?.status === 'streaming' && isLast;
                  const isCompletedFinalStep = message?.status !== 'streaming' && isLast;

                  return (
                    <li key={step.id} className="flex min-w-0 gap-3">
                      <div className="flex shrink-0 flex-col items-center pt-1">
                        <span
                          className={cn(
                            'flex size-4 items-center justify-center rounded-full',
                            isStreamingStep ? 'bg-muted text-muted-foreground' : 'text-foreground',
                          )}
                        >
                          {isStreamingStep ? (
                            <LoaderCircleIcon className="size-3 animate-spin" />
                          ) : isCompletedFinalStep ? (
                            <CircleCheckIcon className="size-4 text-muted-foreground" />
                          ) : (
                            <span className="size-1.5 rounded-full bg-foreground" />
                          )}
                        </span>
                        {!isLast ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
                      </div>
                      <div className="min-w-0 pb-5 text-sm leading-6">
                        <p className="font-medium text-foreground">{step.title}</p>
                        {step.body ? <ReasoningMarkdownContent content={step.body} /> : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">暂无可展示的思考内容。</p>
            )}
          </section>
          {attachments.length ? (
            <>
              <Separator className="my-5" />
              <section className="flex flex-col gap-4">
                <h2 className="text-base font-semibold">文件 · {attachments.length}</h2>
                <div className="flex flex-col gap-3">
                  {attachments.map((attachment) => (
                    <Attachment
                      key={attachment.id}
                      size="sm"
                      className="w-full border-transparent bg-transparent p-0 hover:bg-transparent"
                    >
                      <AttachmentMedia className="bg-transparent text-foreground">
                        <FileTextIcon />
                      </AttachmentMedia>
                      <AttachmentContent>
                        <AttachmentDescription className="font-mono text-[0.7rem] uppercase">
                          {getAttachmentKind(attachment)}
                        </AttachmentDescription>
                        <AttachmentTitle>{attachment.name}</AttachmentTitle>
                      </AttachmentContent>
                    </Attachment>
                  ))}
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
