import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { PublicProfile } from "@/types/api";

export function usePublicProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["users", userId],
    queryFn: () => apiFetch<PublicProfile>(`/users/${userId}`),
    enabled: !!userId,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name?: string; avatarUrl?: string; bio?: string; portfolioUrls?: string[] }) =>
      apiFetch("/users/me", { method: "PATCH", body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

/** Permanently deletes the current user's own account. Irreversible. */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: () => apiFetch("/users/me", { method: "DELETE" }),
  });
}
