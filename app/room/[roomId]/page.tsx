'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { GameBoard } from '@/components/game/GameBoard';
import { GameEngine, SerializedGameState } from '@/lib/game-engine';
import { Room, GameState, ChatMessage } from '@/lib/types';
import { GRID_SIZES } from '@/lib/constants';
import { RoomSnapshot, RealtimeAck } from '@/lib/realtime/types';
import {
  Clock3,
  Copy,
  Crown,
  Info,
  Lock,
  MessageCircle,
  Send,
  Settings2,
  Users,
  X,
} from 'lucide-react';

// Add custom animation styles
const customStyles = `
  @keyframes floatUp {
    0% {
      opacity: 1;
      transform: translateY(0px) scale(1);
    }
    50% {
      opacity: 0.8;
      transform: translateY(-20px) scale(1.1);
    }
    100% {
      opacity: 0;
      transform: translateY(-50px) scale(0.8);
    }
  }
  
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 3px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 3px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.5);
  }
`;

type PlayerSession = {
  playerId: string;
  playerToken: string;
  playerName: string;
  isHost?: boolean;
};

const GRID_OPTIONS = GRID_SIZES.slice(0, 3);

const renderChatMessages = (messages: ChatMessage[], currentPlayerId?: string) => {
  return messages.map((msg, index) => (
    <div
      key={msg.id ?? `${msg.playerId}-${index}`}
      className={`flex pb-3 ${msg.playerId === currentPlayerId ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-3 shadow ${
          msg.playerId === currentPlayerId
            ? 'bg-gradient-to-br from-pink-400 to-fuchsia-500 text-white rounded-br-md'
            : 'bg-white/90 text-slate-800 rounded-bl-md'
        }`}
      >
        <p className={`text-[11px] font-semibold ${msg.playerId === currentPlayerId ? 'text-white/90' : 'text-slate-600'}`}>
          {msg.playerName}
        </p>
        <p className="mt-1 text-sm leading-snug">
          {msg.content}
        </p>
        <p className={`mt-2 text-[10px] ${msg.playerId === currentPlayerId ? 'text-white/80' : 'text-slate-500'}`}>
          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  ));
};

