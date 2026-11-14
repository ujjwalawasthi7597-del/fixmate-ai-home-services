import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, MessageSquare } from 'lucide-react';
import { api, extractApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface ConversationItem {
  _id: string;
  participants: Array<{ _id: string; name: string; role: string }>;
  bookingId?: { bookingCode: string; problemTitle: string };
  lastMessage: string;
  lastMessageAt: string;
}

interface ChatMessage {
  _id: string;
  conversationId: string;
  senderId: { _id: string; name: string; role: string };
  text: string;
  createdAt: string;
}

export function MessagesPage() {
  const { user, socket } = useAuth();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeId, setActiveId] = useState<string>(searchParams.get('conversationId') || '');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api
      .get<{ conversations: ConversationItem[] }>('/conversations')
      .then((res) => {
        setConversations(res.data.conversations || []);
        if (!activeId && res.data.conversations?.[0]) {
          setActiveId(res.data.conversations[0]._id);
        }
      })
      .catch((err) => setError(extractApiError(err)));
  }, []);

  useEffect(() => {
    if (!activeId) return;
    api
      .get<{ messages: ChatMessage[] }>(`/conversations/${activeId}/messages`)
      .then((res) => setMessages(res.data.messages || []))
      .catch(() => {});

    socket?.emit('conversation:join', activeId);
    return () => {
      socket?.emit('conversation:leave', activeId);
    };
  }, [activeId, socket]);

  useEffect(() => {
    if (!socket) return;
    const handler = (msg: ChatMessage) => {
      if (msg.conversationId === activeId) {
        setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]));
      }
      setConversations((prev) =>
        prev.map((c) =>
          c._id === msg.conversationId ? { ...c, lastMessage: msg.text, lastMessageAt: msg.createdAt } : c
        )
      );
    };
    socket.on('message:new', handler);
    return () => {
      socket.off('message:new', handler);
    };
  }, [socket, activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !activeId) return;
    const content = text.trim();
    setText('');
    try {
      const { data } = await api.post<{ message: ChatMessage }>(`/conversations/${activeId}/messages`, {
        text: content,
      });
      setMessages((prev) => (prev.some((m) => m._id === data.message._id) ? prev : [...prev, data.message]));
    } catch (err) {
      setError(extractApiError(err));
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="font-display text-2xl font-bold text-navy-900 mb-6">Messages</h1>

      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">{error}</div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 h-[600px]">
        <aside className="md:col-span-4 border-r border-slate-200 overflow-y-auto divide-y divide-slate-100">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              No conversations yet. Start a chat from any professional profile or active booking.
            </div>
          ) : (
            conversations.map((c) => {
              const other = c.participants.find((p) => p._id !== user?.id) || c.participants[0];
              return (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => setActiveId(c._id)}
                  className={`w-full text-left px-4 py-3.5 hover:bg-slate-50 transition-colors ${
                    activeId === c._id ? 'bg-blue-50/70' : ''
                  }`}
                >
                  <p className="text-sm font-semibold text-navy-900">{other?.name || 'FixMate User'}</p>
                  {c.bookingId && (
                    <p className="text-[11px] font-mono text-electric-600 mt-0.5">
                      {c.bookingId.bookingCode} · {c.bookingId.problemTitle}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-1 truncate">{c.lastMessage || 'Conversation started'}</p>
                </button>
              );
            })
          )}
        </aside>

        <section className="md:col-span-8 flex flex-col h-full">
          {!activeId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-6">
              <MessageSquare className="w-8 h-8 mb-2" />
              <p className="text-sm">Select a conversation to view messages</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50/50">
                {messages.map((m) => {
                  const mine = m.senderId?._id === user?.id;
                  return (
                    <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-md px-4 py-2.5 rounded-2xl text-sm ${
                          mine
                            ? 'bg-navy-900 text-white'
                            : 'bg-white border border-slate-200 text-slate-800'
                        }`}
                      >
                        <p>{m.text}</p>
                        <p className={`text-[10px] mt-1 font-mono ${mine ? 'text-slate-300' : 'text-slate-400'}`}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={handleSend} className="p-3 border-t border-slate-200 bg-white flex gap-2">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write a message to your technician or customer..."
                  className="flex-1 px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-electric-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold rounded-xl inline-flex items-center gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
