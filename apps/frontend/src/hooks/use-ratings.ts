import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Rating } from "@/types/api";

export function useListingRatings(listingId: string | undefined) {
  return useQuery({
    queryKey: ["ratings", "listing", listingId],
    queryFn: () => apiFetch<Rating[]>(`/listings/${listingId}/ratings`),
    enabled: !!listingId,
  });
}

export function useUserRatings(userId: string | undefined) {
  return useQuery({
    queryKey: ["ratings", "user", userId],
    queryFn: () => apiFetch<Pick<Rating, "id" | "stars" | "comment" | "createdAt">[]>(`/users/${userId}/ratings`),
    enabled: !!userId,
  });
}

export function useSubmitRating(listingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { stars: number; comment?: string }) =>
      apiFetch<Rating>(`/listings/${listingId}/ratings`, { method: "POST", body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ratings", "listing", listingId] });
      queryClient.invalidateQueries({ queryKey: ["listings", listingId] });
    },
  });
}
