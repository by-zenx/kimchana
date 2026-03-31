'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { GameBoard } from '@/components/game/GameBoard';
import { PlayerList } from '@/components/game/PlayerList';
import { GameStatus } from '@/components/game/GameStatus';
import { Room } from '@/lib/types';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = (params.roomId as string).toUpperCase();
  
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load room data on mount
  useEffect(() => {
    const roomsData = JSON.parse(localStorage.getItem('game-rooms') || '{}');
    const foundRoom = roomsData[roomId];

    if (!foundRoom) {
      setError(`Room "${roomId}" not found`);
      setLoading(false);
      return;
    }

    setRoom(foundRoom);
    setLoading(false);

    // Set up polling to sync room updates
    const interval = setInterval(() => {
      const updatedRoomsData = JSON.parse(localStorage.getItem('game-rooms') || '{}');
      const updatedRoom = updatedRoomsData[roomId];
      if (updatedRoom) {
        setRoom(updatedRoom);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [roomId]);

  // Update room in localStorage
  const updateRoom = (newRoom: Room) => {
    setRoom(newRoom);
    const roomsData = JSON.parse(localStorage.getItem('game-rooms') || '{}');
    roomsData[roomId] = newRoom;
    localStorage.setItem('game-rooms', JSON.stringify(roomsData));
    localStorage.setItem(`room-${roomId}`, JSON.stringify(newRoom));
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-slate-300">Loading room...</p>
        </div>
      </main>
    );
  }

  if (error || !room) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <Link href="/" className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 hover:opacity-80">
              Dots & Boxes
            </Link>
          </div>
        </header>
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <div className="text-center">
            <p className="text-red-400 text-lg mb-4">{error}</p>
            <Link href="/">
              <Button className="bg-blue-600 hover:bg-blue-700">Return Home</Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <Link href="/" className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 hover:opacity-80">
              Dots & Boxes
            </Link>
            <p className="text-xs text-slate-400 mt-1">Room: <span className="text-blue-400 font-mono font-semibold">{roomId}</span></p>
          </div>
          <Link href="/">
            <Button variant="ghost" className="text-slate-300 hover:text-white">Exit</Button>
          </Link>
        </div>
      </header>

      {/* Game Content */}
      <div className="flex-1 flex gap-6 p-6 max-w-7xl mx-auto w-full">
        {/* Left Sidebar - Player List */}
        <div className="w-64 flex-shrink-0">
          <PlayerList 
            players={room.players} 
            currentPlayerIndex={room.gameState.currentPlayerIndex}
            gameStatus={room.gameState.status}
            winnerId={room.gameState.winnerId}
          />
        </div>

        {/* Center - Game Board */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
          {room.gameState.status === 'lobby' ? (
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-100 mb-4">
                Waiting for Players...
              </h2>
              <p className="text-slate-400 mb-6">
                {room.players.length} of {room.playerCount} players ready
              </p>
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 mb-6 w-full max-w-md">
                <p className="text-sm text-slate-400 mb-2">Share Room ID:</p>
                <div className="bg-slate-800 border border-slate-700 rounded px-4 py-3 font-mono text-2xl font-bold text-blue-400 text-center">
                  {roomId}
                </div>
              </div>
              {room.players.length === room.playerCount && (
                <Button
                  onClick={() => {
                    const newRoom = {
                      ...room,
                      gameState: { ...room.gameState, status: 'playing' as const }
                    };
                    updateRoom(newRoom);
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Start Game
                </Button>
              )}
            </div>
          ) : room.gameState.status === 'finished' ? (
            <div className="text-center">
              <h2 className="text-4xl font-bold text-slate-100 mb-4">
                Game Over!
              </h2>
              <p className="text-2xl text-slate-300 mb-8">
                {room.players.find(p => p.id === room.gameState.winnerId)?.name} Wins!
              </p>
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 mb-8 w-full max-w-md">
                <h3 className="text-slate-200 font-semibold mb-4">Final Scores</h3>
                <div className="space-y-2">
                  {[...room.players].sort((a, b) => b.score - a.score).map((p, i) => (
                    <div key={p.id} className="flex justify-between items-center text-slate-300">
                      <span>{i + 1}. {p.name}</span>
                      <span className="font-bold">{p.score}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Link href="/create">
                <Button className="bg-blue-600 hover:bg-blue-700">Play Again</Button>
              </Link>
            </div>
          ) : (
            <GameBoard 
              room={room}
              onUpdateRoom={updateRoom}
            />
          )}
        </div>

        {/* Right Sidebar - Game Status */}
        <div className="w-64 flex-shrink-0">
          <GameStatus 
            gameState={room.gameState}
            players={room.players}
          />
        </div>
      </div>
    </main>
  );
}
