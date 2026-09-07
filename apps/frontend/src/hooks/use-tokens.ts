import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api-client";
import type { Paginated, TokenPack, TokenPurchase, TokenTransaction } from "@/types/api";

export function useTokenBalance() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["tokens", "balance"],
    queryFn: () => apiFetch<{ balance: number }>("/tokens/balance"),
    enabled: !!user,
  });
}

export function useTokenPacks() {
  return useQuery({
    queryKey: ["tokens", "packs"],
    queryFn: () => apiFetch<TokenPack[]>("/tokens/packs"),
  });
}

export function useTokenTransactions(page = 1) {
  return useQuery({
    queryKey: ["tokens", "transactions", page],
    queryFn: () => apiFetch<Paginated<TokenTransaction>>("/tokens/transactions", { params: { page } }),
  });
}

export function useInitiatePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { packId: string; phone: string }) =>
      apiFetch<{ purchaseId: string; status: string; balance?: number }>("/tokens/purchases/initiate", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tokens"] });
    },
  });
}

export function usePurchaseStatus(purchaseId: string | undefined, options: { enabled: boolean }) {
  return useQuery({
    queryKey: ["tokens", "purchases", purchaseId],
    queryFn: () => apiFetch<TokenPurchase>(`/tokens/purchases/${purchaseId}`),
    enabled: options.enabled && !!purchaseId,
    refetchInterval: (query) => (query.state.data?.status === "pending" ? 2000 : false),
  });
}
