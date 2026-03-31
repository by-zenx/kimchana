'use client';

import { GameState, Player } from '@/lib/types';
import { Card } from '@/components/ui/card';

interface GameStatusProps {
  gameState: GameState;
  players: Player[];
}

export function GameStatus({ gameState, players }: GameStatusProps) {
  const totalSquares = (gameState.gridSize.rows - 1) * (gameState.gridSize.cols - 1);
  const claimedSquares = gameState.squares.filter((s) => s.ownerId !== null).length;
  const unclaimedSquares = totalSquares - claimedSquares;

  const currentPlayer = players[gameState.currentPlayerIndex];

  return (
    <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm sticky top-24 space-y-4">
      <div className="p-4">
        <h2 className="text-lg font-bold text-slate-100 mb-4">Game Info</h2>

        {/* Game Status */}
        <div className="mb-6 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
          <div className="text-xs text-slate-400 mb-1">Status</div>
          <div className="text-lg font-semibold capitalize text-slate-100">
            {gameState.status === 'playing' ? '🎮 Playing' : gameState.status === 'finished' ? '🏆 Finished' : '⏳ Lobby'}
          </div>
        </div>

        {/* Current Turn */}
        {gameState.status === 'playing' && (
          <div className="mb-6 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
            <div className="text-xs text-slate-400 mb-2">Current Turn</div>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: currentPlayer.color }}
              ></div>
              <div className="font-semibold text-slate-100">
                {currentPlayer.name}
              </div>
            </div>
          </div>
        )}

        {/* Grid Info */}
        <div className="mb-6 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
          <div className="text-xs text-slate-400 mb-2">Grid Size</div>
          <div className="text-sm font-semibold text-slate-100 mb-2">
            {gameState.gridSize.rows}×{gameState.gridSize.cols}
          </div>
          <div className="text-xs text-slate-500">
            {totalSquares} total squares
          </div>
        </div>

        {/* Progress Bar */}
        {gameState.status === 'playing' && (
          <div className="mb-6 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
            <div className="text-xs text-slate-400 mb-2">Progress</div>
            <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
                style={{ width: `${(claimedSquares / totalSquares) * 100}%` }}
              ></div>
            </div>
            <div className="text-xs text-slate-400 mt-2">
              {claimedSquares} / {totalSquares} squares claimed
            </div>
          </div>
        )}

        {/* Moves */}
        <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
          <div className="text-xs text-slate-400 mb-2">Moves</div>
          <div className="text-2xl font-bold text-slate-100">
            {gameState.moveHistory.length}
          </div>
        </div>
      </div>
    </Card>
  );
}
