import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Report, ReportReason, ReportTargetType } from "@/types/api";

export function useCreateReport() {
  return useMutation({
    mutationFn: (input: { targetType: ReportTargetType; targetId: string; reason: ReportReason; details?: string }) =>
      apiFetch<Report>("/reports", { method: "POST", body: input }),
  });
}
