'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      {/* Navigation Header */}
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
            Dots & Boxes
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-2xl">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="mb-8">
              <div className="inline-block p-6 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-2xl border border-blue-500/30 backdrop-blur-sm">
                <div className="text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                  Dots & Boxes
                </div>
              </div>
            </div>
            <p className="text-xl text-slate-300 mb-2">
              A strategic multiplayer game where every move counts
            </p>
            <p className="text-sm text-slate-400">
              Play with 2-8 players, claim squares, and outsmart your opponents
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-4 mb-12">
            <Link href="/create" className="w-full">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white h-14 text-lg rounded-xl" size="lg">
                Create Game
              </Button>
            </Link>
            <Link href="/join" className="w-full">
              <Button 
                variant="outline" 
                className="w-full h-14 text-lg rounded-xl border-slate-600 text-slate-300 hover:bg-slate-800"
                size="lg"
              >
                Join Game
              </Button>
            </Link>
          </div>

          {/* Game Rules Section */}
          <div className="space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-slate-100 mb-4">How to Play</h2>
              <div className="space-y-3 text-sm text-slate-400">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500 flex items-center justify-center text-xs font-bold text-blue-400">
                    1
                  </div>
                  <p>
                    <span className="text-slate-300 font-medium">Create or join a game</span> with 2-8 players
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500 flex items-center justify-center text-xs font-bold text-blue-400">
                    2
                  </div>
                  <p>
                    <span className="text-slate-300 font-medium">Click edges</span> between dots to claim them
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500 flex items-center justify-center text-xs font-bold text-blue-400">
                    3
                  </div>
                  <p>
                    <span className="text-slate-300 font-medium">Complete a square</span> to earn a point and an extra turn
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500 flex items-center justify-center text-xs font-bold text-blue-400">
                    4
                  </div>
                  <p>
                    <span className="text-slate-300 font-medium">Last player standing wins!</span> Highest score takes the crown
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-slate-100 mb-3">Game Features</h3>
              <div className="grid grid-cols-2 gap-3 text-sm text-slate-400">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                  <span>2-8 Player Support</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                  <span>Customizable Grid Sizes</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400"></div>
                  <span>Real-Time Scoring</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                  <span>Turn-Based Gameplay</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
