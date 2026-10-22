import { apiGet, apiPost } from '@/lib/api';
import type { OrderStatus } from '@/features/orders/api';

export type ChatMessage = {
  id: string;
  senderId: string;
  body: string;
  clientKey: string | null;
  createdAt: string;
};

export type ChatConversation = {
  requestId: string;
  assignmentId: string;
  title: string;
  status: OrderStatus;
  role: 'customer' | 'shopper';
  counterpart: { id: string; displayName: string };
  acceptedAt: string;
  estimatedItemsTotal: number | null;
  deliveryFee: number;
  currency: string;
  itemCount: number;
  canSend: boolean;
  messages: ChatMessage[];
  hasMore: boolean;
};

export function getChat(id: string, cursor?: { before?: string; after?: string }) {
  return apiGet<ChatConversation>(`/api/v1/orders/${id}/chat`, cursor);
}

export function sendChatMessage(id: string, body: { body: string; clientKey: string; assignmentId: string }, userId: string) {
  return apiPost<ChatMessage>(`/api/v1/orders/${id}/chat/messages`, body, userId);
}

// Compare bigint IDs without converting them to imprecise JavaScript numbers.
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map([...current, ...incoming].map(message => [message.id, message]));
  return [...byId.values()].sort((a, b) => b.id.length - a.id.length || b.id.localeCompare(a.id));
}

export function messageKey() {
  // Retry key only; never used as a credential or authorization decision.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const value = Math.floor(Math.random() * 16);
    return (character === 'x' ? value : (value & 3) | 8).toString(16);
  });
}
