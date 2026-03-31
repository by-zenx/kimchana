'use client';

import { Player } from '@/lib/types';
import { Card } from '@/components/ui/card';

interface PlayerListProps {
  players: Player[];
  currentPlayerIndex: number;
  gameStatus: 'lobby' | 'playing' | 'finished';
  winnerId: string | null;
}

export function PlayerList({
  players,
  currentPlayerIndex,
  gameStatus,
  winnerId,
}: PlayerListProps) {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm sticky top-24">
      <div className="p-4">
        <h2 className="text-lg font-bold text-slate-100 mb-4">Players</h2>

        <div className="space-y-3">
          {sortedPlayers.map((player, idx) => {
            const isCurrentPlayer = player.id === players[currentPlayerIndex]?.id;
            const isWinner = player.id === winnerId;

            return (
              <div
                key={player.id}
                className={`p-3 rounded-lg border-2 transition-all ${
                  isCurrentPlayer && gameStatus === 'playing'
                    ? 'border-slate-600 bg-slate-800/50 ring-2 ring-offset-2 ring-offset-slate-900'
                    : 'border-slate-700/50 bg-slate-800/20'
                }`}
                style={{
                  ringColor: player.color,
                  borderColor: isCurrentPlayer ? player.color : undefined,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: player.color }}
                  ></div>
                  <span className="text-sm font-semibold text-slate-100">
                    {player.name}
                  </span>
                  {isWinner && (
                    <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded border border-yellow-500/30 ml-auto">
                      Winner
                    </span>
                  )}
                  {isCurrentPlayer && gameStatus === 'playing' && (
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded border border-blue-500/30 ml-auto">
                      Active
                    </span>
                  )}
                </div>
                <div className="text-right text-2xl font-bold text-slate-200">
                  {player.score}
                </div>
              </div>
            );
          })}
        </div>

        {gameStatus === 'lobby' && (
          <div className="mt-4 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
            <p className="text-xs text-slate-400">
              Waiting for {players.length} players to join...
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
