import { Card, Suit, Rank } from '@/types/game';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

let cardIdCounter = 0;

function createCard(suit: Suit | null, rank: Rank | null, isJoker = false, jokerColor?: 'red' | 'black'): Card {
  cardIdCounter++;
  return {
    id: `card-${cardIdCounter}-${Date.now()}`,
    suit,
    rank,
    isJoker,
    jokerColor,
    isFaceUp: false,
    isLocked: false,
    isSelected: false,
    isPeeking: false,
  };
}

export function createDeck(includeJokers = true): Card[] {
  cardIdCounter = 0;
  const cards: Card[] = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push(createCard(suit, rank));
    }
  }

  if (includeJokers) {
    cards.push(createCard(null, null, true, 'red'));
    cards.push(createCard(null, null, true, 'black'));
  }

  return cards;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  // Fisher-Yates shuffle
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function dealCards(deck: Card[], count: number): { dealt: Card[]; remaining: Card[] } {
  const dealt = deck.slice(0, count);
  const remaining = deck.slice(count);
  return { dealt, remaining };
}
