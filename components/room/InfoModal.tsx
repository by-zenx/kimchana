'use client';

import { Room } from '@/lib/types';

interface InfoModalProps {
  open: boolean;
  room?: Room | null;
}

export function InfoModal({ open, room }: InfoModalProps) {
  return (
    <div
      className={`absolute inset-6 z-20 max-w-sm rounded-[28px] border border-white/30 bg-black/90 p-5 text-[10px] uppercase tracking-[0.3em] text-slate-100 shadow-[0_40px_70px_rgba(0,0,0,0.75)] transition duration-300 ${open
        ? 'translate-y-0 opacity-100'
        : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      style={{ transformOrigin: 'bottom center' }}
      aria-hidden={!open}
    >
      <p className="mb-3 text-[12px] font-semibold tracking-[0.55em] text-white">
        Quick Rules
      </p>
      <ul className="space-y-2 text-[10px] leading-snug text-slate-200">
        <li className="flex gap-2">
          <span className="inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-white"></span>
          <span className="text-left">Rooms hold up to {room?.maxPlayers ?? 8} dreamers.</span>
        </li>
        <li className="flex gap-2">
          <span className="inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-white"></span>
          <span className="text-left">Grab an edge-if it closes a square you keep the turn.</span>
        </li>
        <li className="flex gap-2">
          <span className="inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-white"></span>
          <span className="text-left">Timer auto-picks a random edge when you pause too long.</span>
        </li>
      </ul>
      <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70">
        Tap the info icon to close
      </p>
    </div>
  );
}
