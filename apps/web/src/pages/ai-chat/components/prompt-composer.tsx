import * as React from 'react';
import {
  ArrowUpIcon,
  AudioLinesIcon,
  ChevronDownIcon,
  FileTextIcon,
  FolderIcon,
  PlusIcon,
  SquareIcon,
} from 'lucide-react';

import { AttachmentGroup } from '@workspace/ui/components/attachment';
import { Button } from '@workspace/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu';
import { Field, FieldGroup, FieldLabel } from '@workspace/ui/components/field';
import { Textarea } from '@workspace/ui/components/textarea';
import { cn } from '@workspace/ui/lib/utils';

import { CHAT_MODE_OPTIONS } from '../constants';
import type { ChatMode, PendingAttachment } from '../types';
import { PendingAttachmentCard } from './chat-attachments';
import { VoiceInputPreview } from './voice-input-preview';

const DIRECTORY_INPUT_PROPS = {
  directory: '',
  webkitdirectory: '',
} as React.InputHTMLAttributes<HTMLInputElement>;

export function PromptComposer({
  variant,
  input,
  attachments,
  chatMode,
  isStreaming,
  isVoiceInputActive,
  voiceTranscript,
  voiceLevels,
  onInputChange,
  onSubmit,
  onFilesSelected,
  onRemoveAttachment,
  onChatModeChange,
  onStop,
  onVoiceInputToggle,
  onVoiceInputCancel,
  onVoiceInputConfirm,
}: {
  variant: 'center' | 'footer';
  input: string;
  attachments: PendingAttachment[];
  chatMode: ChatMode;
  isStreaming: boolean;
  isVoiceInputActive: boolean;
  voiceTranscript: string;
  voiceLevels: number[];
  onInputChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onFilesSelected: (files: File[]) => void;
  onRemoveAttachment: (id: string) => void;
  onChatModeChange: (mode: ChatMode) => void;
  onStop: () => void;
  onVoiceInputToggle: () => void;
  onVoiceInputCancel: () => void;
  onVoiceInputConfirm: () => void;
}) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const directoryInputRef = React.useRef<HTMLInputElement | null>(null);
  const isCentered = variant === 'center';
  const hasPrompt = Boolean(input.trim() || attachments.length);
  const inputId = isCentered ? 'ai-chat-input-empty' : 'ai-chat-input';
  const selectedModeLabel =
    CHAT_MODE_OPTIONS.find((option) => option.value === chatMode)?.label ?? '思考';

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.currentTarget.files ?? []);

    if (selectedFiles.length) {
      onFilesSelected(selectedFiles);
    }

    event.currentTarget.value = '';
  }

  return (
    <form
      className={cn(isCentered ? 'w-full' : 'mx-auto flex w-full max-w-[49.5rem] flex-col gap-2')}
      onSubmit={onSubmit}
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
              <AttachmentGroup className="max-w-full gap-2 pb-1 pr-1">
                {attachments.map((attachment) => (
                  <PendingAttachmentCard
                    key={attachment.id}
                    attachment={attachment}
                    onRemove={onRemoveAttachment}
                  />
                ))}
              </AttachmentGroup>
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
                {...DIRECTORY_INPUT_PROPS}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    aria-label="添加附件"
                    title="添加附件"
                    className="size-9 shrink-0 rounded-full bg-background text-foreground hover:bg-background"
                    disabled={isStreaming}
                  >
                    <PlusIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side={isCentered ? 'bottom' : 'top'}
                  sideOffset={8}
                  className="w-60"
                >
                  <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
                      <FileTextIcon />
                      <span>文件</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => directoryInputRef.current?.click()}>
                      <FolderIcon />
                      <span>文件夹</span>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              {isVoiceInputActive ? (
                <VoiceInputPreview
                  transcript={voiceTranscript}
                  levels={voiceLevels}
                  onCancel={onVoiceInputCancel}
                  onConfirm={onVoiceInputConfirm}
                />
              ) : (
                <>
                  <Textarea
                    id={inputId}
                    rows={1}
                    value={input}
                    onChange={(event) => onInputChange(event.target.value)}
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="group flex h-9 items-center gap-1.5 rounded-full px-2 text-xs text-foreground/75 transition-colors outline-none hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50"
                          disabled={isStreaming}
                        >
                          <span>{selectedModeLabel}</span>
                          <ChevronDownIcon className="size-3 text-muted-foreground/75 transition-transform group-data-[state=open]:rotate-180" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        side={isCentered ? 'bottom' : 'top'}
                        sideOffset={8}
                        className="w-60"
                      >
                        <DropdownMenuRadioGroup
                          value={chatMode}
                          onValueChange={(value) => onChatModeChange(value as ChatMode)}
                        >
                          {CHAT_MODE_OPTIONS.map((option) => (
                            <DropdownMenuRadioItem key={option.value} value={option.value}>
                              {option.label}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      type={isStreaming || !hasPrompt ? 'button' : 'submit'}
                      size="icon-lg"
                      aria-label={isStreaming ? '停止生成' : hasPrompt ? '发送' : '语音输入'}
                      title={isStreaming ? '停止生成' : hasPrompt ? '发送' : '语音输入'}
                      className="size-9 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/80"
                      onClick={isStreaming ? onStop : hasPrompt ? undefined : onVoiceInputToggle}
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
