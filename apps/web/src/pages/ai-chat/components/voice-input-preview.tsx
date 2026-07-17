import { CheckIcon, XIcon } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';

export function VoiceInputPreview({
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
