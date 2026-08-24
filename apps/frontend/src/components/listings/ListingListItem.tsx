import { Link } from "react-router-dom";
import { MapPin, Clock } from "lucide-react";
import { formatMoney, formatRelativeTime } from "@/lib/format";
import { categoryIcon } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Listing } from "@/types/api";

const NEW_THRESHOLD_MS = 48 * 60 * 60 * 1000;

const STATUS_VARIANT: Record<Listing["status"], "secondary" | "outline"> = {
  open: "secondary",
  closed: "outline",
  completed: "outline",
};

export function isNewListing(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < NEW_THRESHOLD_MS;
}

export function ListingListItem({
  listing,
  selected,
  onClick,
}: {
  listing: Listing;
  selected?: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const Icon = categoryIcon(listing.category);
  const budget = formatMoney(listing.budget);
  const offerCount = listing._count?.bids ?? listing.bids?.length ?? 0;

  return (
    <Link
      to={`/listings/${listing.id}`}
      onClick={onClick}
      className={cn(
        "block rounded-xl border bg-card p-4 transition-colors hover:border-primary/50",
        selected && "border-primary ring-1 ring-primary",
      )}
    >
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-medium leading-snug">{listing.title}</h3>
            <div className="flex shrink-0 items-center gap-1.5">
              {listing.status === "open" && isNewListing(listing.createdAt) && (
                <span className="rounded-full bg-highlight px-2 py-0.5 text-[10px] font-semibold text-highlight-foreground">
                  NEW
                </span>
              )}
              <Badge variant={STATUS_VARIANT[listing.status]} className="text-[10px] capitalize">
                {listing.status}
              </Badge>
            </div>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {listing.location}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {formatRelativeTime(listing.createdAt)}
            </span>
          </div>
          <p className="mt-2 hidden line-clamp-2 text-sm text-muted-foreground sm:block">{listing.description}</p>
          <div className="mt-2 flex items-center justify-between">
            {budget && <span className="font-semibold text-primary">{budget}</span>}
            <span className="text-xs text-muted-foreground">
              {offerCount} {offerCount === 1 ? "offer" : "offers"}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
