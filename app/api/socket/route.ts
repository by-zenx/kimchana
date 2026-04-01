import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { chatMessages, players, rooms } from '@/db/schema';
import { GameEngine, SerializedGameState } from '@/lib/game-engine';
import { broadcastToRoom, registerSocket, unregisterSocket } from '@/lib/socket';
import { eq, asc } from 'drizzle-orm';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const roomId = url.searchParams.get('roomId')?.toUpperCase();
  const playerId = url.searchParams.get('playerId');

  if (!roomId || !playerId) {
    return NextResponse.json({ error: 'Missing player or room id' }, { status: 400 });
  }

  const pair = new WebSocketPair();
  const [client, server] = pair;
  server.accept();
  registerSocket(roomId, server);

  const roomRecord = await db.query.rooms.findFirst({
    where: eq(rooms.id, roomId),
  });

  if (!roomRecord) {
    server.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
    server.close();
    return new NextResponse(null, { status: 101, webSocket: client });
  }

  const playersList = await db.query.players.findMany({
    where: eq(players.room_id, roomId),
  });

  const chatRows = await db.query.chatMessages.findMany({
    where: eq(chatMessages.room_id, roomId),
    orderBy: asc(chatMessages.created_at),
    limit: 40,
  });

  const chatPayload = chatRows.map((message) => ({
    id: message.id,
    roomId: roomId,
    playerId: message.player_id,
    playerName: playersList.find((p) => p.id === message.player_id)?.name ?? 'Guest',
    content: message.content,
    createdAt: message.created_at.toISOString(),
  }));

  const gameState =
    roomRecord.game_state && Object.keys(roomRecord.game_state).length
      ? GameEngine.deserializeState(roomRecord.game_state as SerializedGameState)
      : GameEngine.createInitialState(
          { rows: roomRecord.grid_rows, cols: roomRecord.grid_cols },
          [],
        );

    server.send(
      JSON.stringify({
        type: 'initial',
        payload: {
          room: {
            id: roomRecord.id,
            hostId: roomRecord.host_id,
            gridSize: { rows: roomRecord.grid_rows, cols: roomRecord.grid_cols },
            playerCount: roomRecord.player_count,
            maxPlayers: roomRecord.max_players,
            timerSeconds: roomRecord.timer_seconds,
            autoMoveEnabled: roomRecord.auto_move_enabled,
            status: roomRecord.status,
            settings: roomRecord.settings,
            createdAt: roomRecord.created_at.getTime(),
          },
          players: playersList,
          gameState: GameEngine.serializeState(gameState),
          chatMessages: chatPayload,
        },
      }),
    );

  server.addEventListener('message', async (event) => {
    try {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'state': {
          const serializedState = data.gameState as SerializedGameState;
          await db
            .update(rooms)
            .set({
              game_state: serializedState,
              last_activity_at: new Date(),
            })
            .where(eq(rooms.id, roomId));

          broadcastToRoom(roomId, { type: 'state', gameState: serializedState }, { exclude: server });
          break;
        }
        case 'chat': {
          const row = await db
            .insert(chatMessages)
            .values({
              room_id: roomId,
              player_id: data.playerId,
              content: data.content,
            })
            .returning();

          const formatted = {
            id: row[0].id,
            roomId,
            playerId: row[0].player_id,
            playerName: data.playerName,
            content: row[0].content,
            createdAt: row[0].created_at.toISOString(),
          };

          broadcastToRoom(roomId, { type: 'chat', payload: formatted });
          break;
        }
        case 'settings': {
          const { gridRows, gridCols, playerCount, autoMoveEnabled } = data.payload;
          const existing = await db.query.rooms.findFirst({
            where: eq(rooms.id, roomId),
          });
          if (!existing) {
            break;
          }
          const currentState = existing.game_state && Object.keys(existing.game_state).length
            ? GameEngine.deserializeState(existing.game_state as SerializedGameState)
            : GameEngine.createInitialState({ rows: existing.grid_rows, cols: existing.grid_cols }, []);

          const restartedState = GameEngine.createInitialState(
            { rows: gridRows, cols: gridCols },
            currentState.players,
          );

          await db
            .update(rooms)
            .set({
              grid_rows: gridRows,
              grid_cols: gridCols,
              player_count: playerCount,
              auto_move_enabled: autoMoveEnabled,
              settings: {
                allowAutoMove: autoMoveEnabled,
                autoMoveEnabled,
                timeoutSeconds: autoMoveEnabled ? 30 : null,
              },
              game_state: GameEngine.serializeState(restartedState),
              last_activity_at: new Date(),
            })
            .where(eq(rooms.id, roomId));

          broadcastToRoom(
            roomId,
            {
              type: 'settings',
              payload: {
                gridRows,
                gridCols,
                playerCount,
                autoMoveEnabled,
              },
            },
            { exclude: server },
          );
          broadcastToRoom(
            roomId,
            { type: 'state', gameState: GameEngine.serializeState(restartedState) },
            { exclude: server },
          );
          break;
        }
        case 'status': {
          const { status } = data.payload;
          await db.update(rooms).set({ status, last_activity_at: new Date() }).where(eq(rooms.id, roomId));
          broadcastToRoom(roomId, { type: 'status', payload: { status } }, { exclude: server });
          break;
        }
      }
    } catch (error) {
      console.error('Socket message error', error);
    }
  });

  server.addEventListener('close', () => {
    unregisterSocket(roomId, server);
  });

  return new NextResponse(null, { status: 101, webSocket: client });
}
