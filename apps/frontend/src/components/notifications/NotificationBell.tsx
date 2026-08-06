import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUnreadCount } from "@/hooks/use-notifications";

export function NotificationBell() {
  const { data } = useUnreadCount();
  const count = data?.unreadCount ?? 0;

  return (
    <Button asChild variant="ghost" size="icon" className="relative">
      <Link to="/notifications" aria-label="Notifications">
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <Badge className="absolute -right-1 -top-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]">
            {count > 9 ? "9+" : count}
          </Badge>
        )}
      </Link>
    </Button>
  );
}
