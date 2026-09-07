import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { KycStatus, KycVerification } from "@/types/api";

export function useKycStatus() {
  return useQuery({
    queryKey: ["kyc", "status"],
    queryFn: () => apiFetch<{ kycStatus: KycStatus; latestVerification: KycVerification | null }>("/kyc/status"),
  });
}

export function useRequestOtp() {
  return useMutation({
    mutationFn: (phone: string) => apiFetch<{ phone: string }>("/kyc/phone/request-otp", { method: "POST", body: { phone } }),
  });
}

export function useVerifyOtp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ phone, code }: { phone: string; code: string }) =>
      apiFetch<{ kycStatus: KycStatus }>("/kyc/phone/verify-otp", { method: "POST", body: { phone, code } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kyc", "status"] });
      queryClient.invalidateQueries({ queryKey: ["tokens"] }); // verifying grants the signup bonus
    },
  });
}
