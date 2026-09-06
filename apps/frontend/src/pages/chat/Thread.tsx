import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Phone, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { useConversations, useMessages, useSendMessage, useShareContact } from "@/hooks/use-chat";
import { ApiError } from "@/lib/api-client";
import { formatDayLabel, initials } from "@/lib/format";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export default function Thread() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user } = useAuth();
  const { data: conversations } = useConversations();
  const { data: messages, isLoading } = useMessages(conversationId);
  const sendMessage = useSendMessage(conversationId!);
  const shareContact = useShareContact(conversationId!);
  const [body, setBody] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversation = conversations?.find((c) => c.id === conversationId);
  const counterpart = conversation?.counterpart;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    try {
      await sendMessage.mutateAsync(body.trim());
      setBody("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't send that message.");
    }
  };

  const handleShareContact = async () => {
    try {
      await shareContact.mutateAsync();
      toast.success("Contact shared!");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't share your contact.");
    }
  };

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col md:h-[calc(100vh-5rem)]">
      <div className="mb-3 flex items-center gap-3 border-b pb-3">
        <Link to="/chat" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Avatar className="h-9 w-9">
          <AvatarImage src={counterpart?.avatarUrl ?? undefined} />
          <AvatarFallback>{counterpart ? initials(counterpart.name) : "?"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium leading-tight">{counterpart?.name ?? "Chat"}</p>
          {conversation?.listingTitle && (
            <p className="truncate text-xs text-muted-foreground">{conversation.listingTitle}</p>
          )}
        </div>
        {conversation?.canShareContact && (
          <Button variant="outline" size="sm" onClick={handleShareContact} disabled={shareContact.isPending}>
            <Phone className="mr-1.5 h-3.5 w-3.5" /> Share contact
          </Button>
        )}
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto rounded-lg bg-secondary/40 px-2 py-3">
        {isLoading && <Skeleton className="h-full" />}
        {messages?.map((message, i) => {
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const isMine = message.senderId === user?.id;
          const showDaySeparator = !prev || formatDayLabel(prev.createdAt) !== formatDayLabel(message.createdAt);
          const showAvatar = !next || next.senderId !== message.senderId;
          return (
            <div key={message.id}>
              {showDaySeparator && (
                <div className="my-3 flex items-center justify-center">
                  <span className="rounded-full bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
                    {formatDayLabel(message.createdAt)}
                  </span>
                </div>
              )}
              <div className="py-0.5">
                <MessageBubble message={message} isMine={isMine} showAvatar={showAvatar} counterpart={counterpart} />
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {conversation && !conversation.isActive ? (
        <p className="border-t pt-3 text-center text-sm text-muted-foreground">
          This task was awarded to someone else, so this chat is read-only.
        </p>
      ) : (
        <form onSubmit={handleSend} className="flex gap-2 border-t pt-3">
          <Input
            placeholder="Type a message…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            autoComplete="off"
            className="rounded-full"
          />
          <Button
            type="submit"
            size="icon"
            className="shrink-0 rounded-full"
            disabled={sendMessage.isPending || !body.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      )}
    </div>
  );
}
