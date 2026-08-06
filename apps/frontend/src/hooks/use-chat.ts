import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api-client";
import type { Conversation, ConversationSummary, Message } from "@/types/api";

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: () => apiFetch<ConversationSummary[]>("/conversations"),
    refetchInterval: 15_000,
  });
}

export function useListingConversation(listingId: string | undefined, withUserId?: string) {
  return useQuery({
    queryKey: ["conversations", "for-listing", listingId, withUserId],
    queryFn: () => apiFetch<Conversation>(`/listings/${listingId}/conversation`, { params: { with: withUserId } }),
    enabled: !!listingId,
  });
}

export function useMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => apiFetch<Message[]>(`/conversations/${conversationId}/messages`),
    enabled: !!conversationId,
    refetchInterval: 4_000,
  });
}

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiFetch<Message>(`/conversations/${conversationId}/messages`, { method: "POST", body: { body } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

/** Opens (or creates) a conversation and navigates to it — used by "Message" buttons. */
export function useOpenConversation() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: ({ listingId, withUserId }: { listingId: string; withUserId?: string }) =>
      apiFetch<Conversation>(`/listings/${listingId}/conversation`, { params: { with: withUserId } }),
    onSuccess: (conversation) => {
      navigate(`/chat/${conversation.id}`);
    },
  });
}

export function useShareContact(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<Message>(`/conversations/${conversationId}/share-contact`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    },
  });
}
