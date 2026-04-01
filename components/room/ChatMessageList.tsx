'use client';

import { ChatMessage } from '@/lib/types';

interface ChatMessageListProps {
  messages: ChatMessage[];
}

export function ChatMessageList({ messages }: ChatMessageListProps) {
  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <div
          key={`${message.id}-${message.createdAt}`}
          className="rounded-2xl border border-white/20 bg-slate-900/70 p-3 text-sm text-white shadow-[0_10px_30px_rgba(2,12,23,0.6)]"
        >
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.5em] text-slate-400">
            <span>{message.playerName}</span>
            <span>
              {new Date(message.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          <p className="mt-2 text-sm text-white">{message.content}</p>
        </div>
      ))}
      {!messages.length && (
        <p className="text-center text-xs uppercase tracking-[0.4em] text-slate-500">
          No messages yet
        </p>
      )}
    </div>
  );
}
