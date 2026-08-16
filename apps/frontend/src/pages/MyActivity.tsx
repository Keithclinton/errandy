import { Link } from "react-router-dom";
import { useAuth } from "@/context/auth-context";
import { useListings } from "@/hooks/use-listings";
import { useMyBids, useReceivedBids } from "@/hooks/use-bids";
import { ListingCard } from "@/components/listings/ListingCard";
import { BidList } from "@/components/bids/BidList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function MyActivity() {
  const { user } = useAuth();
  const myListings = useListings({ ownerId: user?.id });
  const myBids = useMyBids();
  const receivedBids = useReceivedBids();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My activity</h1>
        <Button asChild size="sm">
          <Link to="/listings/new">Post a task</Link>
        </Button>
      </div>

      <Tabs defaultValue="listings">
        <TabsList>
          <TabsTrigger value="listings">My tasks</TabsTrigger>
          <TabsTrigger value="placed">Offers made</TabsTrigger>
          <TabsTrigger value="received">Offers received</TabsTrigger>
        </TabsList>

        <TabsContent value="listings" className="space-y-4">
          {myListings.isLoading && <Skeleton className="h-40" />}
          {myListings.data && myListings.data.items.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">You haven't posted any tasks yet.</p>
          )}
          {myListings.data && myListings.data.items.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myListings.data.items.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="placed" className="space-y-4">
          {myBids.isLoading && <Skeleton className="h-24" />}
          {myBids.data && myBids.data.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">You haven't made any offers yet.</p>
          )}
          {myBids.data && myBids.data.length > 0 && (
            <BidList bids={myBids.data} isOwner={false} currentUserId={user?.id} />
          )}
        </TabsContent>

        <TabsContent value="received" className="space-y-4">
          {receivedBids.isLoading && <Skeleton className="h-24" />}
          {receivedBids.data && receivedBids.data.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No offers on your tasks yet.</p>
          )}
          {receivedBids.data && receivedBids.data.length > 0 && (
            <BidList bids={receivedBids.data} isOwner currentUserId={user?.id} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
