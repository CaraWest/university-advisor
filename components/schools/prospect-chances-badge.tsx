import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { prospectChancesFromAthleticTier } from "@/lib/derived";

export function ProspectChancesBadge({
  athleticTier,
  className,
}: {
  athleticTier: string | null | undefined;
  className?: string;
}) {
  const level = prospectChancesFromAthleticTier(athleticTier);
  if (level == null) return null;

  if (level === "High") {
    return (
      <Badge
        className={cn(
          "border-emerald-500/40 bg-emerald-500/10 font-medium text-emerald-950 shadow-none hover:bg-emerald-500/15 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-100 dark:hover:bg-emerald-500/20",
          className,
        )}
        variant="outline"
      >
        High
      </Badge>
    );
  }

  if (level === "Medium") {
    return (
      <Badge className={cn(className)} variant="warning">
        Medium
      </Badge>
    );
  }

  return (
    <Badge className={cn(className)} variant="secondary">
      Low
    </Badge>
  );
}
