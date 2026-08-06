import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format";
import type { Message } from "@/types/api";

export function MessageBubble({ message, isMine }: { message: Message; isMine: boolean }) {
  return (
    <div className={cn("flex", isMine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-lg px-3 py-2 text-sm",
          isMine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        )}
      >
        <p className="whitespace-pre-wrap">{message.body}</p>
        <p className={cn("mt-1 text-[10px] opacity-70")}>{formatRelativeTime(message.createdAt)}</p>
      </div>
    </div>
  );
}
