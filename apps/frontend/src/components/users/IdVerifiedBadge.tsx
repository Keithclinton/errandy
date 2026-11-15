import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shown next to someone whose ID an admin has checked. */
export function IdVerifiedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-primary",
        className,
      )}
    >
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
      ID verified
    </span>
  );
}
