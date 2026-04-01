'use client';

import { Send, X } from 'lucide-react';
import { ChatMessage } from '@/lib/types';
import { ChatMessageList } from '@/components/room/ChatMessageList';

interface ChatSheetProps {
  open: boolean;
  chatMessages: ChatMessage[];
  chatDraft: string;
  chatSending: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
}

export function ChatSheet({
  open,
  chatMessages,
  chatDraft,
  chatSending,
  onDraftChange,
  onSubmit,
  onClose,
}: ChatSheetProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 transition-opacity duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-md rounded-[42px] border-4 border-black/70 bg-white/80 p-0 shadow-[0_40px_70px_rgba(2,35,26,0.75)] transition-all duration-300 scale-95 opacity-0"
        style={{
          transform: open ? 'scale(1)' : 'scale(0.95)',
          opacity: open ? 1 : 0,
        }}
      >
        <div className="rounded-[38px] border-2 border-black bg-gradient-to-b from-[#00d4c5] via-[#00b8ad] to-[#02a5a3] p-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-900">Chat room</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/60 bg-white/80 p-2 text-slate-900 cursor-pointer transition-transform hover:scale-105"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 max-h-[60vh] overflow-y-auto space-y-3 text-sm custom-scrollbar">
            <ChatMessageList messages={chatMessages} />
          </div>
          <form onSubmit={onSubmit} className="mt-4 flex items-center gap-2">
            <input
              type="text"
              value={chatDraft}
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder="Message your crew"
              className="flex-1 rounded-full border border-white/20 bg-white/80 px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={chatSending}
              className="rounded-full border border-slate-900/30 bg-slate-900/80 p-2 text-white transition hover:scale-105 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
