import { Link } from "react-router-dom";
import { HandCoins, CheckCircle2, XCircle, MessageCircle, Star, ShieldCheck, Coins, Bell } from "lucide-react";
import { useNotifications, useMarkNotificationRead, notificationHref } from "@/hooks/use-notifications";
import type { NotificationType } from "@/types/api";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format";

const NOTIFICATION_STYLES: Record<NotificationType, { icon: typeof Bell; className: string }> = {
  bid_received: { icon: HandCoins, className: "bg-sky-100 text-sky-600" },
  bid_accepted: { icon: CheckCircle2, className: "bg-emerald-100 text-emerald-600" },
  bid_declined: { icon: XCircle, className: "bg-rose-100 text-rose-600" },
  new_message: { icon: MessageCircle, className: "bg-indigo-100 text-indigo-600" },
  please_rate: { icon: Star, className: "bg-amber-100 text-amber-600" },
  report_resolved: { icon: ShieldCheck, className: "bg-slate-100 text-slate-600" },
  bidder_token_required: { icon: Coins, className: "bg-amber-100 text-amber-600" },
  tokens_purchased: { icon: Coins, className: "bg-emerald-100 text-emerald-600" },
};

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
        {data?.items.map((notification) => {
          const style = NOTIFICATION_STYLES[notification.type] ?? { icon: Bell, className: "bg-secondary text-muted-foreground" };
          const Icon = style.icon;
          return (
            <Link
              key={notification.id}
              to={notificationHref(notification)}
              onClick={() => {
                if (!notification.readAt) markRead.mutate(notification.id);
              }}
              className={cn("flex items-start gap-3 p-3 hover:bg-accent", !notification.readAt && "bg-secondary/60")}
            >
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", style.className)}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{notification.title}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeTime(notification.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{notification.body}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
