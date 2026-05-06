import { Skeleton } from "@/components/ui/skeleton";

interface PageSkeletonProps {
  variant?:
  | "list"
  | "issues-list"
  | "detail"
  | "dashboard"
  | "approvals"
  | "costs"
  | "inbox"
  | "org-chart";
}

/**
 * Skeleton loading states for each page variant.
 * Renders shimmer placeholders while data is loading.
 */
export function PageSkeleton({ variant = "list" }: PageSkeletonProps) {
  switch (variant) {
    case "dashboard":
      return (
        <div className="space-y-5 animate-in fade-in duration-300">
          <Skeleton className="h-28 w-full rounded-lg border border-border" />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-lg" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-64 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        </div>
      );

    case "approvals":
      return (
        <div className="space-y-4 animate-in fade-in duration-300">
          <Skeleton className="h-9 w-40" />
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        </div>
      );

    case "costs":
      return (
        <div className="space-y-5 animate-in fade-in duration-300">
          <div className="flex flex-wrap items-center gap-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-9 w-24 rounded-md" />
            ))}
          </div>
          <Skeleton className="h-36 w-full rounded-lg" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-64 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        </div>
      );

    case "inbox":
      return (
        <div className="space-y-5 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-8 w-36" />
          </div>
          {[...Array(3)].map((_, section) => (
            <div key={section} className="space-y-2">
              <Skeleton className="h-4 w-36 rounded" />
              <div className="space-y-px rounded-lg border border-border overflow-hidden">
                {[...Array(3)].map((_, row) => (
                  <Skeleton key={row} className="h-14 w-full rounded-none" />
                ))}
              </div>
            </div>
          ))}
        </div>
      );

    case "org-chart":
      return (
        <div className="animate-in fade-in duration-300">
          <Skeleton className="h-[calc(100vh-5rem)] w-full rounded-xl border border-border" />
        </div>
      );

    case "detail":
      return (
        <div className="space-y-5 animate-in fade-in duration-300">
          <div className="space-y-2.5">
            <Skeleton className="h-3 w-56" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded" />
              <Skeleton className="h-6 w-6 rounded" />
              <Skeleton className="h-7 w-44" />
            </div>
            <Skeleton className="h-4 w-36" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-28 w-full rounded-lg" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        </div>
      );

    case "issues-list":
      return (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-9 w-56" />
            <div className="flex items-center gap-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-16 rounded-md" />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-36 rounded" />
            <div className="rounded-lg border border-border overflow-hidden">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-11 w-full rounded-none" />
              ))}
            </div>
          </div>
        </div>
      );

    default:
      return (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-9 w-40" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            {[...Array(7)].map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-none" />
            ))}
          </div>
        </div>
      );
  }
}
