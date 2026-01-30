import { Difficulty, PowerType, Card } from './game';

// ============================================================
// Client -> Server Messages
// ============================================================
export type ClientMessage =
  | { type: 'create_room'; playerName: string; difficulty: Difficulty }
  | { type: 'join_room'; roomId: string; playerName: string }
  | { type: 'start_game' }
  | { type: 'draw_from_deck' }
  | { type: 'draw_from_discard' }
  | { type: 'swap_with_hand'; handIndex: number }
  | { type: 'discard_drawn' }
  | { type: 'select_power_target'; targetSeat: number; targetIndex: number };

// ============================================================
// Server -> Client Messages
// ============================================================
export type ServerMessage =
  | { type: 'room_created'; roomId: string; seat: number }
  | { type: 'player_joined'; playerName: string; seat: number; seats: RoomSeat[] }
  | { type: 'player_left'; seat: number; seats: RoomSeat[] }
  | { type: 'game_started'; state: ClientGameView }
  | { type: 'state_update'; state: ClientGameView }
  | { type: 'toast'; message: string; toastType: 'info' | 'power' | 'warning' | 'success' }
  | { type: 'game_over'; state: ClientGameView }
  | { type: 'error'; message: string };

// ============================================================
// Shared Types
// ============================================================
export interface RoomSeat {
  playerName: string | null;
  kind: 'human' | 'ai' | 'empty';
  isReady: boolean;
}

// What each client sees (filtered: opponents' cards hidden)
export interface ClientGameView {
  players: ClientPlayerView[];
  currentTurnSeat: number;
  localSeat: number;
  deckCount: number;
  discardPile: Card[];
  drawnCard: Card | null;       // only set if it's this client's turn
  activePower: PowerType | null;
  powerSourceSeat: number | null;
  phase: string;
  turnCount: number;
  winnerSeat: number | null;
}

export interface ClientPlayerView {
  name: string;
  kind: 'human' | 'ai';
  seatIndex: number;
  hand: (Card | null)[];       // null = face-down card (opponent hidden)
  score: number;               // only meaningful at game over
  isLocal: boolean;
}
