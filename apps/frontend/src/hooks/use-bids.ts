import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Bid } from "@/types/api";

export function useMyBids() {
  return useQuery({
    queryKey: ["bids", "mine"],
    queryFn: () => apiFetch<Bid[]>("/bids/mine"),
  });
}

export function useReceivedBids() {
  return useQuery({
    queryKey: ["bids", "received"],
    queryFn: () => apiFetch<Bid[]>("/bids/received"),
  });
}

export function usePlaceBid(listingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { amount: number; message?: string }) =>
      apiFetch<Bid>(`/listings/${listingId}/bids`, { method: "POST", body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings", listingId] });
      queryClient.invalidateQueries({ queryKey: ["bids"] });
    },
  });
}

function useBidAction(action: "accept" | "decline" | "withdraw") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bidId: string) => apiFetch<Bid>(`/bids/${bidId}/${action}`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["bids"] });
    },
  });
}

export function useAcceptBid() {
  return useBidAction("accept");
}

export function useDeclineBid() {
  return useBidAction("decline");
}

export function useWithdrawBid() {
  return useBidAction("withdraw");
}
