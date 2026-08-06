import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Bid, KycVerification, Listing, Paginated, Report, ReportStatus, User } from "@/types/api";

export function useAdminUsers(search: string) {
  return useQuery({
    queryKey: ["admin", "users", search],
    queryFn: () => apiFetch<Paginated<User>>("/admin/users", { params: { search } }),
  });
}

export interface AdminUserDetail extends User {
  listings: Listing[];
  bids: Bid[];
  kycVerifications: KycVerification[];
  reportsFiled: Report[];
}

export function useAdminUserDetail(userId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "users", "detail", userId],
    queryFn: () => apiFetch<AdminUserDetail>(`/admin/users/${userId}`),
    enabled: !!userId,
  });
}

function useAdminUserAction(action: "suspend" | "reinstate") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => apiFetch(`/admin/users/${userId}/${action}`, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export const useSuspendUser = () => useAdminUserAction("suspend");
export const useReinstateUser = () => useAdminUserAction("reinstate");

export function useAdminReports(status?: ReportStatus) {
  return useQuery({
    queryKey: ["admin", "reports", status],
    queryFn: () => apiFetch<Report[]>("/admin/reports", { params: { status } }),
  });
}

export function useResolveReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "reviewed" | "actioned" | "dismissed" }) =>
      apiFetch(`/admin/reports/${id}`, { method: "PATCH", body: { status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "reports"] }),
  });
}

interface BidsPerMonth {
  month: string;
  count: number;
}
interface TopCategory {
  category: string;
  count: number;
}
interface Funnel {
  listingsCreated: number;
  listingsWithBids: number;
  listingsWithChat: number;
}

export function useAnalyticsBidsPerMonth() {
  return useQuery({
    queryKey: ["admin", "analytics", "bids-per-month"],
    queryFn: () => apiFetch<BidsPerMonth[]>("/admin/analytics/bids-per-month"),
  });
}

export function useAnalyticsTopCategories() {
  return useQuery({
    queryKey: ["admin", "analytics", "top-categories"],
    queryFn: () => apiFetch<TopCategory[]>("/admin/analytics/top-categories"),
  });
}

export function useAnalyticsFunnel() {
  return useQuery({
    queryKey: ["admin", "analytics", "funnel"],
    queryFn: () => apiFetch<Funnel>("/admin/analytics/funnel"),
  });
}

export function useAnalyticsActiveUsers() {
  return useQuery({
    queryKey: ["admin", "analytics", "active-users"],
    queryFn: () => apiFetch<{ activeUsers: number; windowDays: number }>("/admin/analytics/active-users"),
  });
}

export function useAnalyticsKycPassRate() {
  return useQuery({
    queryKey: ["admin", "analytics", "kyc-pass-rate"],
    queryFn: () => apiFetch<{ verified: number; decided: number; passRate: number | null }>(
      "/admin/analytics/kyc-pass-rate",
    ),
  });
}
