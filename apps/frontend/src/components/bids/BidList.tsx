import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAcceptBid, useDeclineBid, useWithdrawBid } from "@/hooks/use-bids";
import { ApiError } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney, formatRelativeTime } from "@/lib/format";
import type { Bid } from "@/types/api";

const statusVariant: Record<Bid["status"], "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  accepted: "default",
  declined: "outline",
  withdrawn: "outline",
};

export function BidList({
  bids,
  isOwner,
  currentUserId,
}: {
  bids: Bid[];
  isOwner: boolean;
  currentUserId?: string;
}) {
  const accept = useAcceptBid();
  const decline = useDeclineBid();
  const withdraw = useWithdrawBid();

  if (bids.length === 0) {
    return <p className="text-sm text-muted-foreground">No offers yet.</p>;
  }

  const handle = async (action: "accept" | "decline" | "withdraw", bidId: string) => {
    try {
      const mutation = action === "accept" ? accept : action === "decline" ? decline : withdraw;
      await mutation.mutateAsync(bidId);
      toast.success(
        action === "accept" ? "Offer accepted" : action === "decline" ? "Offer declined" : "Offer withdrawn",
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  };

  return (
    <div className="space-y-3">
      {bids
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((bid) => (
          <Card key={bid.id}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="space-y-1">
                {bid.listing && (
                  <Link to={`/listings/${bid.listing.id}`} className="text-sm font-medium text-primary hover:underline">
                    {bid.listing.title}
                  </Link>
                )}
                {bid.bidder && <p className="text-xs text-muted-foreground">from {bid.bidder.name}</p>}
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatMoney(bid.amount)}</span>
                  <Badge variant={statusVariant[bid.status]}>{bid.status}</Badge>
                </div>
                {bid.message && <p className="text-sm text-muted-foreground">{bid.message}</p>}
                <p className="text-xs text-muted-foreground">{formatRelativeTime(bid.createdAt)}</p>
              </div>
              {bid.status === "pending" && isOwner && (
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => handle("accept", bid.id)}>
                    Accept
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handle("decline", bid.id)}>
                    Decline
                  </Button>
                </div>
              )}
              {bid.status === "pending" && !isOwner && bid.bidderId === currentUserId && (
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => handle("withdraw", bid.id)}>
                  Withdraw
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
