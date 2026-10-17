import { cn } from "@/lib/utils";

/**
 * Placeholder shown while a lazily-loaded chart chunk downloads.
 *
 * It mirrors the chart's height so the surrounding layout does not jump when the
 * real chart swaps in.
 */
export function ChartSkeleton({
  height = 240,
  className,
}: {
  height?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn("bg-muted/50 w-full animate-pulse rounded-lg", className)}
      style={{ height }}
    />
  );
}
