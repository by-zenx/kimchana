import { relations } from "drizzle-orm/relations";
import { edges, moves, players, rooms, squares } from "../db/schema";

export const roomRelations = relations(rooms, ({ many }) => ({
  players: many(players),
  edges: many(edges),
  squares: many(squares),
  moves: many(moves),
}));

export const playerRelations = relations(players, ({ one, many }) => ({
  room: one(rooms, {
    fields: [players.room_id],
    references: [rooms.id],
  }),
  edges: many(edges),
  moves: many(moves),
}));

export const edgeRelations = relations(edges, ({ one }) => ({
  room: one(rooms, {
    fields: [edges.room_id],
    references: [rooms.id],
  }),
  player: one(players, {
    fields: [edges.player_id],
    references: [players.id],
  }),
}));

export const squareRelations = relations(squares, ({ one }) => ({
  room: one(rooms, {
    fields: [squares.room_id],
    references: [rooms.id],
  }),
  owner: one(players, {
    fields: [squares.owner_id],
    references: [players.id],
  }),
}));

export const moveRelations = relations(moves, ({ one }) => ({
  room: one(rooms, {
    fields: [moves.room_id],
    references: [rooms.id],
  }),
  player: one(players, {
    fields: [moves.player_id],
    references: [players.id],
  }),
}));
