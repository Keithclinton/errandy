import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/context/auth-context";
import type { Notification, Paginated } from "@/types/api";

export function useUnreadCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => apiFetch<{ unreadCount: number }>("/notifications/unread-count"),
    enabled: !!user,
    refetchInterval: 15_000,
  });
}

export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<Paginated<Notification> & { unreadCount: number }>("/notifications"),
    enabled: !!user,
    refetchInterval: 15_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

/** Maps a notification's entityType/entityId to where it should deep-link. */
export function notificationHref(notification: Notification): string {
  switch (notification.entityType) {
    case "listing":
      return `/listings/${notification.entityId}`;
    case "conversation":
      return `/chat/${notification.entityId}`;
    case "report":
      return `/admin/reports`;
    default:
      return "/notifications";
  }
}
