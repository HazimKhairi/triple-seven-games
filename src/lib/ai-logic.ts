import {
  Card,
  Difficulty,
  AIMemory,
  getCardValue,
  getCardPower,
  PowerType,
} from '@/types/game';

export interface AIDecision {
  action: 'swap' | 'discard';
  swapIndex?: number;
}

export interface Opponent {
  seatIndex: number;
  hand: Card[];
}

export interface AIPowerDecision {
  power: PowerType;
  targetSeat: number;
  targetIndex: number;
  swapOwnIndex?: number; // for Jack swap
}

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

function getKnownCardsForSeat(memory: AIMemory, seat: number): Map<number, Card> {
  return memory.knownCards.get(seat) || new Map();
}

function unlocked(hand: Card[]) {
  return hand.map((c, i) => ({ card: c, index: i })).filter((x) => !x.card.isLocked);
}

// ========== BEGINNER AI ==========
function beginnerDraw(discardTop: Card | null): 'deck' | 'discard' {
  if (!discardTop) return 'deck';
  return Math.random() > 0.5 ? 'deck' : 'discard';
}

function beginnerDecide(drawnCard: Card, hand: Card[]): AIDecision {
  if (Math.random() > 0.5) {
    const unlockedCards = unlocked(hand);
    if (unlockedCards.length > 0) {
      return { action: 'swap', swapIndex: unlockedCards[randomInt(unlockedCards.length)].index };
    }
  }
  return { action: 'discard' };
}

function beginnerPowerTarget(
  power: PowerType,
  aiSeat: number,
  aiHand: Card[],
  opponents: Opponent[]
): AIPowerDecision | null {
  switch (power) {
    case 'unlock': {
      const allLocked: { seat: number; index: number }[] = [];
      allLocked.push(...aiHand.map((c, i) => ({ card: c, seat: aiSeat, index: i })).filter(x => x.card.isLocked).map(x => ({ seat: x.seat, index: x.index })));
      for (const opp of opponents) {
        allLocked.push(...opp.hand.map((c, i) => ({ card: c, seat: opp.seatIndex, index: i })).filter(x => x.card.isLocked).map(x => ({ seat: x.seat, index: x.index })));
      }
      if (allLocked.length === 0) return null;
      const pick = allLocked[randomInt(allLocked.length)];
      return { power, targetSeat: pick.seat, targetIndex: pick.index };
    }
    case 'swap': {
      const aiUnlocked = unlocked(aiHand);
      if (aiUnlocked.length === 0) return null;
      const allOppUnlocked: { seat: number; index: number }[] = [];
      for (const opp of opponents) {
        allOppUnlocked.push(...unlocked(opp.hand).map(x => ({ seat: opp.seatIndex, index: x.index })));
      }
      if (allOppUnlocked.length === 0) return null;
      const pick = allOppUnlocked[randomInt(allOppUnlocked.length)];
      return { power, targetSeat: pick.seat, targetIndex: pick.index, swapOwnIndex: aiUnlocked[randomInt(aiUnlocked.length)].index };
    }
    case 'peek': {
      const all: { seat: number; index: number }[] = [];
      all.push(...unlocked(aiHand).map(x => ({ seat: aiSeat, index: x.index })));
      for (const opp of opponents) {
        all.push(...unlocked(opp.hand).map(x => ({ seat: opp.seatIndex, index: x.index })));
      }
      if (all.length === 0) return null;
      const pick = all[randomInt(all.length)];
      return { power, targetSeat: pick.seat, targetIndex: pick.index };
    }
    case 'lock': {
      const aiUnlocked = unlocked(aiHand);
      if (aiUnlocked.length === 0) return null;
      return { power, targetSeat: aiSeat, targetIndex: aiUnlocked[randomInt(aiUnlocked.length)].index };
    }
    case 'mass_swap': {
      if (opponents.length === 0) return null;
      const pick = opponents[randomInt(opponents.length)];
      return { power, targetSeat: pick.seatIndex, targetIndex: 0 };
    }
    default:
      return null;
  }
}

// ========== INTERMEDIATE AI ==========
function intermediateDraw(discardTop: Card | null): 'deck' | 'discard' {
  if (!discardTop) return 'deck';
  const discardValue = getCardValue(discardTop);
  if (discardValue <= 3 || getCardPower(discardTop) === 'lock') return 'discard';
  return 'deck';
}

