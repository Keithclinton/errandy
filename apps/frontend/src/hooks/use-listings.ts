import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Listing, Paginated } from "@/types/api";

export interface ListingFilters {
  category?: string;
  location?: string;
  status?: string;
  search?: string;
  ownerId?: string;
  sort?: "newest" | "oldest" | "budget_high" | "budget_low";
  page?: number;
  limit?: number;
  [key: string]: string | number | boolean | undefined;
}

export function useListings(filters: ListingFilters = {}) {
  return useQuery({
    queryKey: ["listings", filters],
    queryFn: () => apiFetch<Paginated<Listing>>("/listings", { params: filters }),
  });
}

export function useListing(id: string | undefined) {
  return useQuery({
    queryKey: ["listings", id],
    queryFn: () => apiFetch<Listing>(`/listings/${id}`),
    enabled: !!id,
  });
}

export interface CreateListingInput {
  title: string;
  description: string;
  category: string;
  location: string;
  budget?: number;
  imageUrls?: string[];
}

export function useCreateListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateListingInput) => apiFetch<Listing>("/listings", { method: "POST", body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
  });
}

export function useCompleteListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Listing>(`/listings/${id}/complete`, { method: "PATCH" }),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["listings", id] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
  });
}
