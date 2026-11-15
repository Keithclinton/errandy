import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { IdDocumentType, KycStatus, KycVerification, OwnIdCheck } from "@/types/api";

export function useKycStatus() {
  return useQuery({
    queryKey: ["kyc", "status"],
    queryFn: () =>
      apiFetch<{ kycStatus: KycStatus; latestVerification: KycVerification | null; idVerification: OwnIdCheck }>(
        "/kyc/status",
      ),
    // While an ID check waits for an admin, pick up the result without a reload.
    refetchInterval: (query) => (query.state.data?.idVerification.status === "pending" ? 60_000 : false),
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

export interface IdCheckSubmission {
  documentType: IdDocumentType;
  fullName: string;
  idNumber: string;
  consent: boolean;
  /** JPEG data URLs, already shrunk by compressPhoto. */
  images: { front: string; back?: string; selfie: string };
}

export function useSubmitIdCheck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: IdCheckSubmission) =>
      apiFetch<OwnIdCheck>("/kyc/id-verification", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kyc", "status"] }),
  });
}
