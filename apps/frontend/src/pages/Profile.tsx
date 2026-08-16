import { useParams } from "react-router-dom";
import { usePublicProfile } from "@/hooks/use-users";
import { useUserRatings } from "@/hooks/use-ratings";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ListingCard } from "@/components/listings/ListingCard";
import { RatingsList } from "@/components/ratings/RatingsList";
import { ReportDialog } from "@/components/reports/ReportDialog";
import { initials, formatRelativeTime } from "@/lib/format";
import type { Listing } from "@/types/api";

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const { data: profile, isLoading } = usePublicProfile(id);
  const { data: ratings } = useUserRatings(id);

  if (isLoading || !profile) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={profile.avatarUrl ?? undefined} />
            <AvatarFallback className="text-lg">{initials(profile.name)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-semibold">{profile.name}</h1>
            <p className="text-sm text-muted-foreground">
              {profile.ratingCount > 0 ? `★ ${profile.ratingAvg.toFixed(1)} (${profile.ratingCount} ratings)` : "No ratings yet"}
            </p>
            <p className="text-xs text-muted-foreground">Joined {formatRelativeTime(profile.createdAt)}</p>
          </div>
        </div>
        {id && <ReportDialog targetType="user" targetId={id} />}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">Open tasks</h2>
        {profile.listings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open tasks right now.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profile.listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing as Listing} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">Ratings</h2>
        <RatingsList ratings={ratings ?? []} />
      </div>
    </div>
  );
}
