import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { MapPin, MessageCircle } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useListing, useCompleteListing } from "@/hooks/use-listings";
import { useListingRatings } from "@/hooks/use-ratings";
import { useOpenConversation } from "@/hooks/use-chat";
import { ApiError } from "@/lib/api-client";
import { formatMoney, initials } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { VerifiedGate } from "@/components/layout/VerifiedGate";
import { BidForm } from "@/components/bids/BidForm";
import { BidList } from "@/components/bids/BidList";
import { RatingsList } from "@/components/ratings/RatingsList";
import { RatingPrompt } from "@/components/ratings/RatingPrompt";
import { ReportDialog } from "@/components/reports/ReportDialog";

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: listing, isLoading } = useListing(id);
  const { data: ratings } = useListingRatings(id);
  const completeListing = useCompleteListing();
  const openConversation = useOpenConversation();

  if (isLoading || !listing) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const isOwner = user?.id === listing.ownerId;
  const acceptedBid = listing.bids?.find((b) => b.id === listing.acceptedBidId);
  const isAcceptedBidder = !!acceptedBid && acceptedBid.bidderId === user?.id;
  const isParticipant = isOwner || isAcceptedBidder;
  const myRating = ratings?.find((r) => r.raterId === user?.id);
  const budget = formatMoney(listing.budget);

  const handleComplete = async () => {
    try {
      await completeListing.mutateAsync(listing.id);
      toast.success("Marked as completed!");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't mark this as completed.");
    }
  };

  const handleMessage = (withUserId?: string) => {
    openConversation.mutate({ listingId: listing.id, withUserId });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{listing.category}</Badge>
            <Badge variant="outline">{listing.status}</Badge>
          </div>
          <h1 className="text-2xl font-semibold">{listing.title}</h1>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> {listing.location}
          </p>
        </div>

        {listing.imageUrls.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {listing.imageUrls.map((url) => (
              <img key={url} src={url} alt="" className="aspect-square rounded-lg object-cover" />
            ))}
          </div>
        )}

        <p className="whitespace-pre-wrap text-sm leading-relaxed">{listing.description}</p>

        <div className="flex items-center gap-2">
          <ReportDialog targetType="listing" targetId={listing.id} />
        </div>

        <Separator />

        {isOwner ? (
          <div>
            <h2 className="mb-3 text-lg font-medium">Bids ({listing.bids?.length ?? 0})</h2>
            <BidList bids={listing.bids ?? []} isOwner currentUserId={user?.id} />
          </div>
        ) : (
          <div>
            <h2 className="mb-3 text-lg font-medium">Place a bid</h2>
            {listing.status !== "open" ? (
              <p className="text-sm text-muted-foreground">This listing is no longer accepting bids.</p>
            ) : (
              <VerifiedGate>
                <BidForm listingId={listing.id} />
              </VerifiedGate>
            )}
          </div>
        )}

        {ratings && ratings.length > 0 && (
          <div>
            <h2 className="mb-3 text-lg font-medium">Ratings</h2>
            <RatingsList ratings={ratings} />
          </div>
        )}
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Posted by</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {listing.owner && (
              <Link to={`/users/${listing.owner.id}`} className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={listing.owner.avatarUrl ?? undefined} />
                  <AvatarFallback>{initials(listing.owner.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{listing.owner.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {listing.owner.ratingCount > 0
                      ? `★ ${listing.owner.ratingAvg.toFixed(1)} (${listing.owner.ratingCount})`
                      : "No ratings yet"}
                  </p>
                </div>
              </Link>
            )}
            {budget && (
              <div className="rounded-md bg-secondary px-3 py-2 text-sm">
                Budget: <span className="font-semibold text-primary">{budget}</span>
              </div>
            )}

            {isAcceptedBidder && !isOwner && (
              <Button className="w-full" variant="outline" onClick={() => handleMessage()}>
                <MessageCircle className="mr-2 h-4 w-4" /> Message owner
              </Button>
            )}

            {isOwner && acceptedBid && (
              <Button className="w-full" variant="outline" onClick={() => handleMessage(acceptedBid.bidderId)}>
                <MessageCircle className="mr-2 h-4 w-4" /> Message bidder
              </Button>
            )}

            {isOwner && listing.status === "closed" && acceptedBid && (
              <Button className="w-full" onClick={handleComplete} disabled={completeListing.isPending}>
                {completeListing.isPending ? "Marking…" : "Mark as completed"}
              </Button>
            )}

            {listing.status === "completed" && isParticipant && !myRating && <RatingPrompt listingId={listing.id} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
