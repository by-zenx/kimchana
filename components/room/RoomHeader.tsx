'use client';

import {
  Copy,
  Info,
  MessageCircle,
  Settings2,
  Users,
  X,
} from 'lucide-react';

interface RoomHeaderProps {
  statusLabel: string;
  roomId?: string;
  copyStatus: string;
  onCopyRoomId: () => void;
  onChatToggle: () => void;
  onInfoToggle: () => void;
  onPlayerListToggle: () => void;
  onSettingsClick: () => void;
  canEditSettings: boolean;
  isPlaying: boolean;
  infoOpen: boolean;
}

export function RoomHeader({
  statusLabel,
  roomId,
  copyStatus,
  onCopyRoomId,
  onChatToggle,
  onInfoToggle,
  onPlayerListToggle,
  onSettingsClick,
  canEditSettings,
  isPlaying,
  infoOpen,
}: RoomHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-[10px] tracking-[0.5em] text-slate-900/70">D &amp; B</span>
        <h1 className="text-4xl font-black uppercase tracking-[0.45em] text-white drop-shadow">
          {statusLabel}
        </h1>
        <p className="text-xs uppercase tracking-[0.4em] text-white/80">
          Room / {roomId ?? '??????'}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCopyRoomId}
          className="rounded-full border border-slate-900/50 px-4 py-1 text-[11px] uppercase tracking-[0.35em] bg-white/50 text-slate-900/80 transition cursor-pointer hover:bg-white/70"
        >
          <Copy className="inline h-3 w-3 mr-2" />
          {copyStatus || 'Copy Code'}
        </button>
        <button
          type="button"
          onClick={onPlayerListToggle}
          className="rounded-full border border-white/80 bg-black/80 p-2 text-white transition hover:scale-105 cursor-pointer"
          aria-label="Show players"
        >
          <Users className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onChatToggle}
          className="rounded-full border border-white/80 bg-black/80 p-2 text-white transition hover:scale-105 cursor-pointer"
          aria-label="Show chat"
        >
          <MessageCircle className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onSettingsClick}
          className={`rounded-full border border-white/80 bg-black/80 p-2 text-white transition hover:scale-105 cursor-pointer ${!canEditSettings && isPlaying ? 'opacity-60' : ''
            }`}
          aria-label="Toggle room settings"
        >
          <Settings2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onInfoToggle}
          className="rounded-full border border-white/60 bg-white/80 p-1 text-slate-900 shadow-sm transition hover:scale-105 cursor-pointer"
          aria-expanded={infoOpen}
          aria-label="Toggle quick rules"
        >
          {infoOpen ? <X className="h-4 w-4" /> : <Info className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
