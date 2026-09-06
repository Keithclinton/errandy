import { StarRating } from "./StarRating";
import { formatRelativeTime } from "@/lib/format";

interface RatingItem {
  id: string;
  stars: number | null;
  comment?: string | null;
  createdAt: string;
  visible?: boolean;
}

export function RatingsList({ ratings }: { ratings: RatingItem[] }) {
  if (ratings.length === 0) {
    return <p className="text-sm text-muted-foreground">No reviews yet.</p>;
  }

  return (
    <div className="space-y-3">
      {ratings.map((rating) => (
        <div key={rating.id} className="rounded-lg border p-3">
          {rating.visible === false ? (
            <p className="text-sm text-muted-foreground">
              Hidden until both parties rate, or 7 days pass.
            </p>
          ) : (
            <>
              <StarRating value={rating.stars} readOnly size="sm" />
              {rating.comment && <p className="mt-1 text-sm">{rating.comment}</p>}
            </>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(rating.createdAt)}</p>
        </div>
      ))}
    </div>
  );
}
