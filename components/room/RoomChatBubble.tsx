'use client';

import { MessageCircle, Send, X } from 'lucide-react';

interface RoomChatBubbleProps {
  open: boolean;
  chatDraft: string;
  chatSending: boolean;
  onDraftChange: (value: string) => void;
  onOpen: () => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}

export function RoomChatBubble({
  open,
  chatDraft,
  chatSending,
  onDraftChange,
  onOpen,
  onClose,
  onSubmit,
}: RoomChatBubbleProps) {
  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="rounded-full border border-white/60 bg-black/80 p-3 text-white shadow-lg transition hover:scale-105 cursor-pointer"
        aria-label="Open chat"
      >
        <MessageCircle className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="rounded-[20px] border border-white/20 bg-white/90 p-3 shadow-xl min-w-[280px] max-w-[320px]">
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={chatDraft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Send a hint to your crew"
          className="flex-1 rounded-full border border-white/20 bg-white/80 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-white focus:outline-none"
          autoFocus
        />
        <button
          type="submit"
          disabled={chatSending}
          className="rounded-full border border-slate-900/30 bg-slate-900/80 p-2 text-white transition hover:scale-105 disabled:opacity-40"
          aria-label="Send chat"
        >
          <Send className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/60 bg-white/60 p-2 text-slate-900 transition hover:scale-105"
          aria-label="Close chat bubble"
        >
          <X className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
