import { Link } from "react-router-dom";
import { useConversations } from "@/hooks/use-chat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { initials, formatRelativeTime } from "@/lib/format";

export default function ConversationsList() {
  const { data, isLoading } = useConversations();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Chat</h1>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      )}

      {data && data.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No conversations yet. Chat opens as soon as you make or receive an offer.
        </p>
      )}

      <div className="divide-y rounded-lg border">
        {data?.map((conversation) => (
          <Link
            key={conversation.id}
            to={`/chat/${conversation.id}`}
            className="flex items-center gap-3 p-3 hover:bg-accent"
          >
            <Avatar>
              <AvatarImage src={conversation.counterpart?.avatarUrl ?? undefined} />
              <AvatarFallback>{conversation.counterpart ? initials(conversation.counterpart.name) : "?"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-medium">{conversation.counterpart?.name ?? "Unknown"}</p>
                {conversation.lastMessage && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeTime(conversation.lastMessage.createdAt)}
                  </span>
                )}
              </div>
              <p className="truncate text-sm text-muted-foreground">{conversation.listingTitle}</p>
              {conversation.lastMessage && (
                <p className="truncate text-sm text-muted-foreground">{conversation.lastMessage.body}</p>
              )}
            </div>
            {conversation.unreadCount > 0 && <Badge className="shrink-0">{conversation.unreadCount}</Badge>}
          </Link>
        ))}
      </div>
    </div>
  );
}
