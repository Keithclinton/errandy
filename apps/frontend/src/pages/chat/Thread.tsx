import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Phone, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { useMessages, useSendMessage, useShareContact } from "@/hooks/use-chat";
import { ApiError } from "@/lib/api-client";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export default function Thread() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user } = useAuth();
  const { data: messages, isLoading } = useMessages(conversationId);
  const sendMessage = useSendMessage(conversationId!);
  const shareContact = useShareContact(conversationId!);
  const [body, setBody] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

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
      <div className="mb-3 flex items-center justify-between border-b pb-3">
        <Link to="/chat" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <Button variant="outline" size="sm" onClick={handleShareContact} disabled={shareContact.isPending}>
          <Phone className="mr-1.5 h-3.5 w-3.5" /> Share contact
        </Button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto py-2">
        {isLoading && <Skeleton className="h-full" />}
        {messages?.map((message) => (
          <MessageBubble key={message.id} message={message} isMine={message.senderId === user?.id} />
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2 border-t pt-3">
        <Input
          placeholder="Type a message…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          autoComplete="off"
        />
        <Button type="submit" size="icon" disabled={sendMessage.isPending || !body.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
