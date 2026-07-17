import { Skeleton } from '@workspace/ui/components/skeleton';

function AssistantMessageSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex w-full justify-start pe-2">
      <div className="w-full max-w-[48rem] overflow-hidden rounded-[14px] border bg-card">
        <div className="flex h-11 items-center gap-2 border-b px-3">
          <Skeleton className="size-4 rounded-md" />
          <Skeleton className="h-4 w-20 rounded-md" />
        </div>
        <div className="flex flex-col gap-3 px-3 py-4">
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-[82%] rounded-md" />
          {compact ? null : <Skeleton className="h-4 w-[64%] rounded-md" />}
        </div>
      </div>
    </div>
  );
}

export function ConversationLoadingSkeleton() {
  return (
    <div role="status" aria-label="正在加载会话" className="flex w-full flex-col gap-4">
      <div className="flex justify-end ps-10">
        <Skeleton className="h-10 w-[min(24rem,72%)] rounded-full" />
      </div>
      <AssistantMessageSkeleton />
      <div className="flex justify-end ps-10">
        <Skeleton className="h-10 w-[min(18rem,64%)] rounded-full" />
      </div>
      <AssistantMessageSkeleton compact />
      <span className="sr-only">正在加载会话...</span>
    </div>
  );
}
