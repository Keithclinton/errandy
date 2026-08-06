import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatMoney, formatRelativeTime, initials } from "@/lib/format";
import type { Listing } from "@/types/api";

export function ListingCard({ listing }: { listing: Listing }) {
  const budget = formatMoney(listing.budget);
  return (
    <Link to={`/listings/${listing.id}`}>
      <Card className="h-full transition-colors hover:border-primary/50">
        <CardContent className="flex h-full flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium leading-snug">{listing.title}</h3>
            {budget && <span className="shrink-0 font-semibold text-primary">{budget}</span>}
          </div>
          <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">{listing.description}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{listing.category}</Badge>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> {listing.location}
            </span>
          </div>
          {listing.owner && (
            <div className="flex items-center justify-between border-t pt-3">
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={listing.owner.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-[10px]">{initials(listing.owner.name)}</AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground">{listing.owner.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">{formatRelativeTime(listing.createdAt)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