function intermediateDecide(drawnCard: Card, hand: Card[], memory: AIMemory, aiSeat: number): AIDecision {
  const drawnValue = getCardValue(drawnCard);
  const ownKnown = getKnownCardsForSeat(memory, aiSeat);

  let worstIndex = -1;
  let worstValue = -1;
  for (let i = 0; i < hand.length; i++) {
    if (hand[i].isLocked) continue;
    const known = ownKnown.get(i);
    if (known) {
      const val = getCardValue(known);
      if (val > worstValue) { worstValue = val; worstIndex = i; }
    }
  }

  if (drawnValue <= 3) {
    if (worstIndex >= 0 && worstValue > drawnValue) return { action: 'swap', swapIndex: worstIndex };
    const unknowns = hand.map((c, i) => ({ card: c, index: i })).filter(x => !x.card.isLocked && !ownKnown.has(x.index));
    if (unknowns.length > 0) return { action: 'swap', swapIndex: unknowns[randomInt(unknowns.length)].index };
    if (worstIndex >= 0) return { action: 'swap', swapIndex: worstIndex };
  }
  if (drawnValue >= 8) return { action: 'discard' };
  if (worstIndex >= 0 && drawnValue < worstValue) return { action: 'swap', swapIndex: worstIndex };
  return { action: 'discard' };
}

function intermediatePowerTarget(
  power: PowerType,
  aiSeat: number,
  aiHand: Card[],
  opponents: Opponent[],
  memory: AIMemory
): AIPowerDecision | null {
  const ownKnown = getKnownCardsForSeat(memory, aiSeat);

  switch (power) {
    case 'lock': {
      const aiUnlocked = unlocked(aiHand);
      let bestIdx = -1;
      let bestVal = Infinity;
      for (const { index } of aiUnlocked) {
        const known = ownKnown.get(index);
        if (known) { const val = getCardValue(known); if (val < bestVal) { bestVal = val; bestIdx = index; } }
      }
      if (bestIdx >= 0) return { power, targetSeat: aiSeat, targetIndex: bestIdx };
      if (aiUnlocked.length > 0) return { power, targetSeat: aiSeat, targetIndex: aiUnlocked[0].index };
      return null;
    }
    case 'peek': {
      const aiUnknown = unlocked(aiHand).filter(x => !ownKnown.has(x.index));
      if (aiUnknown.length > 0) return { power, targetSeat: aiSeat, targetIndex: aiUnknown[0].index };
      for (const opp of opponents) {
        const oppKnown = getKnownCardsForSeat(memory, opp.seatIndex);
        const oppUnknown = unlocked(opp.hand).filter(x => !oppKnown.has(x.index));
        if (oppUnknown.length > 0) return { power, targetSeat: opp.seatIndex, targetIndex: oppUnknown[0].index };
      }
      return null;
    }
    case 'swap': {
      const aiUnlocked = unlocked(aiHand);
      if (aiUnlocked.length === 0) return null;
      let worstAI = aiUnlocked[0].index;
      let worstVal = 0;
      for (const { index } of aiUnlocked) {
        const known = ownKnown.get(index);
        if (known && getCardValue(known) > worstVal) { worstVal = getCardValue(known); worstAI = index; }
      }
      // Find best opponent card across all opponents
      let bestOppSeat = -1;
      let bestOppIndex = -1;
      let bestOppVal = Infinity;
      for (const opp of opponents) {
        const oppKnown = getKnownCardsForSeat(memory, opp.seatIndex);
        for (const { index } of unlocked(opp.hand)) {
          const known = oppKnown.get(index);
          if (known && getCardValue(known) < bestOppVal) {
            bestOppVal = getCardValue(known); bestOppSeat = opp.seatIndex; bestOppIndex = index;
          }
        }
      }
      if (bestOppSeat >= 0) return { power, targetSeat: bestOppSeat, targetIndex: bestOppIndex, swapOwnIndex: worstAI };
      // Random opponent
      const allOppUnlocked: { seat: number; index: number }[] = [];
      for (const opp of opponents) allOppUnlocked.push(...unlocked(opp.hand).map(x => ({ seat: opp.seatIndex, index: x.index })));
      if (allOppUnlocked.length === 0) return null;
      const pick = allOppUnlocked[randomInt(allOppUnlocked.length)];
      return { power, targetSeat: pick.seat, targetIndex: pick.index, swapOwnIndex: worstAI };
    }
    case 'unlock': {
      const aiLocked = aiHand.map((c, i) => ({ card: c, index: i })).filter(x => x.card.isLocked);
      if (aiLocked.length > 0) return { power, targetSeat: aiSeat, targetIndex: aiLocked[0].index };
      for (const opp of opponents) {
        const oppLocked = opp.hand.map((c, i) => ({ card: c, index: i })).filter(x => x.card.isLocked);
        if (oppLocked.length > 0) return { power, targetSeat: opp.seatIndex, targetIndex: oppLocked[0].index };
      }
      return null;
    }
    case 'mass_swap': {
      if (opponents.length === 0) return null;
      return { power, targetSeat: opponents[randomInt(opponents.length)].seatIndex, targetIndex: 0 };
    }
    default:
      return null;
  }
}

