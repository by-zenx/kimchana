'use client';

import { X } from 'lucide-react';
import { Room } from '@/lib/types';

interface PlayersModalProps {
  open: boolean;
  players: Room['players'];
  playerCount?: number;
  connectionLabel: string;
  currentPlayerId?: string;
  onClose: () => void;
}

export function PlayersModal({
  open,
  players,
  playerCount,
  connectionLabel,
  currentPlayerId,
  onClose,
}: PlayersModalProps) {
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
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-white">Players</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/40 bg-white/30 p-2 text-white cursor-pointer"
            aria-label="Close players"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {players.map((player) => (
            <div key={player.id} className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: player.color }}
                  />
                  <div>
                    <p className="text-sm font-semibold text-white">{player.name}</p>
                    <p className="text-[10px] uppercase tracking-[0.4em] text-white/70">
                      P{player.order + 1} • {player.isHost ? 'Host' : 'Guest'}
                    </p>
                  </div>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={(event) => {
                      const paletteId = `palette-${player.id}`;
                      const existingPalette = document.getElementById(paletteId);
                      if (existingPalette) {
                        existingPalette.remove();
                        return;
                      }
                      document.querySelectorAll('[id^="palette-"]').forEach((el) => el.remove());

                      const palette = document.createElement('div');
                      palette.id = paletteId;
                      palette.className =
                        'absolute left-0 top-full mt-2 bg-slate-900/95 rounded-lg p-3 border border-white/20 shadow-lg z-50 min-w-[200px]';

                      const colors = [
                        '#ef4444',
                        '#f97316',
                        '#eab308',
                        '#84cc16',
                        '#22c55e',
                        '#14b8a6',
                        '#06b6d4',
                        '#3b82f6',
                        '#6366f1',
                        '#a855f7',
                        '#ec4899',
                        '#f43f5e',
                      ];
                      const colorButtons = colors
                        .map((color) => {
                          const isTaken = players.some(
                            (p) => p.id !== player.id && p.color === color,
                          );
                          const isCurrent = player.color === color;
                          const takenBy = players.find((p) => p.color === color);

                          return (
                            '<div class="relative group">' +
                            '<button ' +
                            'class="w-6 h-6 rounded-full transition-all ' +
                            (isCurrent ? 'scale-110' : 'hover:scale-110') +
                            '" style="background-color: ' +
                            color +
                            ';' +
                            (isCurrent
                              ? 'box-shadow: 0 0 0 2px #1e293b, 0 0 0 4px white;'
                              : '') +
                            '"' +
                            (player.id === currentPlayerId &&
                            !isTaken &&
                            !isCurrent
                              ? ' onclick="window.changePlayerColor(\'' +
                                color +
                                '\')"'
                              : isTaken || isCurrent
                                ? ' disabled'
                                : '') +
                            ' title="' +
                            (isTaken
                              ? 'Taken by ' + (takenBy?.name || 'another player')
                              : isCurrent
                                ? 'Your current color'
                                : 'Available - Click to select') +
                            '"' +
                            '/>' +
                            (isTaken && !isCurrent
                              ? '<div class="absolute inset-0 rounded-full pointer-events-none flex items-center justify-center" style="border: 2px solid rgba(255,255,255,0.6);"><div style="position:absolute;width:60%;height:2px;background:rgba(255,255,255,0.7);transform:rotate(45deg);border-radius:1px;"></div><div style="position:absolute;width:60%;height:2px;background:rgba(255,255,255,0.7);transform:rotate(-45deg);border-radius:1px;"></div></div>'
                                : '') +
                            '</div>'
                          );
                        })
                        .join('');

                      palette.innerHTML =
                        '<div class="text-[11px] font-semibold text-white mb-3 text-center">' +
                        (player.id === currentPlayerId ? 'Choose Your Color' : 'Player Colors') +
                        '</div>' +
                        '<div class="grid grid-cols-6 gap-2 mb-3">' +
                        colorButtons +
                        '</div>' +
                        '<div class="text-[9px] text-white/60 text-center">' +
                        (player.id === currentPlayerId ? 'Click an available color' : 'Viewing only') +
                        '</div>';

                      event.currentTarget.parentElement?.appendChild(palette);
                    }}
                    className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] rounded-full border transition cursor-pointer ${player.id === currentPlayerId
                      ? 'border-white/40 bg-white/20 text-white hover:bg-white/30'
                      : 'border-white/20 bg-white/10 text-white/60 cursor-not-allowed'
                      }`}
                    disabled={player.id !== currentPlayerId}
                  >
                    {player.id === currentPlayerId ? 'Change' : 'View'}
                  </button>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
                <span className="text-[9px] uppercase tracking-[0.4em] text-white/70">
                  {players.length ?? 0} / {playerCount ?? 2} Players
                </span>
                <span className="text-[9px] uppercase tracking-[0.4em] text-white/70">
                  {connectionLabel}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
