'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PLAYER_COLORS } from '@/lib/constants';

export default function JoinGame() {
  const router = useRouter();
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [selectedColor, setSelectedColor] = useState(0);
  const [error, setError] = useState('');

  const handleJoin = () => {
    setError('');

    if (!roomId.trim()) {
      setError('Please enter a room ID');
      return;
    }

    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    // Try to find the room
    const roomsData = JSON.parse(localStorage.getItem('game-rooms') || '{}');
    const room = roomsData[roomId.toUpperCase()];

    if (!room) {
      setError(`Room "${roomId}" not found`);
      return;
    }

    // Redirect to room
    router.push(`/room/${roomId.toUpperCase()}`);
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
        <div className="w-full max-w-md">
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
            <div className="p-8">
              <h1 className="text-3xl font-bold text-slate-100 mb-2">Join Game</h1>
              <p className="text-slate-400 mb-8">Enter your room details below</p>

              {/* Error Message */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
                  {error}
                </div>
              )}

              {/* Room ID Input */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Room ID
                </label>
                <Input
                  type="text"
                  placeholder="e.g., ABC123"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  className="bg-slate-800/50 border-slate-700 text-slate-100 placeholder-slate-500 uppercase"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Ask the game creator for the room ID
                </p>
              </div>

              {/* Player Name Input */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Your Name
                </label>
                <Input
                  type="text"
                  placeholder="Enter your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="bg-slate-800/50 border-slate-700 text-slate-100 placeholder-slate-500"
                />
              </div>

              {/* Join Button */}
              <Button
                onClick={handleJoin}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-lg rounded-xl"
              >
                Join Game
              </Button>

              {/* Divider */}
              <div className="my-6 flex items-center gap-4">
                <div className="flex-1 border-t border-slate-700"></div>
                <span className="text-xs text-slate-500">OR</span>
                <div className="flex-1 border-t border-slate-700"></div>
              </div>

              {/* Create New Game Link */}
              <Link href="/create" className="w-full">
                <Button
                  variant="outline"
                  className="w-full h-12 border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  Create New Game Instead
                </Button>
              </Link>
            </div>
          </Card>

          {/* Quick Info */}
          <div className="mt-6 bg-slate-900/50 border border-slate-800 rounded-lg p-4 text-sm text-slate-400">
            <p className="mb-2 font-semibold text-slate-300">💡 Tips:</p>
            <ul className="space-y-1 text-xs">
              <li>• Get the room ID from the game creator</li>
              <li>• You can only join games that are in the lobby</li>
              <li>• All players must join before the game starts</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
