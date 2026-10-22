import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ApiError } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { ChatConversation, ChatMessage, getChat, mergeMessages, messageKey, sendChatMessage } from './api';

type PendingMessage = { body: string; clientKey: string; assignmentId: string };

export function useChat(requestId: string, userId: string) {
  const [chat, setChat] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sendError, setSendError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<PendingMessage | null>(null);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const current = useRef<ChatConversation | null>(null);
  const messageRows = useRef<ChatMessage[]>([]);
  const pendingRef = useRef<PendingMessage | null>(null);
  const generation = useRef(0);
  const sendingRef = useRef(false);
  const refreshing = useRef(false);
  const olderRef = useRef(false);
  const focused = useRef(false);

  const storeMessages = useCallback((next: ChatMessage[]) => {
    messageRows.current = next;
    setMessages(next);
    if (pendingRef.current && next.some(row => row.clientKey === pendingRef.current?.clientKey && row.senderId === userId)) {
      pendingRef.current = null;
      setPending(null); setDraft(''); setSendError('');
    }
  }, [userId]);

  const unavailable = useCallback(() => {
    current.current = null; setChat(null); storeMessages([]);
    pendingRef.current = null; setPending(null); setDraft(''); setHasOlder(false);
  }, [storeMessages]);

  const refresh = useCallback(async () => {
    if (refreshing.current || !focused.current || AppState.currentState === 'background') return;
    refreshing.current = true;
    const version = generation.current;
    try {
      let after: string | undefined = messageRows.current[0]?.id;
      let more = true;
      while (more) {
        let result = await getChat(requestId, after ? { after } : undefined);
        if (generation.current !== version || !focused.current) return;
        if (current.current && current.current.assignmentId !== result.assignmentId) {
          // A release cleared the old conversation. Never merge it into a new one.
          unavailable(); setSendError('');
          result = await getChat(requestId);
          if (generation.current !== version || !focused.current) return;
          after = undefined;
        }
        const initial = !current.current;
        current.current = result; setChat(result);
        storeMessages(mergeMessages(messageRows.current, result.messages));
        if (initial) setHasOlder(result.hasMore);
        setError('');
        more = Boolean(after && result.hasMore && result.messages.length);
        after = result.messages[0]?.id;
      }
    } catch (e) {
      if (generation.current !== version || !focused.current) return;
      if (e instanceof ApiError && (e.status === 404 || e.status === 401 || e.status === 403)) unavailable();
      setError(e instanceof Error ? e.message : 'Không tải được cuộc trò chuyện.');
    } finally {
      if (generation.current === version) { refreshing.current = false; setLoading(false); }
    }
  }, [requestId, storeMessages, unavailable]);

  useFocusEffect(useCallback(() => {
    focused.current = true; generation.current += 1; refreshing.current = false;
    void refresh();
    // Realtime is an invalidation signal only. All content is loaded through FastAPI.
    const channel = supabase.channel(`order-chat:${requestId}:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `request_id=eq.${requestId}` }, () => { void refresh(); })
      .subscribe(status => { if (status === 'SUBSCRIBED') void refresh(); });
    const interval = setInterval(() => { void refresh(); }, 5000);
    const appState = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => {
      focused.current = false; generation.current += 1;
      refreshing.current = false; sendingRef.current = false; olderRef.current = false;
      setSending(false); setLoadingOlder(false);
      clearInterval(interval); appState.remove(); void supabase.removeChannel(channel);
    };
  }, [refresh, requestId, userId]));

  const loadOlder = async () => {
    if (olderRef.current || !hasOlder || !current.current) return;
    olderRef.current = true; setLoadingOlder(true);
    const version = generation.current;
    const assignment = current.current.assignmentId;
    try {
      const result = await getChat(requestId, { before: messageRows.current.at(-1)?.id });
      if (generation.current !== version || !focused.current) return;
      if (result.assignmentId !== assignment || current.current?.assignmentId !== assignment) { void refresh(); return; }
      storeMessages(mergeMessages(messageRows.current, result.messages)); setHasOlder(result.hasMore); setError('');
    } catch (e) {
      if (generation.current !== version || !focused.current) return;
      if (e instanceof ApiError && e.status === 404) unavailable();
      setError(e instanceof Error ? e.message : 'Không tải được tin nhắn cũ.');
    } finally {
      if (generation.current === version) { olderRef.current = false; setLoadingOlder(false); }
    }
  };

  const send = async () => {
    const conversation = current.current;
    if (!conversation?.canSend || sendingRef.current || !draft.trim()) return;
    const payload = pendingRef.current ?? { body: draft.trim(), clientKey: messageKey(), assignmentId: conversation.assignmentId };
    pendingRef.current = payload; setPending(payload); sendingRef.current = true;
    setSending(true); setSendError('');
    const version = generation.current;
    try {
      const result = await sendChatMessage(requestId, payload, userId);
      if (generation.current !== version || !focused.current || current.current?.assignmentId !== payload.assignmentId) return;
      storeMessages(mergeMessages(messageRows.current, [result]));
      void refresh();
    } catch (e) {
      if (generation.current !== version || !focused.current) return;
      if (e instanceof ApiError && [401, 403, 404, 409, 422].includes(e.status)) {
        pendingRef.current = null; setPending(null);
        if (e.status === 404) unavailable();
        void refresh();
      }
      setSendError(e instanceof Error ? e.message : 'Chưa xác nhận gửi được. Hãy thử gửi lại.');
    } finally {
      if (generation.current === version) { sendingRef.current = false; setSending(false); }
    }
  };

  return { chat, messages, loading, error, sendError, draft, setDraft, sending, pending, hasOlder, loadingOlder, loadOlder, refresh, send };
}
