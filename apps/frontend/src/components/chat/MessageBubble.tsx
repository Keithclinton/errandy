import { cn } from "@/lib/utils";
import { formatMessageTime, initials } from "@/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Message } from "@/types/api";

export function MessageBubble({
  message,
  isMine,
  showAvatar,
  counterpart,
}: {
  message: Message;
  isMine: boolean;
  showAvatar: boolean;
  counterpart?: { name: string; avatarUrl?: string | null } | null;
}) {
  return (
    <div className={cn("flex items-end gap-2", isMine ? "justify-end" : "justify-start")}>
      {!isMine && (
        <Avatar className={cn("h-6 w-6", !showAvatar && "invisible")}>
          <AvatarImage src={counterpart?.avatarUrl ?? undefined} />
          <AvatarFallback className="text-[10px]">
            {counterpart ? initials(counterpart.name) : "?"}
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "max-w-[75%] px-3.5 py-2 text-sm shadow-sm",
          isMine
            ? "rounded-2xl rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-2xl rounded-bl-sm border bg-card text-foreground",
        )}
      >
        <p className="whitespace-pre-wrap">{message.body}</p>
        <p className={cn("mt-1 text-right text-[10px]", isMine ? "text-primary-foreground/70" : "text-muted-foreground")}>
          {formatMessageTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}