export default function RoomPage() {
  const params = useParams();
  const roomId = (params?.roomId as string)?.toUpperCase();

  // Inject custom styles
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = customStyles;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);
  const [room, setRoom] = useState<Room | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [playerSession, setPlayerSession] = useState<PlayerSession | null>(null);
  const [socketStatus, setSocketStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle');
  const [realtimeJoined, setRealtimeJoined] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [chatSheetOpen, setChatSheetOpen] = useState(false);
  const [playersModalOpen, setPlayersModalOpen] = useState(false);
  const [selectedGridIndex, setSelectedGridIndex] = useState(0);
  const [playerCount, setPlayerCount] = useState(2);
  const [autoMoveEnabled, setAutoMoveEnabled] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatBubbleOpen, setChatBubbleOpen] = useState(false);
  const [animatedChatBubbles, setAnimatedChatBubbles] = useState<Array<{id: string, playerId: string, message: string, x?: number, y?: number}>>([]);
  const socketRef = useRef<Socket | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const currentGrid = useMemo(
    () => GRID_OPTIONS[selectedGridIndex] ?? GRID_OPTIONS[0],
    [selectedGridIndex],
  );

  const applyRoomSnapshot = useCallback((snapshot: RoomSnapshot) => {
    const deserializedState = GameEngine.deserializeState(
      snapshot.gameState as SerializedGameState,
    );
    setRoom({
      ...snapshot.room,
      players: snapshot.players ?? [],
      gameState: deserializedState,
      chatMessages: snapshot.chatMessages ?? [],
    });
    setGameState(deserializedState);
    setChatMessages(snapshot.chatMessages ?? []);
    const gridIndex = GRID_OPTIONS.findIndex(
      (grid) =>
        grid.rows === snapshot.room.gridSize.rows &&
        grid.cols === snapshot.room.gridSize.cols,
    );
    setSelectedGridIndex(gridIndex >= 0 ? gridIndex : 0);
    setPlayerCount(snapshot.room.playerCount ?? 2);
    setAutoMoveEnabled(snapshot.room.autoMoveEnabled ?? false);
    setError('');
  }, []);

  const toSnapshotPayload = useCallback((payload: any): RoomSnapshot => {
    if (
      payload?.room &&
      payload?.players &&
      payload?.gameState
    ) {
      return payload as RoomSnapshot;
    }

    return {
      room: payload,
      players: payload?.players ?? [],
      gameState: payload?.gameState,
      chatMessages: payload?.chatMessages ?? [],
    } as RoomSnapshot;
  }, []);

  const fetchRoomSnapshot = useCallback(async () => {
    if (!roomId) {
      return;
    }
    try {
      const response = await fetch(`/api/rooms/${roomId}`);
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      const snapshot = toSnapshotPayload(data.room);
      applyRoomSnapshot(snapshot);
    } catch (error) {
      console.error('Snapshot fetch failed', error);
    }
  }, [applyRoomSnapshot, roomId, toSnapshotPayload]);

  useEffect(() => {
    if (!roomId) {
      return;
    }
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
          return;
        }
        const data = await response.json();
        const snapshot = toSnapshotPayload(data.room);
        applyRoomSnapshot(snapshot);
      } catch {
        if (!didCancel) {
          setError('Unable to load room data');
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
  }, [applyRoomSnapshot, roomId, toSnapshotPayload]);

  const appendChatMessage = useCallback((message: ChatMessage) => {
    setChatMessages((prev) => (
      prev.some((existing) => existing.id === message.id)
        ? prev
        : [...prev, message]
    ));

    const bubbleId = `${message.id}-${message.createdAt}`;
    setAnimatedChatBubbles((prev) => [
      ...prev.filter((bubble) => bubble.id !== bubbleId),
      {
        id: bubbleId,
        playerId: message.playerId,
        message: message.content,
      },
    ]);

    window.setTimeout(() => {
      setAnimatedChatBubbles((prev) =>
        prev.filter((bubble) => bubble.id !== bubbleId),
      );
    }, 3000);
  }, []);

  useEffect(() => {
    if (!roomId) {
      return;
    }

    const raw = localStorage.getItem(`room-${roomId}-session`);
    if (!raw) {
      return;
    }

    try {
      setPlayerSession(JSON.parse(raw));
    } catch {
      localStorage.removeItem(`room-${roomId}-session`);
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !room?.hostId || !playerSession?.playerId) {
      return;
    }

    const shouldBeHost = playerSession.playerId === room.hostId;
    if (playerSession.isHost === shouldBeHost) {
      return;
    }

    const updatedSession = {
      ...playerSession,
      isHost: shouldBeHost,
    };
    setPlayerSession(updatedSession);
    localStorage.setItem(
      `room-${roomId}-session`,
      JSON.stringify(updatedSession),
    );
  }, [room?.hostId, playerSession, roomId]);

  useEffect(() => {
    if (!roomId || !playerSession?.playerId || !playerSession.playerToken) {
      return;
    }

    let cancelled = false;
    setSocketStatus('connecting');
    setRealtimeJoined(false);

    const connectRealtime = async () => {
      try {
        await fetch('/api/socketio');
      } catch (error) {
        console.error('Socket bootstrap failed', error);
      }

      if (cancelled) {
        return;
      }

      const socket = io({
        path: '/api/socketio',
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        if (cancelled) {
          return;
        }

        setSocketStatus('connected');
        socket.emit(
          'room:join',
          {
            roomId,
            playerId: playerSession.playerId,
            playerToken: playerSession.playerToken,
          },
          (ack: RealtimeAck) => {
            if (!ack?.ok) {
              setRealtimeJoined(false);
              setError(ack.error || 'Unable to join realtime room');
              return;
            }
            setRealtimeJoined(true);
          },
        );
      });

      socket.on('disconnect', () => {
        if (!cancelled) {
          setRealtimeJoined(false);
          setSocketStatus('disconnected');
        }
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error', error);
        if (!cancelled) {
          setRealtimeJoined(false);
          setSocketStatus('disconnected');
        }
      });

      socket.on('room:snapshot', (snapshot: RoomSnapshot) => {
        setRealtimeJoined(true);
        applyRoomSnapshot(snapshot);
      });

      socket.on('chat:new', (message: ChatMessage) => {
        appendChatMessage(message);
      });
    };

    void connectRealtime();

    return () => {
      cancelled = true;
      setRealtimeJoined(false);
      const socket = socketRef.current;
      if (socket) {
        socket.emit('room:leave');
        socket.disconnect();
      }
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [
    applyRoomSnapshot,
    appendChatMessage,
    playerSession?.playerId,
    playerSession?.playerToken,
    roomId,
  ]);

  const emitSocket = useCallback(
    (
      event: string,
      payload: Record<string, unknown>,
      ack?: (response: RealtimeAck) => void,
    ) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) {
        ack?.({ ok: false, error: 'Realtime connection is not available' });
        return false;
      }
      socket.emit(event, payload, ack);
      return true;
    },
    [],
  );

  useEffect(() => {
    if (!roomId) {
      return;
    }

    const needsPolling = socketStatus !== 'connected' || !realtimeJoined;
    if (!needsPolling) {
      return;
    }

    void fetchRoomSnapshot();
    const intervalId = window.setInterval(() => {
      void fetchRoomSnapshot();
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchRoomSnapshot, realtimeJoined, roomId, socketStatus]);

  useEffect(() => {
    if (
      socketStatus !== 'connected' ||
      realtimeJoined ||
      !roomId ||
      !playerSession?.playerId ||
      !playerSession.playerToken
    ) {
      return;
    }

    const socket = socketRef.current;
    if (!socket) {
      return;
    }

    const retryId = window.setTimeout(() => {
      socket.emit(
        'room:join',
        {
          roomId,
          playerId: playerSession.playerId,
          playerToken: playerSession.playerToken,
        },
        (ack: RealtimeAck) => {
          if (ack.ok) {
            setRealtimeJoined(true);
            setError('');
            return;
          }
          console.warn(ack.error || 'Unable to join realtime room');
        },
      );
    }, 1200);

    return () => {
      window.clearTimeout(retryId);
    };
  }, [
    playerSession?.playerId,
    playerSession?.playerToken,
    realtimeJoined,
    roomId,
    socketStatus,
  ]);

  const handleColorChange = useCallback((newColor: string) => {
    if (!playerSession?.playerId || !room) {
      return;
    }

    const isColorTaken = room.players.some(
      (player) =>
        player.id !== playerSession.playerId &&
        player.color === newColor,
    );

    if (isColorTaken) {
      const takenBy = room.players.find((player) => player.color === newColor);
      console.warn(`Color ${newColor} is taken by ${takenBy?.name || 'another player'}`);
      return;
    }

    const previousColor = room.players.find(
      (player) => player.id === playerSession.playerId,
    )?.color;

    setRoom((prev) => (
      prev
        ? {
            ...prev,
            players: prev.players.map((player) =>
              player.id === playerSession.playerId
                ? { ...player, color: newColor }
                : player,
            ),
          }
        : prev
    ));

    const sent = emitSocket('player:update-color', { color: newColor }, (ack) => {
      if (ack.ok) {
        return;
      }

      setRoom((prev) => (
        prev
          ? {
              ...prev,
              players: prev.players.map((player) =>
                player.id === playerSession.playerId
                  ? { ...player, color: previousColor ?? player.color }
                  : player,
              ),
            }
          : prev
      ));
      console.warn(ack.error || 'Color change rejected');
    });

    if (!sent) {
      setRoom((prev) => (
        prev
          ? {
              ...prev,
              players: prev.players.map((player) =>
                player.id === playerSession.playerId
                  ? { ...player, color: previousColor ?? player.color }
                  : player,
              ),
            }
          : prev
      ));
    }
  }, [emitSocket, playerSession?.playerId, room]);

  useEffect(() => {
    // Add global function for color changing
    (window as any).changePlayerColor = (color: string) => {
      handleColorChange(color);
      // Remove all palettes after color change
      document.querySelectorAll('[id^="palette-"]').forEach(el => el.remove());
    };

    return () => {
      delete (window as any).changePlayerColor;
    };
  }, [handleColorChange]);

  const moveViaHttp = useCallback(async (edgeKey: string) => {
    if (!roomId || !playerSession?.playerId || !playerSession.playerToken) {
      return false;
    }

    try {
      const response = await fetch(`/api/rooms/${roomId}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerId: playerSession.playerId,
          playerToken: playerSession.playerToken,
          edgeKey,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        console.warn(payload?.error || 'Move rejected');
        return false;
      }
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }, [playerSession?.playerId, playerSession?.playerToken, roomId]);

  const handleMove = useCallback((edgeKey: string) => {
    const sentRealtime = emitSocket('game:play-move', { edgeKey }, (ack) => {
      if (ack.ok) {
        return;
      }
      void moveViaHttp(edgeKey);
    });

    if (!sentRealtime) {
      void moveViaHttp(edgeKey);
    }
  }, [emitSocket, moveViaHttp]);

  const sendChatViaHttp = useCallback(async (content: string) => {
    if (!roomId || !playerSession?.playerId || !playerSession.playerToken) {
      return false;
    }

    try {
      const response = await fetch(`/api/rooms/${roomId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerId: playerSession.playerId,
          playerToken: playerSession.playerToken,
          content,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        console.warn(payload?.error || 'Unable to send chat message');
        return false;
      }

      const data = await response.json().catch(() => null);
      if (data?.chatMessage) {
        appendChatMessage(data.chatMessage);
      }
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }, [appendChatMessage, playerSession?.playerId, playerSession?.playerToken, roomId]);

  const handleChatSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!chatDraft.trim() || !playerSession || !roomId) {
      return;
    }

    setChatSending(true);
    const content = chatDraft.trim();

    const sentRealtime = emitSocket('chat:send', { content }, (ack) => {
      if (!ack.ok) {
        void sendChatViaHttp(content);
      }
    });

    if (sentRealtime) {
      setChatDraft('');
      setChatSending(false);
      setChatBubbleOpen(false);
      return;
    }

    await sendChatViaHttp(content);
    setChatDraft('');
    setChatSending(false);
    setChatBubbleOpen(false);
  };

  useEffect(() => {
    chatScrollRef.current?.scrollTo({
      top: chatScrollRef.current.scrollHeight,
    });
  }, [chatMessages]);

  const connectionLabel =
    socketStatus === 'connected' && realtimeJoined
      ? 'Live'
      : socketStatus === 'connecting' || (socketStatus === 'connected' && !realtimeJoined)
        ? 'Syncing'
        : 'Offline';
  const statusLabel = room?.status === 'playing'
    ? 'Playing'
    : room?.status === 'finished'
      ? 'Finished'
      : 'Lobby';
  const isPlaying = room?.status === 'playing';
  const isWaiting = room?.status === 'lobby';
  const isFinished = room?.status === 'finished';
  const isHostPlayer = Boolean(
    playerSession?.playerId &&
    room?.hostId &&
    playerSession.playerId === room.hostId,
  );
  const canEditSettings = isHostPlayer && isWaiting;
  const canChangeColor = isWaiting;
  const showGameInfo = isWaiting || !isPlaying;
  const playerCountText = `${room?.players.length ?? 0}/${room?.playerCount ?? 2} Players`;
  const rankedPlayers = useMemo(() => {
    const playersToRank = gameState?.players ?? room?.players ?? [];
    return [...playersToRank].sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.order - b.order;
    });
  }, [gameState?.players, room?.players]);

  const handleCopyRoomId = useCallback(async () => {
    if (!roomId) {
      return;
    }
    try {
      await navigator.clipboard.writeText(roomId);
      setCopyStatus('Copied!');
    } catch {
      setCopyStatus('Unable to copy');
    } finally {
      setTimeout(() => setCopyStatus(''), 2000);
    }
  }, [roomId]);

  const handleSettingsToggle = useCallback(() => {
    if (!canEditSettings) {
      return;
    }
    setInfoOpen(false);
    setSettingsOpen((prev) => !prev);
  }, [canEditSettings]);

  const handleChatToggle = useCallback(() => {
    setChatSheetOpen((prev) => !prev);
  }, []);

  const handlePlayerListToggle = useCallback(() => {
    setPlayersModalOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!canEditSettings && settingsOpen) {
      setSettingsOpen(false);
    }
  }, [canEditSettings, settingsOpen]);

  useEffect(() => {
    if (canChangeColor) {
      return;
    }
    document.querySelectorAll('[id^="palette-"]').forEach((element) => element.remove());
  }, [canChangeColor]);

  const handleSettingsApply = () => {
    if (!canEditSettings) {
      return;
    }
    const rows = currentGrid.rows;
    const cols = currentGrid.cols;
    emitSocket('room:update-settings', {
      gridRows: rows,
      gridCols: cols,
      playerCount,
      autoMoveEnabled,
    }, (ack) => {
      if (!ack.ok) {
        console.warn(ack.error || 'Unable to update room settings');
      }
    });
    setSettingsOpen(false);
  };

  const startGameViaHttp = useCallback(async () => {
    if (!roomId || !playerSession?.playerId || !playerSession.playerToken) {
      return;
    }
    try {
      const response = await fetch(`/api/rooms/${roomId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'playing',
          playerId: playerSession.playerId,
          playerToken: playerSession.playerToken,
        }),
      });
      if (response.ok) {
        setRoom((prev) =>
          prev
            ? {
              ...prev,
              status: 'playing',
            }
            : prev,
        );
      }
    } catch (error) {
      console.error(error);
    }
  }, [playerSession?.playerId, playerSession?.playerToken, roomId]);

  const handleStartGame = async () => {
    if (!isHostPlayer || !roomId) {
      return;
    }
    setIsStarting(true);
    const targetStatus = 'playing';
    const sentRealtime = emitSocket('room:update-status', { status: targetStatus }, (ack) => {
      if (!ack.ok) {
        console.warn(ack.error || 'Unable to start game');
      }
    });

    if (!sentRealtime) {
      await startGameViaHttp();
    }
    setIsStarting(false);
  };

  if (error && !room) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10">
        <div className="rounded-[32px] border border-white/30 bg-black/70 p-8 text-center text-slate-100 shadow-[0_40px_80px_rgba(0,0,0,0.65)]">
          <p className="text-lg font-semibold text-white mb-4">Room not found</p>
          <p className="text-sm text-slate-200 mb-6">
            We couldn't load the room yet. Try refreshing or creating a new room.
          </p>
          <Button asChild>
            <a
              href="/"
              className="w-full rounded-full border border-white/50 bg-white/10 px-5 py-2 text-[11px] uppercase tracking-[0.35em] text-white"
            >
              Go home
            </a>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl">
        <div className="rounded-[42px] border-4 border-black/70 bg-white/80 p-0 shadow-[0_40px_70px_rgba(2,35,26,0.75)]">
          <div className="relative overflow-hidden rounded-[38px] border-2 border-black bg-gradient-to-b from-[#00d4c5] via-[#00b8ad] to-[#02a5a3] p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex flex-col items-center gap-1 text-center">
                <span className="text-[10px] tracking-[0.5em] text-slate-900/70">
                  D &amp; B
                </span>
                <h1 className="text-4xl font-black uppercase tracking-[0.45em] text-white drop-shadow">
                  {statusLabel}
                </h1>
                <p className="text-xs uppercase tracking-[0.4em] text-white/80">
                  Room / {roomId ?? '??????'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyRoomId}
                  className="rounded-full border border-slate-900/50 px-4 py-1 text-[11px] uppercase tracking-[0.35em] bg-white/50 text-slate-900/80 transition cursor-pointer hover:bg-white/70"
                >
                  <Copy className="inline h-3 w-3 mr-2" />
                  {copyStatus || 'Copy Code'}
                </button>
                <>
                  <button
                    type="button"
                    onClick={handlePlayerListToggle}
                    className="rounded-full border border-white/80 bg-black/80 p-2 text-white transition hover:scale-105 cursor-pointer"
                    aria-label="Show players"
                  >
                    <Users className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleChatToggle}
                    className="rounded-full border border-white/80 bg-black/80 p-2 text-white transition hover:scale-105 cursor-pointer"
                    aria-label="Show chat"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </button>
                  {canEditSettings && (
                    <button
                      type="button"
                      onClick={handleSettingsToggle}
                      className="rounded-full border border-white/80 bg-black/80 p-2 text-white transition hover:scale-105 cursor-pointer"
                      aria-label="Edit room settings"
                    >
                      <Settings2 className="h-4 w-4" />
                    </button>
                  )}
                  {isHostPlayer && !canEditSettings && (
                    <button
                      type="button"
                      disabled
                      className="rounded-full border border-white/30 bg-black/60 p-2 text-white/50 opacity-70 cursor-not-allowed"
                      aria-label="Settings locked"
                      title="Settings lock once the game starts"
                    >
                      <Lock className="h-4 w-4" />
                    </button>
                  )}
                </>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    setInfoOpen((prev) => !prev);
                  }}
                  className="rounded-full border border-white/60 bg-white/80 p-1 text-slate-900 shadow-sm transition hover:scale-105 cursor-pointer"
                  aria-expanded={infoOpen}
                  aria-label="Toggle quick rules"
                >
                  {infoOpen ? <X className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Game Info - Only show when waiting or not playing */}
            {showGameInfo && (
              <div className="space-y-4 mb-6">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="rounded-full border border-white/40 bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                    {currentGrid.label}
                  </span>
                  <span className="rounded-full border border-white/40 bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                    {playerCountText}
                  </span>
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.25)] ${autoMoveEnabled ? 'border-green-400 bg-green-400/20 text-green-900' : 'border-slate-900/30 bg-white/60 text-slate-900/70'
                    }`}>
                    <Clock3 className="inline h-3 w-3 mr-1" />
                    {autoMoveEnabled ? 'Auto 30s' : 'Timer off'}
                  </span>
                </div>
              </div>
            )}

            {/* Main Game Area */}
            <div className="relative">
              {/* Game Board */}
              <div>
                <header className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between mb-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.5em] text-slate-900/70">{gameState ? gameState.players[gameState.currentPlayerIndex]?.name ?? 'Waiting...' : 'Waiting...'}'s Turn</p>
                    <h2 className="text-2xl font-semibold text-white tracking-[0.3em]">
                      Claim next edge
                    </h2>
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.5em] text-slate-900/70">
                    Moves: {gameState?.moveHistory.length ?? 0}
                  </div>
                </header>
                <div className="rounded-[32px] border border-white/20 bg-white/80 p-4">
                  {room && gameState ? (
                    <GameBoard
                      room={{ ...room, gameState }}
                      playerId={playerSession?.playerId ?? null}
                      onMove={handleMove}
                      chatBubbles={animatedChatBubbles}
                    />
                  ) : (
                    <div className="min-h-[260px] flex items-center justify-center text-slate-500">
                      Loading board...
                    </div>
                  )}
                </div>
                <div className="mt-4 flex flex-col gap-2 text-[10px] uppercase tracking-[0.5em] text-slate-900/70 lg:flex-row lg:items-center lg:justify-between">
                  <span>Move history</span>
                  <span>{gameState?.moveHistory.length ?? 0} moves</span>
                </div>
                {isWaiting && isHostPlayer && (
                  <Button
                    onClick={handleStartGame}
                    className="mt-4 w-full rounded-full border-0 bg-black px-6 py-3 text-base font-semibold tracking-[0.35em] text-white shadow-[0_15px_30px_rgba(0,0,0,0.45)] hover:-translate-y-0.5 hover:bg-slate-900 cursor-pointer"
                    disabled={isStarting}
                  >
                    {isStarting ? 'Starting...' : 'Start Game'}
                  </Button>
                )}
                {isWaiting && !isHostPlayer && (
                  <p className="mt-4 text-center text-[10px] uppercase tracking-[0.5em] text-slate-900/70">
                    Waiting for host to start match
                  </p>
                )}
                {isFinished && rankedPlayers.length > 0 && (
                  <div className="mt-6 rounded-[28px] border border-white/30 bg-black/55 p-5 shadow-[0_20px_35px_rgba(0,0,0,0.35)]">
                    <div className="flex items-center gap-2 text-white">
                      <Crown className="h-4 w-4 text-yellow-300" />
                      <p className="text-xs font-semibold uppercase tracking-[0.35em]">
                        Final Standings
                      </p>
                    </div>
                    <div className="mt-4 space-y-2">
                      {rankedPlayers.map((player, index) => (
                        <div
                          key={player.id}
                          className={`flex items-center justify-between rounded-full border px-4 py-2 text-sm ${
                            index === 0
                              ? 'border-yellow-300/70 bg-yellow-300/20 text-yellow-100'
                              : 'border-white/20 bg-white/10 text-white'
                          }`}
                        >
                          <span className="font-semibold tracking-[0.2em]">
                            #{index + 1} {player.name}
                          </span>
                          <span className="font-bold">{player.score} pts</span>
                        </div>
                      ))}
                    </div>
                    <a
                      href="/"
                      className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-white/40 bg-white/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-white transition hover:bg-white/30"
                    >
                      Exit Room
                    </a>
                  </div>
                )}
              </div>

              {/* Floating Chat Bubble */}
              <div className="absolute bottom-4 right-4 z-30">
                {!chatBubbleOpen ? (
                  <button
                    type="button"
                    onClick={() => setChatBubbleOpen(true)}
                    className="rounded-full border border-white/60 bg-black/80 p-3 text-white shadow-lg transition hover:scale-105 cursor-pointer"
                    aria-label="Open chat"
                  >
                    <MessageCircle className="h-5 w-5" />
                  </button>
                ) : (
                  <div className="rounded-[20px] border border-white/20 bg-white/90 p-3 shadow-xl min-w-[280px] max-w-[320px]">
                    <form onSubmit={handleChatSubmit} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={chatDraft}
                        onChange={(event) => setChatDraft(event.target.value)}
                        placeholder="Send a hint to your crew"
                        className="flex-1 rounded-full border border-white/20 bg-white/80 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-white focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={chatSending}
                        className="rounded-full border border-slate-900/30 bg-slate-900/80 p-2 text-white transition hover:scale-105 disabled:opacity-40"
                        aria-label="Send chat"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setChatBubbleOpen(false)}
                        className="rounded-full border border-white/60 bg-white/60 p-2 text-slate-900 transition hover:scale-105"
                        aria-label="Close chat"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Players Modal */}
      {playersModalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 px-4 py-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPlayersModalOpen(false);
            }
          }}
        >
          <div className="w-full max-w-md rounded-[32px] border border-white/30 bg-slate-950/90 p-6 shadow-[0_40px_80px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-white">
                Players
              </p>
              <button
                type="button"
                onClick={() => setPlayersModalOpen(false)}
                className="rounded-full border border-white/40 bg-white/30 p-2 text-white cursor-pointer"
                aria-label="Close players"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {room?.players.map((player) => {
                const canChangeThisColor =
                  canChangeColor &&
                  player.id === playerSession?.playerId;

                return (
                  <div key={player.id} className="space-y-6">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="h-4 w-4 rounded-full" style={{ backgroundColor: player.color }} />
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {player.name}
                          </p>
                          <p className="text-[10px] uppercase tracking-[0.4em] text-white/70">
                            P{player.order + 1} - {player.id === room?.hostId ? 'Host' : 'Guest'}
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

                            if (!canChangeThisColor) {
                              return;
                            }

                            document.querySelectorAll('[id^="palette-"]').forEach((el) => el.remove());

                            const palette = document.createElement('div');
                            palette.id = paletteId;
                            palette.className = 'absolute left-0 top-full mt-2 bg-slate-900/95 rounded-lg p-3 border border-white/20 shadow-lg z-50 min-w-[200px]';

                            const colors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#f43f5e'];
                            const colorButtons = colors.map((color) => {
                              const isTaken = room.players.some((p) => p.id !== player.id && p.color === color);
                              const isCurrent = player.color === color;
                              const takenBy = room.players.find((p) => p.color === color);
                              return '<div class="relative group">' +
                                '<button ' +
                                'class="w-6 h-6 rounded-full transition-all ' +
                                (isCurrent
                                  ? 'scale-110'
                                  : 'hover:scale-110') + '"' +
                                ' style="background-color: ' + color + ';' +
                                (isCurrent ? 'box-shadow: 0 0 0 2px #1e293b, 0 0 0 4px white;' : '') + '"' +
                                (!isTaken && !isCurrent
                                  ? ' onclick="window.changePlayerColor(\'' + color + '\')"'
                                  : ' disabled') +
                                ' title="' + (isTaken ? 'Taken by ' + (takenBy?.name || 'another player') : isCurrent ? 'Your current color' : 'Available - Click to select') + '"' +
                                '/>' +
                                (isTaken && !isCurrent
                                  ? '<div class="absolute inset-0 rounded-full pointer-events-none flex items-center justify-center" style="border: 2px solid rgba(255,255,255,0.6);">' +
                                  '<div style="position:absolute;width:60%;height:2px;background:rgba(255,255,255,0.7);transform:rotate(45deg);border-radius:1px;"></div>' +
                                  '<div style="position:absolute;width:60%;height:2px;background:rgba(255,255,255,0.7);transform:rotate(-45deg);border-radius:1px;"></div>' +
                                  '</div>'
                                  : '') +
                                '</div>';
                            }).join('');

                            palette.innerHTML =
                              '<div class="text-[11px] font-semibold text-white mb-3 text-center">' +
                              'Choose Your Color' +
                              '</div>' +
                              '<div class="grid grid-cols-6 gap-2 mb-3">' +
                              colorButtons +
                              '</div>' +
                              '<div class="text-[9px] text-white/60 text-center">' +
                              'Color change is available in lobby only' +
                              '</div>';

                            event.currentTarget.parentElement?.appendChild(palette);
                          }}
                          className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] rounded-full border transition ${
                            canChangeThisColor
                              ? 'border-white/40 bg-white/20 text-white hover:bg-white/30 cursor-pointer'
                              : player.id === playerSession?.playerId
                                ? 'border-white/20 bg-white/10 text-white/50 cursor-not-allowed'
                                : 'border-white/20 bg-white/10 text-white/60 cursor-not-allowed'
                          }`}
                          disabled={!canChangeThisColor}
                        >
                          {player.id === playerSession?.playerId
                            ? canChangeColor
                              ? 'Change'
                              : 'Locked'
                            : 'View'}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/10 pt-4">
                      <span className="text-[9px] uppercase tracking-[0.4em] text-white/70">
                        {room?.players.length ?? 0} / {room?.playerCount ?? 2} Players
                      </span>
                      <span className="text-[9px] uppercase tracking-[0.4em] text-white/70">
                        {connectionLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {chatSheetOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 transition-opacity duration-300"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleChatToggle();
            }
          }}
        >
          <div className="w-full max-w-md rounded-[32px] border border-white/30 bg-[#f7f8fb] p-0 shadow-[0_40px_70px_rgba(2,35,26,0.75)] transition-all duration-300 scale-95 opacity-0"
            style={{
              transform: chatSheetOpen ? 'scale(1)' : 'scale(0.95)',
              opacity: chatSheetOpen ? 1 : 0
            }}
          >
            <div className="rounded-[32px] p-5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">
                    Room Chat
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    Live conversation
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleChatToggle}
                  className="rounded-full border border-slate-300 bg-white p-2 text-slate-700 cursor-pointer transition-transform hover:scale-105"
                  aria-label="Close chat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div
                ref={chatScrollRef}
                className="mt-4 max-h-[60vh] overflow-y-auto space-y-3 rounded-2xl bg-[#eef1f7] p-3 text-sm custom-scrollbar"
              >
                {renderChatMessages(chatMessages, playerSession?.playerId)}
              </div>

              <form onSubmit={handleChatSubmit} className="mt-4 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-2 shadow-sm">
                <input
                  type="text"
                  value={chatDraft}
                  onChange={(event) => setChatDraft(event.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 rounded-full border-0 bg-transparent px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={chatSending}
                  className="rounded-full bg-gradient-to-br from-pink-400 to-fuchsia-500 p-2 text-white transition hover:scale-105 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Info Modal - EntryPanel Style */}
      <div
        className={`absolute inset-6 z-20 max-w-sm rounded-[28px] border border-white/30 bg-black/90 p-5 text-[10px] uppercase tracking-[0.3em] text-slate-100 shadow-[0_40px_70px_rgba(0,0,0,0.75)] transition duration-300 ${infoOpen
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
          <li className="flex gap-2">
            <span className="inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-white"></span>
            <span className="text-left">Rooms hold up to {room?.maxPlayers ?? 8} dreamers.</span>
          </li>
          <li className="flex gap-2">
            <span className="inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-white"></span>
            <span className="text-left">Grab an edge-if it closes a square you keep the turn.</span>
          </li>
          <li className="flex gap-2">
            <span className="inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-white"></span>
            <span className="text-left">Timer auto-picks a random edge when you pause too long.</span>
          </li>
        </ul>
        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70">
          Tap the info icon to close
        </p>
      </div>

      {settingsOpen && canEditSettings && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 px-4 py-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSettingsOpen(false);
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
                onClick={() => setSettingsOpen(false)}
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
                {GRID_OPTIONS.map((grid, index) => (
                  <button
                    key={grid.label}
                    type="button"
                    onClick={() => setSelectedGridIndex(index)}
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
                    onClick={() => setPlayerCount(value)}
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
                onClick={() => setAutoMoveEnabled((prev) => !prev)}
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
              onClick={handleSettingsApply}
              className="mt-6 w-full rounded-full border-0 bg-black px-6 py-3 text-base font-semibold tracking-[0.35em] text-white shadow-[0_15px_30px_rgba(0,0,0,0.45)] hover:-translate-y-0.5 hover:bg-slate-900 cursor-pointer"
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
