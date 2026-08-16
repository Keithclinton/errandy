import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ListingFilters as Filters } from "@/hooks/use-listings";

export function ListingFilters({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (next: Filters) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search tasks…"
          className="pl-9"
          value={value.search ?? ""}
          onChange={(e) => onChange({ ...value, search: e.target.value, page: 1 })}
        />
      </div>
      <Input
        placeholder="Category"
        className="sm:w-40"
        value={value.category ?? ""}
        onChange={(e) => onChange({ ...value, category: e.target.value, page: 1 })}
      />
      <Input
        placeholder="Location"
        className="sm:w-40"
        value={value.location ?? ""}
        onChange={(e) => onChange({ ...value, location: e.target.value, page: 1 })}
      />
    </div>
  );
}
