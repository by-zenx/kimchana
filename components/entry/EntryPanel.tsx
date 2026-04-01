'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Clock3,
  Info,
  Settings2,
  User,
  X,
} from 'lucide-react';
import { GameEngine } from '@/lib/game-engine';
import { GRID_SIZES, MAX_PLAYERS, MIN_PLAYERS, PLAYER_COLORS } from '@/lib/constants';

type EntryMode = 'join' | 'create';

interface EntryPanelProps {
  initialMode?: EntryMode;
}

const infoPoints = [
  'Rooms lock at 8 players to keep matches concise.',
  'Complete a square to earn a point and a bonus turn.',
  'If you miss a move, a random edge will trigger after the timer.',
];

export function EntryPanel({ initialMode = 'join' }: EntryPanelProps) {
  const [mode, setMode] = useState<EntryMode>(initialMode);
  const [infoOpen, setInfoOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [formData, setFormData] = useState({
    roomCode: '',
    playerName: '',
  });
  const [generatedRoomCode, setGeneratedRoomCode] = useState('');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [selectedGridIndex, setSelectedGridIndex] = useState(0);
  const [playerCount, setPlayerCount] = useState(MIN_PLAYERS);
  const [autoMoveEnabled, setAutoMoveEnabled] = useState(false);

  const router = useRouter();

  const gridOptions = GRID_SIZES.slice(0, 3);
  const selectedGrid =
    gridOptions[selectedGridIndex] ?? GRID_SIZES[0];

  const toggleInfo = () => {
    setSettingsOpen(false);
    setInfoOpen((prev) => !prev);
  };

  const toggleSettings = () => {
    setInfoOpen(false);
    setSettingsOpen((prev) => !prev);
  };

  const handleCopyCode = async () => {
    if (!generatedRoomCode) {
      return;
    }
    try {
      await navigator.clipboard.writeText(generatedRoomCode);
      setCopyStatus('Copied!');
      setTimeout(() => setCopyStatus(''), 2000);
    } catch {
      setCopyStatus('Failed to copy');
      setTimeout(() => setCopyStatus(''), 2000);
    }
  };

  const ctaLabel = mode === 'join' ? 'Join Game' : 'Create Room';
  const helperText =
    mode === 'join'
      ? 'You can join an active lobby with the host-provided code.'
      : 'Create a room, then share the code with friends.';

  const handleInputChange =
    (field: 'roomCode' | 'playerName') =>
      (event: React.ChangeEvent<HTMLInputElement>) => {
        setFormData((prev) => ({ ...prev, [field]: event.target.value }));
      };

  const handleGenerateCode = useCallback(async () => {
    setIsGeneratingCode(true);
    try {
      const response = await fetch('/api/rooms/code');
      if (response.ok) {
        const { roomId } = await response.json();
        setCopyStatus('');
        setGeneratedRoomCode(roomId);
      }
    } finally {
      setIsGeneratingCode(false);
    }
  }, []);

  useEffect(() => {
    if (mode === 'create') {
      handleGenerateCode();
    } else {
      setGeneratedRoomCode('');
      setCopyStatus('');
    }
  }, [mode, handleGenerateCode]);

  useEffect(() => {
    if (mode !== 'create') {
      setSettingsOpen(false);
    }
  }, [mode]);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, roomCode: '' }));
  }, [mode]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formData.playerName.trim()) {
      return;
    }

    if (mode === 'join') {
      if (!formData.roomCode.trim()) {
        return;
      }
      const code = formData.roomCode.toUpperCase();
      const roomsData = JSON.parse(localStorage.getItem('game-rooms') || '{}');
      const room = roomsData[code];
      if (!room) {
        alert('Room not found locally yet.');
        return;
      }
      router.push(`/room/${code}`);
      return;
    }

    if (!generatedRoomCode) {
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        body: JSON.stringify({
          roomId: generatedRoomCode,
          playerName: formData.playerName.trim(),
          gridRows: GRID_SIZES[selectedGridIndex].rows,
          gridCols: GRID_SIZES[selectedGridIndex].cols,
          playerCount,
          autoMoveEnabled,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Failed to create room');
        return;
      }

      const playersPayload = Array.from({ length: playerCount }, (_, i) =>
        GameEngine.createPlayer(`player-${i}`, `Player ${i + 1}`, i, i),
      );
      playersPayload[0].name = formData.playerName.trim();

      const gameState = GameEngine.createInitialState(
        GRID_SIZES[selectedGridIndex],
        playersPayload,
      );

      const roomData = {
        id: generatedRoomCode,
        gridSize: GRID_SIZES[selectedGridIndex],
        playerCount,
        createdAt: Date.now(),
        players: playersPayload,
        gameState,
      };

      const roomsData = JSON.parse(localStorage.getItem('game-rooms') || '{}');
      roomsData[generatedRoomCode] = roomData;
      localStorage.setItem('game-rooms', JSON.stringify(roomsData));
      localStorage.setItem(`room-${generatedRoomCode}`, JSON.stringify(roomData));

      router.push(`/room/${generatedRoomCode}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <section className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10">
      <div className="relative w-full max-w-sm">
        <div className="rounded-[42px] border-4 border-black/70 bg-white/80 p-0 shadow-[0_40px_70px_rgba(2,35,26,0.75)]">
          <div className="relative overflow-hidden rounded-[38px] border-2 border-black bg-gradient-to-b from-[#00d4c5] via-[#00b8ad] to-[#02a5a3] p-6">
            <button
              type="button"
              onClick={toggleInfo}
              className="absolute top-4 right-4 z-30 rounded-full border border-white/60 bg-white/80 p-1 text-slate-900 shadow-sm transition hover:scale-105 cursor-pointer"
              aria-expanded={infoOpen}
              aria-label="Toggle quick rules"
            >
              {infoOpen ? <X className="h-4 w-4" /> : <Info className="h-4 w-4" />}
            </button>

            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-[10px] tracking-[0.5em] text-slate-900/70">
                D &amp; B
              </span>
              <h1 className="text-4xl font-black uppercase tracking-[0.45em] text-slate-900 drop-shadow">
                WELCOME!
              </h1>
              <p className="max-w-[220px] text-xs font-semibold text-slate-900/80">
                Every lobby here is a dream, and we make dreams come true.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.35em] text-slate-900/70">
              <button
                type="button"
                onClick={() => setMode('join')}
                className={`rounded-full border border-slate-900/50 px-4 py-1 transition cursor-pointer ${
                  mode === 'join'
                    ? 'bg-black/80 text-white shadow-[0_5px_15px_rgba(0,0,0,0.5)]'
                    : 'bg-white/50 text-slate-900/80'
                }`}
              >
                Join
              </button>
              <button
                type="button"
                onClick={() => setMode('create')}
                className={`rounded-full border border-slate-900/50 px-4 py-1 transition cursor-pointer ${
                  mode === 'create'
                    ? 'bg-black/80 text-white shadow-[0_5px_15px_rgba(0,0,0,0.5)]'
                    : 'bg-white/50 text-slate-900/80'
                }`}
              >
                Create
              </button>
            </div>

            {mode === 'create' && (
              <div className="mt-4 flex items-center justify-between gap-2 text-[8px] uppercase tracking-[0.45em] text-slate-900/80">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/40 bg-white/80 px-2 py-1 font-semibold text-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                    {selectedGrid.label}
                  </span>
                  <span className="rounded-full border border-white/40 bg-white/80 px-2 py-1 font-semibold text-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                    {playerCount}P
                  </span>
                  <span
                    className={`rounded-full border px-2 py-1 font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.25)] ${
                      autoMoveEnabled ? 'border-green-400 bg-green-400/20 text-green-900' : 'border-slate-900/30 bg-white/60 text-slate-900/70'
                    }`}
                  >
                    <Clock3 className="inline h-3 w-3" />
                    <span className="ml-1 ">
                      {autoMoveEnabled ? 'Auto 30s' : 'Timer off'}
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleSettings}
                  className="rounded-full border border-white/80 bg-black/80 p-2 text-white transition hover:scale-105 cursor-pointer"
                  aria-label="Edit room settings"
                >
                  <Settings2 className="h-4 w-4" />
                </button>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="mt-4 flex flex-col gap-4"
              aria-label={mode === 'join' ? 'Join game' : 'Create game'}
            >
              <label className="text-[10px] tracking-[0.4em] text-slate-900/80 font-extrabold uppercase">
                {mode === 'join' ? 'Enter room code' : 'Room code'}
                <div className="mt-1 flex items-center gap-3 rounded-[999px] bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-[0_12px_25px_rgba(0,0,0,0.1)] focus-within:ring-2 focus-within:ring-white/80">
                  {mode === 'create' ? (
                    <span className="flex-1 text-center text-base font-semibold tracking-[0.3em]">
                      {isGeneratingCode
                        ? 'Generating...'
                        : generatedRoomCode || 'Waiting for code…'}
                    </span>
                  ) : (
                    <Input
                      name="roomCode"
                      aria-label="Enter room code"
                      placeholder="AB12CD"
                      value={formData.roomCode}
                      onChange={handleInputChange('roomCode')}
                      className="border-0 !bg-transparent shadow-none px-0 py-0 text-sm font-semibold text-slate-900 placeholder:text-slate-500 focus-visible:ring-0 focus-visible:border-0"
                    />
                  )}
                  {mode === 'create' && (
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      disabled={!generatedRoomCode || isGeneratingCode}
                      className="rounded-full border border-slate-900/30 bg-slate-900/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-white transition hover:-translate-y-0.5 disabled:opacity-40 cursor-pointer"
                    >
                      {copyStatus || 'Copy'}
                    </button>
                  )}
                </div>
              </label>

              <label className="text-[10px] tracking-[0.4em] text-slate-900/80 font-extrabold uppercase">
                Enter player name
                <div className="mt-1 flex items-center gap-3 rounded-[999px] bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-[0_12px_25px_rgba(0,0,0,0.1)] focus-within:ring-2 focus-within:ring-white/80">
                  <User className="h-4 w-4 text-slate-900/80" />
                  <Input
                    name="playerName"
                    aria-label="Enter player name"
                    placeholder="Player 1"
                    value={formData.playerName}
                    onChange={handleInputChange('playerName')}
                    className="border-0 !bg-transparent shadow-none px-0 py-0 text-sm font-semibold text-slate-900 placeholder:text-slate-500 focus-visible:ring-0 focus-visible:border-0"
                  />
                </div>
              </label>

              <Button
                type="submit"
                className="mt-2 rounded-full border-0 bg-black px-8 py-3 text-base font-semibold tracking-[0.35em] text-white shadow-[0_15px_30px_rgba(0,0,0,0.45)] duration-200 hover:-translate-y-0.5 hover:bg-slate-900 cursor-pointer"
                disabled={mode === 'create' ? isCreating || !generatedRoomCode : false}
              >
                {mode === 'create'
                  ? isCreating
                    ? 'Creating…'
                    : ctaLabel
                  : ctaLabel}
              </Button>
            </form>

            <p className="mt-4 text-center text-[11px] font-semibold uppercase tracking-[0.55em] text-slate-900/70">
              {helperText}
            </p>
            <div
              className={`absolute inset-6 z-20 rounded-[28px] border border-white/30 bg-black/90 p-5 text-[10px] uppercase tracking-[0.3em] text-slate-100 shadow-[0_40px_70px_rgba(0,0,0,0.75)] transition duration-300 ${
                infoOpen
                  ? 'translate-y-0 opacity-100'
                  : 'translate-y-full opacity-0 pointer-events-none'
              }`}
              style={{ transformOrigin: 'bottom center' }}
              aria-hidden={!infoOpen}
            >
              <p className="mb-3 text-[12px] font-semibold tracking-[0.55em] text-white">
                Quick Rules
              </p>
              <ul className="space-y-2 text-[10px] leading-snug text-slate-200">
                {infoPoints.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-white"></span>
                    <span className="text-left">{point}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70">
                Tap the info icon to close
              </p>
            </div>
          </div>
        </div>
        {settingsOpen && (
          <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/60 px-4 py-6">
            <div className="w-full max-w-sm rounded-[32px] border border-white/30 bg-slate-950/90 p-6 shadow-[0_40px_80px_rgba(0,0,0,0.65)]">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-white">
                  Room Settings
                </p>
                <button
                  type="button"
                  onClick={toggleSettings}
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
                      onClick={() => setSelectedGridIndex(index)}
                      className={`rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] transition cursor-pointer ${
                        selectedGridIndex === index
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
                  {Array.from(
                    { length: MAX_PLAYERS - MIN_PLAYERS + 1 },
                    (_, idx) => MIN_PLAYERS + idx,
                  ).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPlayerCount(value)}
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] transition cursor-pointer ${
                        playerCount === value
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
                  onClick={() => setAutoMoveEnabled((prev) => !prev)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] transition cursor-pointer ${
                    autoMoveEnabled
                      ? 'border-emerald-300 bg-emerald-300/20 text-emerald-100'
                      : 'border-white/30 bg-white/10 text-white/60'
                  }`}
                >
                  <Clock3 className="h-4 w-4" />
                  {autoMoveEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              <p className="mt-4 text-[9px] uppercase tracking-[0.35em] text-white/70">
                Auto move picks a random edge after the 30s timer expires.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default EntryPanel;
