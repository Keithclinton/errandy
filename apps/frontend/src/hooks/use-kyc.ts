import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { KycStatus, KycVerification } from "@/types/api";

export function useKycStatus() {
  return useQuery({
    queryKey: ["kyc", "status"],
    queryFn: () => apiFetch<{ kycStatus: KycStatus; latestVerification: KycVerification | null }>("/kyc/status"),
    refetchInterval: (query) => (query.state.data?.kycStatus === "pending" ? 4_000 : false),
  });
}

export function useStartVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<KycVerification>("/kyc/start", { method: "POST", body: { consent: true } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kyc", "status"] });
    },
  });
}
