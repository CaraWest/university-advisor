import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function SchoolsListSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading schools">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-10 w-48 sm:ml-auto" />
      </div>
      <Card className="overflow-hidden p-0">
        <div className="divide-y">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-5 flex-1 max-w-xs" />
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-9 w-36" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