// ========== HARDCORE AI ==========
function hardcoreDraw(discardTop: Card | null): 'deck' | 'discard' {
  if (!discardTop) return 'deck';
  const val = getCardValue(discardTop);
  const power = getCardPower(discardTop);
  if (val === 0 || val === 1) return 'discard';
  if (power === 'lock' || power === 'mass_swap') return 'discard';
  if (val <= 4) return 'discard';
  return 'deck';
}

function hardcoreDecide(drawnCard: Card, hand: Card[], memory: AIMemory, aiSeat: number): AIDecision {
  const drawnValue = getCardValue(drawnCard);
  const ownKnown = getKnownCardsForSeat(memory, aiSeat);

  let worstIndex = -1;
  let worstValue = -1;
  for (let i = 0; i < hand.length; i++) {
    if (hand[i].isLocked) continue;
    const known = ownKnown.get(i);
    const val = known ? getCardValue(known) : 6;
    if (val > worstValue) { worstValue = val; worstIndex = i; }
  }

  if (drawnValue <= 1 && worstIndex >= 0 && worstValue > drawnValue) return { action: 'swap', swapIndex: worstIndex };
  if (worstIndex >= 0 && drawnValue < worstValue) return { action: 'swap', swapIndex: worstIndex };
  if (getCardPower(drawnCard)) return { action: 'discard' };
  return { action: 'discard' };
}

function hardcorePowerTarget(
  power: PowerType,
  aiSeat: number,
  aiHand: Card[],
  opponents: Opponent[],
  memory: AIMemory
): AIPowerDecision | null {
  const ownKnown = getKnownCardsForSeat(memory, aiSeat);

  switch (power) {
    case 'lock': {
      const aiUnlocked = unlocked(aiHand);
      let bestIdx = -1;
      let bestVal = Infinity;
      for (const { index } of aiUnlocked) {
        const known = ownKnown.get(index);
        const val = known ? getCardValue(known) : 6;
        if (val < bestVal) { bestVal = val; bestIdx = index; }
      }
      if (bestIdx >= 0) return { power, targetSeat: aiSeat, targetIndex: bestIdx };
      return null;
    }
    case 'peek': {
      // Peek opponent unknowns first
      for (const opp of opponents) {
        const oppKnown = getKnownCardsForSeat(memory, opp.seatIndex);
        const oppUnknown = unlocked(opp.hand).filter(x => !oppKnown.has(x.index));
        if (oppUnknown.length > 0) return { power, targetSeat: opp.seatIndex, targetIndex: oppUnknown[0].index };
      }
      const aiUnknown = unlocked(aiHand).filter(x => !ownKnown.has(x.index));
      if (aiUnknown.length > 0) return { power, targetSeat: aiSeat, targetIndex: aiUnknown[0].index };
      return null;
    }
    case 'swap': {
      const aiUnlocked = unlocked(aiHand);
      if (aiUnlocked.length === 0) return null;
      let worstAI = aiUnlocked[0].index;
      let worstAIVal = -1;
      for (const { index } of aiUnlocked) {
        const known = ownKnown.get(index);
        const val = known ? getCardValue(known) : 6;
        if (val > worstAIVal) { worstAIVal = val; worstAI = index; }
      }
      // Find best known opponent card
      let bestOppSeat = -1;
      let bestOppIndex = -1;
      let bestOppVal = Infinity;
      for (const opp of opponents) {
        const oppKnown = getKnownCardsForSeat(memory, opp.seatIndex);
        for (const { index } of unlocked(opp.hand)) {
          const known = oppKnown.get(index);
          if (known) {
            const val = getCardValue(known);
            if (val < bestOppVal) { bestOppVal = val; bestOppSeat = opp.seatIndex; bestOppIndex = index; }
          }
        }
      }
      if (bestOppSeat >= 0 && bestOppVal < worstAIVal) {
        return { power, targetSeat: bestOppSeat, targetIndex: bestOppIndex, swapOwnIndex: worstAI };
      }
      // Swap randomly with any opponent
      const allOppUnlocked: { seat: number; index: number }[] = [];
      for (const opp of opponents) allOppUnlocked.push(...unlocked(opp.hand).map(x => ({ seat: opp.seatIndex, index: x.index })));
      if (allOppUnlocked.length === 0) return null;
      const pick = allOppUnlocked[randomInt(allOppUnlocked.length)];
      return { power, targetSeat: pick.seat, targetIndex: pick.index, swapOwnIndex: worstAI };
    }
    case 'unlock': {
      // Unlock opponents' locked cards first (to steal later)
      for (const opp of opponents) {
        const oppLocked = opp.hand.map((c, i) => ({ card: c, index: i })).filter(x => x.card.isLocked);
        if (oppLocked.length > 0) return { power, targetSeat: opp.seatIndex, targetIndex: oppLocked[0].index };
      }
      const aiLocked = aiHand.map((c, i) => ({ card: c, index: i })).filter(x => x.card.isLocked);
      if (aiLocked.length > 0) return { power, targetSeat: aiSeat, targetIndex: aiLocked[0].index };
      return null;
    }
    case 'mass_swap': {
      // Pick opponent with best estimated hand
      let bestOppSeat = -1;
      let bestOppScore = Infinity;
      let aiScore = 0;
      for (let i = 0; i < aiHand.length; i++) {
        if (aiHand[i].isLocked) continue;
        const known = ownKnown.get(i);
        aiScore += known ? getCardValue(known) : 6;
      }
      for (const opp of opponents) {
        const oppKnown = getKnownCardsForSeat(memory, opp.seatIndex);
        let score = 0;
        for (let i = 0; i < opp.hand.length; i++) {
          if (opp.hand[i].isLocked) continue;
          const known = oppKnown.get(i);
          score += known ? getCardValue(known) : 6;
        }
        if (score < bestOppScore) { bestOppScore = score; bestOppSeat = opp.seatIndex; }
      }
      if (bestOppSeat >= 0 && bestOppScore < aiScore) {
        return { power, targetSeat: bestOppSeat, targetIndex: 0 };
      }
      return null;
    }
    default:
      return null;
  }
}

