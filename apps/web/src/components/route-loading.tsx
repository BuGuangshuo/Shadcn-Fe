import { Skeleton } from "@workspace/ui/components/skeleton"

export function RouteLoading() {
  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
