'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { GameBoard } from '@/components/game/GameBoard';
import { GameEngine, SerializedGameState } from '@/lib/game-engine';
import { Room, GameState, ChatMessage } from '@/lib/types';
import { Clock3, Info, Send, Settings2 } from 'lucide-react';
import { GRID_SIZES } from '@/lib/constants';

type PlayerSession = {
  playerId: string;
  playerToken: string;
  playerName: string;
  isHost: boolean;
};

const GRID_OPTIONS = GRID_SIZES.slice(0, 3);

export default function RoomPage() {
  const params = useParams();
  const roomId = (params?.roomId as string)?.toUpperCase();
  const [room, setRoom] = useState<Room | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [playerSession, setPlayerSession] = useState<PlayerSession | null>(null);
  const [socketStatus, setSocketStatus] = useState<
    'idle' | 'connecting' | 'connected' | 'disconnected'
  >('idle');
  const [chatDraft, setChatDraft] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [selectedGridIndex, setSelectedGridIndex] = useState(0);
  const [playerCount, setPlayerCount] = useState(2);
  const [autoMoveEnabled, setAutoMoveEnabled] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');
  const socketRef = useRef<WebSocket | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const [hasFetchedRoom, setHasFetchedRoom] = useState(false);

  const currentGrid = useMemo(
    () => GRID_OPTIONS[selectedGridIndex] ?? GRID_OPTIONS[0],
    [selectedGridIndex],
  );

  useEffect(() => {
    if (!roomId) {
      return;
    }
    setHasFetchedRoom(false);
    setError('');
    let retry: ReturnType<typeof setTimeout> | null = null;
    let didCancel = false;

    const attempt = async () => {
      if (!roomId || didCancel) {
        return;
      }
      try {
        const response = await fetch(`/api/rooms/${roomId}`);
        if (!response.ok) {
          if (response.status === 400) {
            retry = setTimeout(attempt, 500);
            return;
          }
          setError('Room not found');
          setHasFetchedRoom(true);
          return;
        }
        const data = await response.json();
        const payload = data.room;
        const deserialized = GameEngine.deserializeState(
          payload.gameState as SerializedGameState,
        );
        setRoom({
          ...payload,
          gameState: deserialized,
        });
        setGameState(deserialized);
        setChatMessages(payload.chatMessages ?? []);
        const gridIndex = GRID_OPTIONS.findIndex(
          (grid) =>
            grid.rows === payload.gridSize.rows &&
            grid.cols === payload.gridSize.cols,
        );
        setSelectedGridIndex(gridIndex >= 0 ? gridIndex : 0);
        setPlayerCount(payload.playerCount);
        setAutoMoveEnabled(payload.autoMoveEnabled);
        setError('');
        setHasFetchedRoom(true);
      } catch {
        if (!didCancel) {
          setError('Unable to load room data');
          setHasFetchedRoom(true);
        }
      }
    };

    attempt();

    return () => {
      didCancel = true;
      if (retry) {
        clearTimeout(retry);
      }
    };
  }, [roomId]);

  const fetchChat = useCallback(async () => {
    if (!roomId) {
      return;
    }
    try {
      const response = await fetch(`/api/rooms/${roomId}/chat`);
      if (response.ok) {
        const { chatMessages } = await response.json();
        setChatMessages(chatMessages ?? []);
      }
    } catch (error) {
      console.error(error);
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId) {
      return;
    }
    const raw = localStorage.getItem(`room-${roomId}-session`);
    if (raw) {
      setPlayerSession(JSON.parse(raw));
    }
    fetchChat();
  }, [roomId, fetchChat]);

  const handleIncomingSocket = useCallback(
    (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'initial') {
          const payload = message.payload;
          const deserialized = GameEngine.deserializeState(
            payload.gameState as SerializedGameState,
          );
          setRoom({
            id: payload.room.id || roomId,
            hostId: payload.room.hostId,
            gridSize: payload.room.gridSize,
            playerCount: payload.room.playerCount,
            maxPlayers: payload.room.maxPlayers,
            timerSeconds: payload.room.timerSeconds,
            autoMoveEnabled: payload.room.autoMoveEnabled,
            status: payload.room.status,
            settings: payload.room.settings,
            createdAt: payload.room.createdAt ?? Date.now(),
            gameState: deserialized,
            players: payload.players ?? [],
          });
          setGameState(deserialized);
          setChatMessages(payload.chatMessages ?? []);
          const gridIndex = GRID_OPTIONS.findIndex(
            (grid) =>
              grid.rows === payload.room.gridSize?.rows &&
              grid.cols === payload.room.gridSize?.cols,
          );
          setSelectedGridIndex(gridIndex >= 0 ? gridIndex : 0);
          setPlayerCount(payload.room.playerCount ?? playerCount);
          setAutoMoveEnabled(payload.room.autoMoveEnabled ?? false);
        } else if (message.type === 'state') {
          const state = GameEngine.deserializeState(
            message.gameState as SerializedGameState,
          );
          setGameState(state);
          setRoom((prev) =>
            prev
              ? {
                  ...prev,
                  gameState: state,
                }
              : prev,
          );
        } else if (message.type === 'chat') {
          setChatMessages((prev) => [...prev, message.payload]);
        } else if (message.type === 'settings') {
          const { gridRows, gridCols, playerCount, autoMoveEnabled } =
            message.payload;
          setSelectedGridIndex(
            GRID_OPTIONS.findIndex(
              (grid) =>
                grid.rows === gridRows && grid.cols === gridCols,
            ) || 0,
          );
          setPlayerCount(playerCount);
          setAutoMoveEnabled(autoMoveEnabled);
          setRoom((prev) =>
            prev
              ? {
                  ...prev,
                  gridSize: { rows: gridRows, cols: gridCols },
                  playerCount,
                  autoMoveEnabled,
                }
              : prev,
          );
        } else if (message.type === 'status') {
          setRoom((prev) =>
            prev
              ? {
                  ...prev,
                  status: message.payload.status,
                }
              : prev,
          );
        }
      } catch (error) {
        console.error('Socket parse failed', error);
      }
    },
    [playerCount, roomId],
  );

  useEffect(() => {
    if (!roomId || !playerSession) {
      return;
    }
    setSocketStatus('connecting');
    const url = new URL('/api/socket', window.location.origin);
    url.searchParams.set('roomId', roomId);
    url.searchParams.set('playerId', playerSession.playerId);
    url.protocol = url.protocol.replace('http', 'ws');
    const socket = new WebSocket(url.toString());
    socketRef.current = socket;
    socket.onopen = () => setSocketStatus('connected');
    socket.onclose = () => setSocketStatus('disconnected');
    socket.onerror = () => setSocketStatus('disconnected');
    socket.onmessage = handleIncomingSocket;
    return () => {
      socket.close();
      socketRef.current = null;
      setSocketStatus('disconnected');
    };
  }, [handleIncomingSocket, playerSession, roomId]);

  const sendSocket = useCallback(
    (payload: unknown) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(payload));
      }
    },
    [],
  );

  const handleStateChange = (state: GameState) => {
    setGameState(state);
    setRoom((prev) =>
      prev
        ? {
            ...prev,
            gameState: state,
          }
        : prev,
    );
    sendSocket({
      type: 'state',
      gameState: GameEngine.serializeState(state),
    });
  };

  const handleChatSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!chatDraft.trim() || !playerSession) {
      return;
    }
    const messagePayload = {
      type: 'chat',
      playerId: playerSession.playerId,
      playerName: playerSession.playerName,
      content: chatDraft.trim(),
    };
    sendSocket(messagePayload);
    setChatDraft('');
  };

  const handleSettingsApply = () => {
    sendSocket({
      type: 'settings',
      payload: {
        gridRows: currentGrid.rows,
        gridCols: currentGrid.cols,
        playerCount,
        autoMoveEnabled,
      },
    });
    setSettingsOpen(false);
  };

  const handleStartGame = async () => {
    if (!playerSession?.isHost) {
      return;
    }
    setIsStarting(true);
    sendSocket({
      type: 'status',
      payload: { status: 'playing' },
    });
    setIsStarting(false);
  };

  useEffect(() => {
    chatScrollRef.current?.scrollTo({
      top: chatScrollRef.current.scrollHeight,
    });
  }, [chatMessages]);

  const statusLabel = room?.status === 'playing'
    ? 'Playing'
    : room?.status === 'finished'
      ? 'Finished'
      : 'Lobby';

  if (error && !room) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10">
        <div className="rounded-[32px] border border-white/30 bg-black/70 p-8 text-center text-slate-100 shadow-[0_40px_80px_rgba(0,0,0,0.65)]">
          <p className="text-lg font-semibold text-white mb-4">Room not found</p>
          <p className="text-sm text-slate-200 mb-6">
            We couldn't load the room yet. Try refreshing or creating a new room.
          </p>
          <Button asChild>
            <a href="/" className="w-full rounded-full border border-white/50 bg-white/10 px-5 py-2 text-[11px] uppercase tracking-[0.35em] text-white">
              Go home
            </a>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="rounded-[42px] border-4 border-black/70 bg-white/80 shadow-[0_40px_70px_rgba(2,35,26,0.75)]">
          <div className="relative overflow-hidden rounded-[38px] border-2 border-black bg-gradient-to-b from-[#00d4c5] via-[#00b8ad] to-[#02a5a3] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] tracking-[0.5em] text-slate-900/80">Room / {roomId}</p>
                <p className="text-3xl font-black uppercase tracking-[0.4em] text-slate-900 drop-shadow">
                  Waiting
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-expanded={infoOpen}
                  aria-label="Quick rules"
                  onClick={() => {
                    setSettingsOpen(false);
                    setInfoOpen((prev) => !prev);
                  }}
                  className="rounded-full border border-white/60 bg-white/80 p-1 text-slate-900 shadow-sm transition hover:scale-105"
                >
                  <Info className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-expanded={settingsOpen}
                  aria-label="Settings"
                  onClick={() => {
                    setInfoOpen(false);
                    setSettingsOpen((prev) => !prev);
                  }}
                  className="rounded-full border border-white/80 bg-black/80 p-2 text-white shadow-sm transition hover:scale-105"
                >
                  <Settings2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/40 bg-white/80 p-4 text-[11px] uppercase tracking-[0.4em] text-slate-900 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
              <div className="flex items-center justify-between">
                <span>Grid</span>
                <span className="font-semibold">{currentGrid.label}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span>Players</span>
                <span className="font-semibold">{playerCount}P</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span>Auto move</span>
                <span
                  className={`font-semibold ${
                    autoMoveEnabled ? 'text-emerald-700' : 'text-slate-600'
                  }`}
                >
                  {autoMoveEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] tracking-[0.4em] text-slate-900/60">
                Players joined
              </p>
              <div className="flex flex-wrap gap-2">
                {room?.players.map((player) => (
                  <span
                    key={player.id}
                    className="rounded-full border border-white/40 bg-black/60 px-3 py-1 text-[11px] font-semibold text-white"
                  >
                    {player.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] tracking-[0.4em] text-slate-900/60">Status</p>
                <p className="text-sm font-bold tracking-[0.35em] text-slate-900">{statusLabel}</p>
              </div>
              <div className="text-[9px] tracking-[0.4em] text-slate-900/60">
                {socketStatus === 'connected' ? 'Live' : 'Syncing'}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[36px] border border-white/40 bg-slate-900/60 p-4 shadow-[0_25px_60px_rgba(0,0,0,0.55)]">
          <div className="relative rounded-[26px] border border-slate-800 bg-slate-950/60 p-2">
            {room && gameState ? (
              <GameBoard
                room={{ ...room, gameState }}
                playerId={playerSession?.playerId ?? null}
                onStateChange={handleStateChange}
              />
            ) : (
              <div className="min-h-[200px] flex items-center justify-center text-slate-500">
                Loading board...
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between text-[10px] uppercase tracking-[0.4em] text-slate-200">
            <span>Move history</span>
            <span>{gameState?.moveHistory.length ?? 0} moves</span>
          </div>
          {playerSession?.isHost && room?.status === 'lobby' && (
            <Button
              onClick={handleStartGame}
              className="mt-3 w-full rounded-full border-0 bg-black px-6 py-3 text-base font-semibold tracking-[0.35em] text-white shadow-[0_15px_30px_rgba(0,0,0,0.45)] hover:-translate-y-0.5 hover:bg-slate-900"
              disabled={isStarting}
            >
              {isStarting ? 'Starting…' : 'Start Game'}
            </Button>
          )}
        </div>

        <div className="rounded-[36px] border border-white/40 bg-slate-900/60 p-4 shadow-[0_25px_60px_rgba(0,0,0,0.55)]">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.4em] text-slate-200">
            <span>Chat</span>
            <span>{socketStatus === 'connected' ? 'Live' : 'Offline'}</span>
          </div>
          <div
            ref={chatScrollRef}
            className="mt-3 flex max-h-48 flex-col gap-2 overflow-y-auto pr-2 text-sm"
          >
            {chatMessages.map((message) => (
              <div
                key={message.id}
                className="rounded-xl border border-white/10 bg-slate-900/40 px-3 py-2"
              >
                <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.4em] text-slate-500">
                  <span>{message.playerName}</span>
                  <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
                </div>
                <p className="mt-1 text-slate-100">{message.content}</p>
              </div>
            ))}
            {!chatMessages.length && (
              <p className="text-center text-xs text-slate-400">No messages yet</p>
            )}
          </div>
          <form onSubmit={handleChatSubmit} className="mt-4 flex gap-2">
            <input
              type="text"
              value={chatDraft}
              onChange={(event) => setChatDraft(event.target.value)}
              placeholder="Send a hint to your crew"
              className="flex-1 rounded-full border border-white/30 bg-slate-950/60 px-4 py-2 text-sm text-white placeholder:text-slate-400 focus:border-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={!chatDraft.trim() || socketStatus !== 'connected'}
              className="rounded-full border border-white/30 bg-black/80 p-2 text-white transition hover:scale-105 disabled:opacity-40"
              aria-label="Send chat"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {infoOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-md rounded-[32px] border border-white/30 bg-slate-950/90 p-6 shadow-[0_40px_80px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-white">
                Quick Rules
              </p>
              <button
                type="button"
                onClick={() => setInfoOpen(false)}
                className="rounded-full border border-white/40 bg-white/20 p-2 text-white"
                aria-label="Close open info"
              >
                <Info className="h-4 w-4" />
              </button>
            </div>
            <ul className="mt-4 space-y-3 text-[11px] uppercase tracking-[0.35em] text-slate-200">
              <li>Rooms hold up to {room?.maxPlayers ?? 8} dreamers.</li>
              <li>Grab an edge—if it closes a square you keep the turn.</li>
              <li>Timer auto-picks a random edge when you pause too long.</li>
            </ul>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-md rounded-[32px] border border-white/30 bg-slate-950/90 p-6 shadow-[0_40px_80px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-white">
                Edit Settings
              </p>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-full border border-white/40 bg-white/20 p-2 text-white"
                aria-label="Close settings"
              >
                <Settings2 className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-[10px] uppercase tracking-[0.35em] text-slate-300">
              <div>
                <p className="mb-2 text-slate-400">Grid size</p>
                <div className="flex flex-wrap gap-2">
                  {GRID_OPTIONS.map((grid, index) => (
                    <button
                      key={grid.label}
                      type="button"
                      onClick={() => setSelectedGridIndex(index)}
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                        selectedGridIndex === index
                          ? 'border-emerald-300 bg-emerald-300/20 text-emerald-100'
                          : 'border-white/30 bg-white/10 text-white/60'
                      }`}
                    >
                      {grid.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-slate-400">Players</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 7 }, (_, idx) => idx + 2).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPlayerCount(value)}
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
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

              <div className="flex items-center justify-between border-t border-white/10 pt-4">
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
                  className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] transition ${
                    autoMoveEnabled
                      ? 'border-emerald-300 bg-emerald-300/20 text-emerald-100'
                      : 'border-white/30 bg-white/10 text-white/60'
                  }`}
                >
                  <Clock3 className="h-4 w-4" />
                  {autoMoveEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            <Button
              onClick={handleSettingsApply}
              className="mt-6 w-full rounded-full border-0 bg-black px-6 py-3 text-base font-semibold tracking-[0.35em] text-white shadow-[0_15px_30px_rgba(0,0,0,0.45)] hover:-translate-y-0.5 hover:bg-slate-900"
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
