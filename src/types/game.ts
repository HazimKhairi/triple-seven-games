// ============================================================
// Triple Seven - Types & Interfaces (4-Player)
// ============================================================

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export type JokerColor = 'red' | 'black';

export type PowerType = 'unlock' | 'swap' | 'peek' | 'lock' | 'mass_swap';

export type Difficulty = 'beginner' | 'intermediate' | 'hardcore';

export type GamePhase =
  | 'menu'
  | 'lobby'
  | 'dealing'
  | 'turn_draw'
  | 'turn_decision'
  | 'power_target'
  | 'game_over'
  | 'tutorial';

export type PlayerKind = 'human' | 'ai';

export type SeatPosition = 'south' | 'west' | 'north' | 'east';

export const SEAT_POSITIONS: SeatPosition[] = ['south', 'west', 'north', 'east'];

export interface Card {
  id: string;
  suit: Suit | null;
  rank: Rank | null;
  isJoker: boolean;
  jokerColor?: JokerColor;
  isFaceUp: boolean;
  isLocked: boolean;
  isSelected: boolean;
  isPeeking: boolean;
  powerUsed?: boolean;
}

export interface PlayerInfo {
  id: string;
  seatIndex: number;       // 0=south, 1=west, 2=north, 3=east
  kind: PlayerKind;
  name: string;
  hand: Card[];
  score: number;
  isLocal: boolean;        // controlled by this client
}

export interface AIMemory {
  knownCards: Map<number, Map<number, Card>>; // seatIndex -> (cardIndex -> Card)
  discardedCards: Card[];
}

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'power' | 'warning' | 'success';
}

export interface SeatConfig {
  kind: PlayerKind;
  name: string;
  isLocal?: boolean;
  socketId?: string;
}

export interface GameConfig {
  seats: SeatConfig[];
  difficulty: Difficulty;
  isOnline: boolean;
}

export interface GameState {
  phase: GamePhase;
  difficulty: Difficulty;
  deck: Card[];
  discardPile: Card[];
  players: PlayerInfo[];
  currentTurnSeat: number;
  localPlayerSeat: number;
  drawnCard: Card | null;
  drawnFrom: 'deck' | 'discard' | null;
  activePower: PowerType | null;
  powerSourceSeat: number | null;
  aiMemories: Map<number, AIMemory>;
  toasts: Toast[];
  winnerSeat: number | null;
  turnCount: number;
  roomId: string | null;
  isOnline: boolean;
  swapSource: { seat: number; index: number } | null;
  turnTimer: number;         // seconds remaining for current turn
  turnTimerMax: number;      // max seconds per turn
  isDiscardBurned: boolean;  // true if top discard was used as power
}

// Helper to get the image path for a card
export function getCardImagePath(card: Card): string {
  if (card.isJoker) {
    return `/cards/joker_${card.jokerColor || 'red'}.svg`;
  }
  const suitMap: Record<Suit, string> = {
    hearts: 'H', diamonds: 'D', clubs: 'C', spades: 'S',
  };
  const rankMap: Record<Rank, string> = {
    A: 'A', '2': '2', '3': '3', '4': '4', '5': '5',
    '6': '6', '7': '7', '8': '8', '9': '9', '10': '10',
    J: 'J', Q: 'Q', K: 'K',
  };
  return `/cards/${suitMap[card.suit!]}${rankMap[card.rank!]}.png`;
}

export const CARD_BACK_IMAGE = '/cards/back.svg';

export function getCardValue(card: Card): number {
  if (card.isJoker) return 10;
  if (card.rank === '7') return 0;
  if (card.rank === 'A') return 1;
  if (card.rank === '10' || card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10;
  return parseInt(card.rank!, 10);
}

export function getCardPower(card: Card): PowerType | null {
  if (card.powerUsed) return null;
  if (card.isJoker) return 'mass_swap';
  switch (card.rank) {
    case '10': return 'unlock';
    case 'J': return 'swap';
    case 'Q': return 'peek';
    case 'K': return 'lock';
    default: return null;
  }
}

export function calculateHandScore(hand: Card[]): number {
  return hand.reduce((total, card) => total + getCardValue(card), 0);
}

export function getNextSeat(current: number, total: number = 4): number {
  return (current + 1) % total;
}

export function getSeatPosition(seatIndex: number): SeatPosition {
  return SEAT_POSITIONS[seatIndex];
}

export function powerName(power: PowerType): string {
  switch (power) {
    case 'unlock': return 'Unlock';
    case 'swap': return 'Swap';
    case 'peek': return 'Peek';
    case 'lock': return 'Lock';
    case 'mass_swap': return 'Mass Swap';
  }
}

export function createEmptyAIMemory(): AIMemory {
  return {
    knownCards: new Map(),
    discardedCards: [],
  };
}
