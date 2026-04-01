import { sql } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  serial,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export type RoomSettings = {
  allowAutoMove: boolean;
  timeoutSeconds: number | null;
  autoMoveEnabled: boolean;
  label?: string;
  description?: string;
};

export type MoveMetadata = {
  triggeredBy: "player" | "timeout" | "system";
  note?: string;
};

export const gameStatus = pgEnum("game_status", ["lobby", "playing", "finished"]);

export const rooms = pgTable("rooms", {
  id: text("id").primaryKey(),
  host_id: text("host_id").notNull(),
  grid_rows: integer("grid_rows").notNull(),
  grid_cols: integer("grid_cols").notNull(),
  player_count: integer("player_count").notNull().default(2),
  max_players: integer("max_players").notNull().default(8),
  status: gameStatus("status").notNull().default("lobby"),
  timer_seconds: integer("timer_seconds").notNull().default(30),
  auto_move_enabled: boolean("auto_move_enabled").notNull().default(false),
  current_player_index: integer("current_player_index").notNull().default(0),
  winner_id: text("winner_id"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  started_at: timestamp("started_at", { withTimezone: true }),
  finished_at: timestamp("finished_at", { withTimezone: true }),
  last_activity_at: timestamp("last_activity_at", { withTimezone: true }).defaultNow().notNull(),
  settings: jsonb("settings").$type<RoomSettings>().default(sql`'{}'::jsonb`).notNull(),
  game_state: jsonb("game_state").default(sql`'{}'::jsonb`).notNull(),
});

export const players = pgTable(
  "players",
  {
    id: text("id").primaryKey(),
    room_id: text("room_id").notNull().references(() => rooms.id),
    name: text("name").notNull(),
    token: text("token").notNull(),
    color: text("color").notNull(),
    score: integer("score").notNull().default(0),
    order: integer("order").notNull(),
    is_active: boolean("is_active").notNull().default(true),
    is_host: boolean("is_host").notNull().default(false),
    joined_at: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
    last_action_at: timestamp("last_action_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (player) => ({
    roomOrderUnique: uniqueIndex("players_room_order_unique").on(player.room_id, player.order),
    roomColorUnique: uniqueIndex("players_room_color_unique").on(player.room_id, player.color),
    roomTokenUnique: uniqueIndex("players_room_token_unique").on(player.room_id, player.token),
    roomPlayerIndex: index("players_room_id_idx").on(player.room_id),
  }),
);

export const edges = pgTable(
  "edges",
  {
    id: serial("id").primaryKey(),
    room_id: text("room_id").notNull().references(() => rooms.id),
    edge_key: text("edge_key").notNull(),
    start_row: integer("start_row").notNull(),
    start_col: integer("start_col").notNull(),
    end_row: integer("end_row").notNull(),
    end_col: integer("end_col").notNull(),
    player_id: text("player_id").references(() => players.id),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (edge) => ({
    roomEdgeUnique: uniqueIndex("edges_room_edge_key_unique").on(edge.room_id, edge.edge_key),
    roomEdgeIndex: index("edges_room_id_idx").on(edge.room_id),
  }),
);

export const squares = pgTable(
  "squares",
  {
    id: serial("id").primaryKey(),
    room_id: text("room_id").notNull().references(() => rooms.id),
    square_row: integer("square_row").notNull(),
    square_col: integer("square_col").notNull(),
    owner_id: text("owner_id").references(() => players.id),
    completed_at: timestamp("completed_at", { withTimezone: true }),
  },
  (square) => ({
    squarePositionUnique: uniqueIndex("squares_room_position_unique").on(
      square.room_id,
      square.square_row,
      square.square_col,
    ),
    squareRoomIndex: index("squares_room_id_idx").on(square.room_id),
  }),
);

export const moves = pgTable(
  "moves",
  {
    id: serial("id").primaryKey(),
    room_id: text("room_id").notNull().references(() => rooms.id),
    player_id: text("player_id").references(() => players.id),
    edge_key: text("edge_key").notNull(),
    squares_completed: integer("squares_completed").notNull().default(0),
    is_auto: boolean("is_auto").notNull().default(false),
    metadata: jsonb("metadata").$type<MoveMetadata>().default(sql`'{}'::jsonb`).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (move) => ({
    moveRoomIndex: index("moves_room_id_idx").on(move.room_id),
  }),
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: serial("id").primaryKey(),
    room_id: text("room_id").notNull().references(() => rooms.id),
    player_id: text("player_id").notNull().references(() => players.id),
    content: text("content").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (message) => ({
    chatRoomIndex: index("chat_room_id_idx").on(message.room_id),
  }),
);

export const schema = { rooms, players, edges, squares, moves, chatMessages };
