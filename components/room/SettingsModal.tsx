'use client';

import { Clock3, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  gridOptions: Array<{ label: string }>;
  selectedGridIndex: number;
  onGridChange: (index: number) => void;
  playerCount: number;
  onPlayerCountChange: (value: number) => void;
  autoMoveEnabled: boolean;
  toggleAutoMove: () => void;
  onSave: () => void;
}

export function SettingsModal({
  open,
  onClose,
  gridOptions,
  selectedGridIndex,
  onGridChange,
  playerCount,
  onPlayerCountChange,
  autoMoveEnabled,
  toggleAutoMove,
  onSave,
}: SettingsModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 px-4 py-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md rounded-[32px] border border-white/30 bg-slate-950/90 p-6 shadow-[0_40px_80px_rgba(0,0,0,0.65)]">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-white">
            Room Settings
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/40 bg-white/30 p-2 text-white cursor-pointer"
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5">
          <p className="text-[9px] uppercase tracking-[0.4em] text-slate-300">
            Grid size
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {gridOptions.map((grid, index) => (
              <button
                key={grid.label}
                type="button"
                onClick={() => onGridChange(index)}
                className={`rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] transition cursor-pointer ${selectedGridIndex === index
                  ? 'border-emerald-300 bg-emerald-300/20 text-emerald-200'
                  : 'border-white/30 bg-white/10 text-white/70'
                  }`}
              >
                {grid.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <p className="text-[9px] uppercase tracking-[0.4em] text-slate-300">
            Players
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {Array.from({ length: 7 }, (_, idx) => idx + 2).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onPlayerCountChange(value)}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] transition cursor-pointer ${playerCount === value
                  ? 'border-sky-400 bg-sky-400/20 text-sky-100'
                  : 'border-white/30 bg-white/10 text-white/60'
                  }`}
              >
                {value}P
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
          <div>
            <p className="text-[9px] uppercase tracking-[0.4em] text-slate-300">
              Auto move
            </p>
            <p className="text-[11px] font-semibold text-white/90">
              {autoMoveEnabled ? 'Enabled (30s)' : 'Disabled'}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleAutoMove}
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] transition cursor-pointer ${autoMoveEnabled
              ? 'border-emerald-300 bg-emerald-300/20 text-emerald-100'
              : 'border-white/30 bg-white/10 text-white/60'
              }`}
          >
            <Clock3 className="h-4 w-4" />
            {autoMoveEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        <p className="mt-4 text-[9px] uppercase tracking-[0.35em] text-white/70">
          Auto move picks a random edge after the timer expires.
        </p>

        <Button
          onClick={onSave}
          className="mt-6 w-full rounded-full border-0 bg-black px-6 py-3 text-base font-semibold tracking-[0.35em] text-white shadow-[0_15px_30px_rgba(0,0,0,0.45)] hover:-translate-y-0.5 hover:bg-slate-900 cursor-pointer"
        >
          Save
        </Button>
      </div>
    </div>
  );
}
