'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GameEngine } from '@/lib/game-engine';
import { GRID_SIZES, MIN_PLAYERS, MAX_PLAYERS } from '@/lib/constants';

export default function CreateGame() {
  const router = useRouter();
  const [gridSize, setGridSize] = useState(GRID_SIZES[0]);
  const [playerCount, setPlayerCount] = useState(2);

  const handleCreate = () => {
    const roomId = GameEngine.generateRoomId();
    
    // Create initial players
    const players = Array.from({ length: playerCount }, (_, i) =>
      GameEngine.createPlayer(`player-${i}`, `Player ${i + 1}`, i)
    );

    // Create game state
    const gameState = GameEngine.createInitialState(gridSize, players);

    // Store in session storage for this browser tab
    const roomData = {
      id: roomId,
      gridSize,
      playerCount,
      gameState,
      players,
      createdAt: Date.now(),
    };

    // Store room in localStorage with room ID key
    const roomsData = JSON.parse(localStorage.getItem('game-rooms') || '{}');
    roomsData[roomId] = roomData;
    localStorage.setItem('game-rooms', JSON.stringify(roomsData));
    localStorage.setItem(`room-${roomId}`, JSON.stringify(roomData));

    // Redirect to room
    router.push(`/room/${roomId}`);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Navigation Header */}
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 hover:opacity-80">
            Dots & Boxes
          </Link>
          <div className="flex gap-2">
            <Link href="/">
              <Button variant="ghost" className="text-slate-300 hover:text-white">Back</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
            <div className="p-8">
              <h1 className="text-3xl font-bold text-slate-100 mb-2">Create Game</h1>
              <p className="text-slate-400 mb-8">Configure your game settings</p>

              {/* Grid Size Selection */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-slate-300 mb-4">
                  Grid Size
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {GRID_SIZES.map((size) => (
                    <button
                      key={size.label}
                      onClick={() => setGridSize(size)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        gridSize.label === size.label
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                      }`}
                    >
                      <div className="font-semibold text-slate-100">{size.label}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        {(size.rows - 1) * (size.cols - 1)} squares
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Player Count Selection */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-slate-300 mb-4">
                  Number of Players: <span className="text-blue-400">{playerCount}</span>
                </label>
                <input
                  type="range"
                  min={MIN_PLAYERS}
                  max={MAX_PLAYERS}
                  value={playerCount}
                  onChange={(e) => setPlayerCount(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-2">
                  <span>{MIN_PLAYERS}</span>
                  <span>{MAX_PLAYERS}</span>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-8">
                <p className="text-sm text-slate-400 mb-2">Game Summary:</p>
                <div className="flex justify-between text-slate-200">
                  <span>Grid: <span className="text-blue-400">{gridSize.label}</span></span>
                  <span>Players: <span className="text-blue-400">{playerCount}</span></span>
                  <span>Squares: <span className="text-blue-400">{(gridSize.rows - 1) * (gridSize.cols - 1)}</span></span>
                </div>
              </div>

              {/* Create Button */}
              <Button
                onClick={handleCreate}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-lg rounded-xl"
              >
                Create Game
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