// ========== PUBLIC API ==========
export function aiChooseDraw(
  difficulty: Difficulty,
  discardTop: Card | null,
): 'deck' | 'discard' {
  switch (difficulty) {
    case 'beginner': return beginnerDraw(discardTop);
    case 'intermediate': return intermediateDraw(discardTop);
    case 'hardcore': return hardcoreDraw(discardTop);
  }
}

export function aiDecide(
  difficulty: Difficulty,
  drawnCard: Card,
  hand: Card[],
  memory: AIMemory,
  aiSeat: number
): AIDecision {
  switch (difficulty) {
    case 'beginner': return beginnerDecide(drawnCard, hand);
    case 'intermediate': return intermediateDecide(drawnCard, hand, memory, aiSeat);
    case 'hardcore': return hardcoreDecide(drawnCard, hand, memory, aiSeat);
  }
}

export function aiPowerTarget(
  difficulty: Difficulty,
  power: PowerType,
  aiSeat: number,
  aiHand: Card[],
  opponents: Opponent[],
  memory: AIMemory
): AIPowerDecision | null {
  switch (difficulty) {
    case 'beginner': return beginnerPowerTarget(power, aiSeat, aiHand, opponents);
    case 'intermediate': return intermediatePowerTarget(power, aiSeat, aiHand, opponents, memory);
    case 'hardcore': return hardcorePowerTarget(power, aiSeat, aiHand, opponents, memory);
  }
}

export function updateMemory(
  memory: AIMemory,
  seatIndex: number,
  cardIndex: number,
  card: Card
): AIMemory {
  const newKnown = new Map(memory.knownCards);
  const seatKnown = new Map(newKnown.get(seatIndex) || new Map());
  seatKnown.set(cardIndex, { ...card });
  newKnown.set(seatIndex, seatKnown);
  return {
    knownCards: newKnown,
    discardedCards: [...memory.discardedCards],
  };
}

export function clearMemoryForSeat(memory: AIMemory, seatIndex: number, cardIndex: number): AIMemory {
  const newKnown = new Map(memory.knownCards);
  const seatKnown = new Map(newKnown.get(seatIndex) || new Map());
  seatKnown.delete(cardIndex);
  newKnown.set(seatIndex, seatKnown);
  return {
    knownCards: newKnown,
    discardedCards: [...memory.discardedCards],
  };
}
