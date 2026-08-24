import { Link } from "react-router-dom";
import { MapPin, Clock, BadgeCheck, Star } from "lucide-react";
import { useListing } from "@/hooks/use-listings";
import { formatMoney, formatRelativeTime, initials } from "@/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isNewListing } from "./ListingListItem";

export function ListingDetailPanel({ listingId }: { listingId: string }) {
  const { data: listing, isLoading } = useListing(listingId);

  if (isLoading || !listing) {
    return (
      <div className="space-y-4 rounded-xl border bg-card p-6">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-24" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  const budget = formatMoney(listing.budget);
  const offerCount = listing.bids?.length ?? 0;
  const isOpen = listing.status === "open";

  return (
    <div className="space-y-6 rounded-xl border bg-card p-6">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            {isNewListing(listing.createdAt) && (
              <span className="mb-1 inline-block rounded-full bg-highlight px-2 py-0.5 text-[10px] font-semibold text-highlight-foreground">
                NEW
              </span>
            )}
            <h2 className="text-xl font-semibold leading-snug">{listing.title}</h2>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {listing.location}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {formatRelativeTime(listing.createdAt)}
              </span>
            </div>
          </div>
          {budget && (
            <div className="shrink-0 text-right">
              <p className="text-lg font-semibold text-primary">{budget}</p>
              <p className="text-xs text-muted-foreground">Budget</p>
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Task details</h3>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{listing.description}</p>
      </div>

      {listing.imageUrls.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {listing.imageUrls.map((url) => (
            <img key={url} src={url} alt="" className="aspect-square rounded-lg object-cover" />
          ))}
        </div>
      )}

      {listing.owner && (
        <div>
          <h3 className="mb-2 text-sm font-medium">Posted by</h3>
          <Link to={`/users/${listing.owner.id}`} className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={listing.owner.avatarUrl ?? undefined} />
              <AvatarFallback>{initials(listing.owner.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate font-medium">{listing.owner.name}</p>
                {listing.owner.kycStatus === "verified" && (
                  <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Verified" />
                )}
              </div>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                {listing.owner.ratingCount > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Star className="h-3 w-3 fill-highlight text-highlight" /> {listing.owner.ratingAvg.toFixed(1)}
                  </span>
                )}
                {listing.owner._count && <span>{listing.owner._count.listings} tasks posted</span>}
              </p>
            </div>
          </Link>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-medium">Task info</h3>
        <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Category</dt>
          <dd className="text-right">{listing.category}</dd>
          <dt className="text-muted-foreground">Posted</dt>
          <dd className="text-right">{new Date(listing.createdAt).toLocaleString()}</dd>
          <dt className="text-muted-foreground">Task ID</dt>
          <dd className="truncate text-right text-xs">{listing.id.slice(0, 8).toUpperCase()}</dd>
        </dl>
      </div>

      {offerCount > 0 && listing.bids && (
        <div>
          <h3 className="mb-2 text-sm font-medium">
            {offerCount} {offerCount === 1 ? "person has" : "people have"} made offers
          </h3>
          <div className="flex -space-x-2">
            {listing.bids.slice(0, 4).map((bid) => (
              <Avatar key={bid.id} className="h-8 w-8 border-2 border-background">
                <AvatarImage src={bid.bidder?.avatarUrl ?? undefined} />
                <AvatarFallback className="text-xs">{bid.bidder ? initials(bid.bidder.name) : "?"}</AvatarFallback>
              </Avatar>
            ))}
            {offerCount > 4 && (
              <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-secondary text-xs font-medium text-primary">
                +{offerCount - 4}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {isOpen && (
          <Button asChild variant="highlight">
            <Link to={`/listings/${listing.id}`}>Make an offer</Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link to={`/listings/${listing.id}`}>Message poster</Link>
        </Button>
      </div>
    </div>
  );
}
