import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, MapPin, Plus } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useListings, type ListingFilters as Filters } from "@/hooks/use-listings";
import { useMediaQuery } from "@/hooks/use-media-query";
import { CategoryPills } from "@/components/listings/CategoryPills";
import { ListingListItem } from "@/components/listings/ListingListItem";
import { ListingDetailPanel } from "@/components/listings/ListingDetailPanel";
import { BrowseSidebar } from "@/components/layout/BrowseSidebar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SORT_OPTIONS: { value: NonNullable<Filters["sort"]>; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "budget_high", label: "Budget: high to low" },
  { value: "budget_low", label: "Budget: low to high" },
];

export default function Feed() {
  const { user } = useAuth();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [filters, setFilters] = useState<Filters>({ page: 1, limit: 20 });
  const { data, isLoading, isError } = useListings(filters);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (isDesktop && data && data.items.length > 0) {
      setSelectedId((current) =>
        current && data.items.some((l) => l.id === current) ? current : data.items[0].id,
      );
    }
  }, [isDesktop, data]);

  return (
    <div className="flex gap-8">
      {user && <BrowseSidebar />}

      <div className="min-w-0 flex-1 space-y-6">
        {user && (
          <div className="flex justify-end lg:hidden">
            <Button asChild size="sm" variant="highlight">
              <Link to="/listings/new">
                <Plus className="mr-1 h-4 w-4" /> Post a Task
              </Link>
            </Button>
          </div>
        )}

        <div>
          <h1 className="text-2xl font-semibold">Browse Tasks</h1>
          <p className="text-sm text-muted-foreground">Find something worth doing</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tasks…"
              className="pl-9"
              value={filters.search ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
            />
          </div>
          <div className="relative sm:w-56">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Location"
              className="pl-9"
              value={filters.location ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value, page: 1 }))}
            />
          </div>
        </div>

        <CategoryPills
          value={filters.category}
          onChange={(category) => setFilters((f) => ({ ...f, category, page: 1 }))}
        />

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {data ? `${data.total} task${data.total === 1 ? "" : "s"} available` : " "}
          </span>
          <Select
            value={filters.sort ?? "newest"}
            onValueChange={(sort) => setFilters((f) => ({ ...f, sort: sort as Filters["sort"], page: 1 }))}
          >
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        )}

        {isError && <p className="text-sm text-destructive">Couldn't load tasks. Try again shortly.</p>}

        {data && data.items.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">No tasks match your filters yet.</p>
        )}

        {data && data.items.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
              <div className="min-w-0 space-y-3">
                {data.items.map((listing) => (
                  <ListingListItem
                    key={listing.id}
                    listing={listing}
                    selected={isDesktop && listing.id === selectedId}
                    onClick={(e) => {
                      if (isDesktop) {
                        e.preventDefault();
                        setSelectedId(listing.id);
                      }
                    }}
                  />
                ))}
              </div>
              {isDesktop && selectedId && (
                <div className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
                  <ListingDetailPanel listingId={selectedId} />
                </div>
              )}
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
    </div>
  );
}
