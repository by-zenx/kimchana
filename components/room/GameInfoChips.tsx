'use client';

import { Clock3 } from 'lucide-react';

interface GameInfoChipsProps {
  gridLabel: string;
  playerCountText: string;
  autoMoveEnabled: boolean;
}

export function GameInfoChips({ gridLabel, playerCountText, autoMoveEnabled }: GameInfoChipsProps) {
  return (
    <div className="space-y-4 mb-6">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="rounded-full border border-white/40 bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
          {gridLabel}
        </span>
        <span className="rounded-full border border-white/40 bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
          {playerCountText}
        </span>
        <span
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.25)] ${autoMoveEnabled ? 'border-green-400 bg-green-400/20 text-green-900' : 'border-slate-900/30 bg-white/60 text-slate-900/70'
            }`}
        >
          <Clock3 className="inline h-3 w-3 mr-1" />
          {autoMoveEnabled ? 'Auto 30s' : 'Timer off'}
        </span>
      </div>
    </div>
  );
}
