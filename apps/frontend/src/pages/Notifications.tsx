import { Link } from "react-router-dom";
import { useNotifications, useMarkNotificationRead, notificationHref } from "@/hooks/use-notifications";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format";

export default function Notifications() {
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Notifications</h1>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      )}

      {data && data.items.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">You're all caught up.</p>
      )}

      <div className="divide-y rounded-lg border">
        {data?.items.map((notification) => (
          <Link
            key={notification.id}
            to={notificationHref(notification)}
            onClick={() => {
              if (!notification.readAt) markRead.mutate(notification.id);
            }}
            className={cn("block p-3 hover:bg-accent", !notification.readAt && "bg-secondary/60")}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{notification.title}</p>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatRelativeTime(notification.createdAt)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{notification.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
