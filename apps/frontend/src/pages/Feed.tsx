import { useState } from "react";
import { useListings, type ListingFilters as Filters } from "@/hooks/use-listings";
import { ListingCard } from "@/components/listings/ListingCard";
import { ListingFilters } from "@/components/listings/ListingFilters";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function Feed() {
  const [filters, setFilters] = useState<Filters>({ page: 1, limit: 20 });
  const { data, isLoading, isError } = useListings(filters);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Browse errands</h1>
        <p className="text-sm text-muted-foreground">Find something to help with, or post your own.</p>
      </div>

      <ListingFilters value={filters} onChange={setFilters} />

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      )}

      {isError && <p className="text-sm text-destructive">Couldn't load listings. Try again shortly.</p>}

      {data && data.items.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">No errands match your filters yet.</p>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={(filters.page ?? 1) <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {data.page} · {data.total} total
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page * data.limit >= data.total}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
