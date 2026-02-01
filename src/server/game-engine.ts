/**
 * Server-side game engine. Pure functions that process game actions
 * and return new state. Used by game-room.ts for server-authoritative logic.
 */
import {
  Card,
  PlayerInfo,
  AIMemory,
  Difficulty,
  PowerType,
  getCardPower,
  getCardValue,
  calculateHandScore,
  getNextSeat,
  createEmptyAIMemory,
  powerName,
} from '@/types/game';
import { createDeck, shuffleDeck, dealCards } from '@/lib/deck';
import {
  aiChooseDraw,
  aiDecide,
  aiPowerTarget,
  updateMemory,
  Opponent,
  AIPowerDecision,
} from '@/lib/ai-logic';

export interface ServerGameState {
  deck: Card[];
  discardPile: Card[];
  players: PlayerInfo[];
  currentTurnSeat: number;
  drawnCard: Card | null;
  drawnFrom: 'deck' | 'discard' | null;
  activePower: PowerType | null;
  powerSourceSeat: number | null;
  aiMemories: Map<number, AIMemory>;
  winnerSeat: number | null;
  turnCount: number;
  difficulty: Difficulty;
  phase: 'turn_draw' | 'turn_decision' | 'power_target' | 'game_over';
  swapSource: { seat: number; index: number } | null;
}

export interface GameEvent {
  type: 'toast';
  message: string;
  toastType: 'info' | 'power' | 'warning' | 'success';
}

export interface EngineResult {
  state: ServerGameState;
  events: GameEvent[];
}

export function createInitialState(
  seatConfigs: Array<{ kind: 'human' | 'ai'; name: string; socketId?: string }>,
  difficulty: Difficulty
): ServerGameState {
  const deck = shuffleDeck(createDeck(true));
  let remaining = deck;
  const players: PlayerInfo[] = seatConfigs.map((config, i) => {
    const { dealt, remaining: rest } = dealCards(remaining, 4);
    remaining = rest;
    dealt.forEach((c) => { c.isFaceUp = false; });
    return {
      id: config.socketId || `seat-${i}`,
      seatIndex: i,
      kind: config.kind,
      name: config.name,
      hand: dealt,
      score: 0,
      isLocal: false, // server doesn't use isLocal
    };
  });

  const firstDiscard = { ...remaining[0], isFaceUp: true };
  const deckRemaining = remaining.slice(1);

  const aiMemories = new Map<number, AIMemory>();
  players.forEach((p) => {
    if (p.kind === 'ai') {
      aiMemories.set(p.seatIndex, createEmptyAIMemory());
    }
  });

  return {
    deck: deckRemaining,
    discardPile: [firstDiscard],
    players,
    currentTurnSeat: 0,
    drawnCard: null,
    drawnFrom: null,
    activePower: null,
    powerSourceSeat: null,
    aiMemories,
    winnerSeat: null,
    turnCount: 0,
    difficulty,
    phase: 'turn_draw',
    swapSource: null,
  };
}

export function processDrawFromDeck(state: ServerGameState, seat: number): EngineResult {
  const events: GameEvent[] = [];
  if (state.phase !== 'turn_draw' || state.currentTurnSeat !== seat || state.deck.length === 0) {
    return { state, events: [{ type: 'toast', message: 'Invalid action', toastType: 'warning' }] };
  }

  const drawnCard = { ...state.deck[0], isFaceUp: true };
  return {
    state: {
      ...state,
      deck: state.deck.slice(1),
      drawnCard,
      drawnFrom: 'deck',
      phase: 'turn_decision',
    },
    events,
  };
}

export function processDrawFromDiscard(state: ServerGameState, seat: number): EngineResult {
  const events: GameEvent[] = [];
  if (state.phase !== 'turn_draw' || state.currentTurnSeat !== seat || state.discardPile.length === 0) {
    return { state, events: [{ type: 'toast', message: 'Invalid action', toastType: 'warning' }] };
  }

  const drawnCard = { ...state.discardPile[state.discardPile.length - 1], isFaceUp: true };
  return {
    state: {
      ...state,
      discardPile: state.discardPile.slice(0, -1),
      drawnCard,
      drawnFrom: 'discard',
      phase: 'turn_decision',
    },
    events,
  };
}

export function processSwapWithHand(state: ServerGameState, seat: number, handIndex: number): EngineResult {
  const events: GameEvent[] = [];
  if (state.phase !== 'turn_decision' || state.currentTurnSeat !== seat || !state.drawnCard) {
    return { state, events: [{ type: 'toast', message: 'Invalid action', toastType: 'warning' }] };
  }

  const player = state.players[seat];
  if (player.hand[handIndex].isLocked) {
    return { state, events: [{ type: 'toast', message: 'Card is locked!', toastType: 'warning' }] };
  }

  const newPlayers = state.players.map((p) => ({ ...p, hand: [...p.hand] }));
  const removedCard = { ...newPlayers[seat].hand[handIndex], isFaceUp: true };
  newPlayers[seat].hand[handIndex] = { ...state.drawnCard, isFaceUp: false };

  const newDiscardPile = [...state.discardPile, removedCard];
  const power = getCardPower(removedCard);

  // Update AI memories
  const newMemories = new Map(state.aiMemories);
  for (const [aiSeat, mem] of newMemories) {
    let updated = { ...mem, knownCards: new Map(mem.knownCards), discardedCards: [...mem.discardedCards, removedCard] };
    const seatKnown = new Map(updated.knownCards.get(seat) || new Map());
    seatKnown.delete(handIndex);
    updated.knownCards.set(seat, seatKnown);
    if (aiSeat === seat) {
      updated = updateMemory(updated, seat, handIndex, state.drawnCard);
    }
    newMemories.set(aiSeat, updated);
  }

  if (power) {
    events.push({ type: 'toast', message: `${removedCard.isJoker ? 'Joker' : removedCard.rank} power: ${powerName(power)}!`, toastType: 'power' });
  }

  const newState: ServerGameState = {
    ...state,
    players: newPlayers,
    discardPile: newDiscardPile,
    drawnCard: null,
    drawnFrom: null,
    aiMemories: newMemories,
    activePower: power || null,
    powerSourceSeat: power ? seat : null,
    phase: power ? 'power_target' : state.phase,
  };

  if (!power) {
    return advanceTurn(newState, events);
  }
  return { state: newState, events };
}

export function processDiscardDrawn(state: ServerGameState, seat: number): EngineResult {
  const events: GameEvent[] = [];
  if (state.phase !== 'turn_decision' || state.currentTurnSeat !== seat || !state.drawnCard) {
    return { state, events: [{ type: 'toast', message: 'Invalid action', toastType: 'warning' }] };
  }

  const discarded = { ...state.drawnCard, isFaceUp: true };
  const newDiscardPile = [...state.discardPile, discarded];
  const power = getCardPower(discarded);

  const newMemories = new Map(state.aiMemories);
  for (const [aiSeat, mem] of newMemories) {
    newMemories.set(aiSeat, {
      ...mem,
      knownCards: new Map(mem.knownCards),
      discardedCards: [...mem.discardedCards, discarded],
    });
  }

  if (power) {
    events.push({ type: 'toast', message: `${discarded.isJoker ? 'Joker' : discarded.rank} power: ${powerName(power)}!`, toastType: 'power' });
  }

  const newState: ServerGameState = {
    ...state,
    discardPile: newDiscardPile,
    drawnCard: null,
    drawnFrom: null,
    aiMemories: newMemories,
    activePower: power || null,
    powerSourceSeat: power ? seat : null,
    phase: power ? 'power_target' : state.phase,
  };

  if (!power) {
    return advanceTurn(newState, events);
  }
  return { state: newState, events };
}

export function processPowerTarget(
  state: ServerGameState,
  seat: number,
  targetSeat: number,
  targetIndex: number
): EngineResult {
  const events: GameEvent[] = [];
  if (!state.activePower || state.currentTurnSeat !== seat) {
    return { state, events };
  }

  const newPlayers = state.players.map((p) => ({ ...p, hand: [...p.hand] }));
  const currentPlayer = newPlayers[seat];
  let newMemories = new Map(state.aiMemories);
  const power = state.activePower;

  switch (power) {
    case 'unlock': {
      const hand = newPlayers[targetSeat].hand;
      if (hand[targetIndex].isLocked) {
        hand[targetIndex] = { ...hand[targetIndex], isLocked: false };
        events.push({ type: 'toast', message: `Unlocked ${newPlayers[targetSeat].name}'s card!`, toastType: 'info' });
      }
      break;
    }
    case 'peek': {
      const hand = newPlayers[targetSeat].hand;
      if (hand[targetIndex].isLocked) {
        return { state, events: [{ type: 'toast', message: 'Cannot peek at locked card', toastType: 'warning' }] };
      }
      hand[targetIndex] = { ...hand[targetIndex], isPeeking: true };
      events.push({ type: 'toast', message: `Peeking at ${newPlayers[targetSeat].name}'s card...`, toastType: 'info' });
      // Note: Server should schedule isPeeking=false after 3s
      break;
    }
    case 'swap': {
      // Global Swap Logic:
      // 1. If no source selected yet, set source.
      // 2. If source selected, perform swap with target.

      const { swapSource } = state;

      if (!swapSource) {
        // Step 1: Select Source
        if (newPlayers[targetSeat].hand[targetIndex].isLocked) {
          return { state, events: [{ type: 'toast', message: 'Cannot select locked card', toastType: 'warning' }] };
        }

        // Mark as selected (visual only, server state tracks it via swapSource)
        // We need to return state with swapSource set
        return {
          state: { ...state, players: newPlayers, swapSource: { seat: targetSeat, index: targetIndex } },
          events: [{ type: 'toast', message: 'Select second card to swap', toastType: 'info' }]
        };
      }

      // Step 2: Select Target (swapSource is already set)
      const sourceSeat = swapSource.seat;
      const sourceIndex = swapSource.index;

      if (sourceSeat === targetSeat && sourceIndex === targetIndex) {
        return { state, events: [{ type: 'toast', message: 'Select a different card', toastType: 'warning' }] };
      }

      if (newPlayers[targetSeat].hand[targetIndex].isLocked) {
        return { state, events: [{ type: 'toast', message: 'Cannot swap with locked card', toastType: 'warning' }] };
      }

      // Perform Swap
      const temp = { ...newPlayers[sourceSeat].hand[sourceIndex] };
      newPlayers[sourceSeat].hand[sourceIndex] = { ...newPlayers[targetSeat].hand[targetIndex] };
      newPlayers[targetSeat].hand[targetIndex] = { ...temp };

      // Update Memories
      for (const [aiSeat, mem] of newMemories) {
        const updated = { ...mem, knownCards: new Map(mem.knownCards) };
        const sK = new Map(updated.knownCards.get(sourceSeat) || new Map());
        sK.delete(sourceIndex);
        updated.knownCards.set(sourceSeat, sK);

        const tK = new Map(updated.knownCards.get(targetSeat) || new Map());
        tK.delete(targetIndex);
        updated.knownCards.set(targetSeat, tK);

        newMemories.set(aiSeat, updated);
      }

      events.push({ type: 'toast', message: 'Swapped cards!', toastType: 'info' });
      break;
    }
    case 'lock': {
      newPlayers[targetSeat].hand[targetIndex] = { ...newPlayers[targetSeat].hand[targetIndex], isLocked: true };
      events.push({ type: 'toast', message: `Locked ${newPlayers[targetSeat].name}'s card!`, toastType: 'info' });
      break;
    }
    case 'mass_swap': {
      for (let i = 0; i < 4; i++) {
        if (!currentPlayer.hand[i].isLocked && !newPlayers[targetSeat].hand[i].isLocked) {
          const temp = { ...currentPlayer.hand[i] };
          currentPlayer.hand[i] = { ...newPlayers[targetSeat].hand[i] };
          newPlayers[targetSeat].hand[i] = { ...temp };
        }
      }
      for (const [aiSeat, mem] of newMemories) {
        const updated = { ...mem, knownCards: new Map(mem.knownCards) };
        updated.knownCards.set(seat, new Map());
        updated.knownCards.set(targetSeat, new Map());
        newMemories.set(aiSeat, updated);
      }
      events.push({ type: 'toast', message: `Mass swap with ${newPlayers[targetSeat].name}!`, toastType: 'power' });
      break;
    }
  }

  const newState: ServerGameState = {
    ...state,
    players: newPlayers,
    activePower: null, // Reset only if action completed (swap step 2, or others)
    powerSourceSeat: null,
    aiMemories: newMemories,
    swapSource: null,
  };

  return advanceTurn(newState, events);
}

export function executeAITurnServer(state: ServerGameState): EngineResult {
  const events: GameEvent[] = [];
  const seat = state.currentTurnSeat;
  const aiPlayer = state.players[seat];
  if (aiPlayer.kind !== 'ai' || state.deck.length === 0) {
    return endGame(state, events);
  }

  const memory = state.aiMemories.get(seat) || createEmptyAIMemory();
  const newPlayers = state.players.map((p) => ({ ...p, hand: [...p.hand] }));
  let newDeck = [...state.deck];
  let newDiscardPile = [...state.discardPile];
  let newMemory = { ...memory, knownCards: new Map(memory.knownCards), discardedCards: [...memory.discardedCards] };

  const opponents: Opponent[] = newPlayers
    .filter((p) => p.seatIndex !== seat)
    .map((p) => ({ seatIndex: p.seatIndex, hand: p.hand }));

  // Draw
  const discardTop = newDiscardPile.length > 0 ? newDiscardPile[newDiscardPile.length - 1] : null;
  const drawChoice = aiChooseDraw(state.difficulty, discardTop);

  let drawnCard: Card;
  if (drawChoice === 'discard' && discardTop) {
    drawnCard = { ...newDiscardPile.pop()!, isFaceUp: true };
    events.push({ type: 'toast', message: `${aiPlayer.name} drew from discard`, toastType: 'info' });
  } else {
    drawnCard = { ...newDeck[0], isFaceUp: true };
    newDeck = newDeck.slice(1);
    events.push({ type: 'toast', message: `${aiPlayer.name} drew from deck`, toastType: 'info' });
  }

  // Decide
  const decision = aiDecide(state.difficulty, drawnCard, newPlayers[seat].hand, newMemory, seat);

  if (decision.action === 'swap' && decision.swapIndex !== undefined) {
    const idx = decision.swapIndex;
    if (!newPlayers[seat].hand[idx].isLocked) {
      const removed = { ...newPlayers[seat].hand[idx], isFaceUp: true };
      newPlayers[seat].hand[idx] = { ...drawnCard, isFaceUp: false };
      newDiscardPile.push(removed);
      newMemory = updateMemory(newMemory, seat, idx, drawnCard);
      newMemory.discardedCards.push(removed);
      events.push({ type: 'toast', message: `${aiPlayer.name} swapped a card`, toastType: 'info' });

      const power = getCardPower(removed);
      if (power) {
        events.push({ type: 'toast', message: `${aiPlayer.name} used ${powerName(power)}!`, toastType: 'power' });
        const pd = aiPowerTarget(state.difficulty, power, seat, newPlayers[seat].hand, opponents, newMemory);
        if (pd) applyAIPowerServer(pd, seat, newPlayers, newMemory, events);
      }
    } else {
      newDiscardPile.push({ ...drawnCard, isFaceUp: true });
    }
  } else {
    const discarded = { ...drawnCard, isFaceUp: true };
    newDiscardPile.push(discarded);
    newMemory.discardedCards.push(discarded);

    const power = getCardPower(discarded);
    if (power) {
      events.push({ type: 'toast', message: `${aiPlayer.name} used ${powerName(power)}!`, toastType: 'power' });
      const opponents2 = newPlayers.filter((p) => p.seatIndex !== seat).map((p) => ({ seatIndex: p.seatIndex, hand: p.hand }));
      const pd = aiPowerTarget(state.difficulty, power, seat, newPlayers[seat].hand, opponents2, newMemory);
      if (pd) applyAIPowerServer(pd, seat, newPlayers, newMemory, events);
    }
  }

  const newMemories = new Map(state.aiMemories);
  newMemories.set(seat, newMemory);

  const newState: ServerGameState = {
    ...state,
    players: newPlayers,
    deck: newDeck,
    discardPile: newDiscardPile,
    aiMemories: newMemories,
  };

  if (newDeck.length === 0) {
    return endGame(newState, events);
  }
  return advanceTurn(newState, events);
}

function advanceTurn(state: ServerGameState, events: GameEvent[]): EngineResult {
  if (state.deck.length === 0) {
    return endGame(state, events);
  }

  const nextSeat = getNextSeat(state.currentTurnSeat);
  const turnCount = state.turnCount + (nextSeat === 0 ? 1 : 0);

  return {
    state: {
      ...state,
      currentTurnSeat: nextSeat,
      turnCount,
      phase: 'turn_draw',
      swapSource: null,
    },
    events,
  };
}

function endGame(state: ServerGameState, events: GameEvent[]): EngineResult {
  const newPlayers = state.players.map((p) => {
    const revealedHand = p.hand.map((c) => ({ ...c, isFaceUp: true }));
    return { ...p, hand: revealedHand, score: calculateHandScore(revealedHand) };
  });

  let winnerSeat = 0;
  let lowestScore = Infinity;
  for (const p of newPlayers) {
    if (p.score < lowestScore) {
      lowestScore = p.score;
      winnerSeat = p.seatIndex;
    }
  }

  events.push({
    type: 'toast',
    message: `${newPlayers[winnerSeat].name} wins with ${lowestScore} points!`,
    toastType: 'success',
  });

  return {
    state: {
      ...state,
      players: newPlayers,
      winnerSeat,
      phase: 'game_over',
    },
    events,
  };
}

function applyAIPowerServer(
  decision: AIPowerDecision,
  aiSeat: number,
  newPlayers: PlayerInfo[],
  memory: AIMemory,
  events: GameEvent[]
) {
  const aiPlayer = newPlayers[aiSeat];
  switch (decision.power) {
    case 'unlock': {
      const hand = newPlayers[decision.targetSeat].hand;
      if (hand[decision.targetIndex].isLocked) {
        hand[decision.targetIndex] = { ...hand[decision.targetIndex], isLocked: false };
        events.push({ type: 'toast', message: `${aiPlayer.name} unlocked a card`, toastType: 'info' });
      }
      break;
    }
    case 'peek': {
      const hand = newPlayers[decision.targetSeat].hand;
      if (!hand[decision.targetIndex].isLocked) {
        const seatKnown = new Map(memory.knownCards.get(decision.targetSeat) || new Map());
        seatKnown.set(decision.targetIndex, { ...hand[decision.targetIndex] });
        memory.knownCards.set(decision.targetSeat, seatKnown);
        events.push({ type: 'toast', message: `${aiPlayer.name} peeked at a card`, toastType: 'info' });
      }
      break;
    }
    case 'swap': {
      const ownIdx = decision.swapOwnIndex ?? 0;
      const ownHand = newPlayers[aiSeat].hand;
      const targetHand = newPlayers[decision.targetSeat].hand;
      if (!ownHand[ownIdx].isLocked && !targetHand[decision.targetIndex].isLocked) {
        const temp = { ...ownHand[ownIdx] };
        ownHand[ownIdx] = { ...targetHand[decision.targetIndex] };
        targetHand[decision.targetIndex] = { ...temp };
        const ownK = new Map(memory.knownCards.get(aiSeat) || new Map());
        ownK.delete(ownIdx);
        memory.knownCards.set(aiSeat, ownK);
        const tK = new Map(memory.knownCards.get(decision.targetSeat) || new Map());
        tK.delete(decision.targetIndex);
        memory.knownCards.set(decision.targetSeat, tK);
        events.push({ type: 'toast', message: `${aiPlayer.name} swapped cards with ${newPlayers[decision.targetSeat].name}!`, toastType: 'warning' });
      }
      break;
    }
    case 'lock': {
      newPlayers[decision.targetSeat].hand[decision.targetIndex] = {
        ...newPlayers[decision.targetSeat].hand[decision.targetIndex],
        isLocked: true,
      };
      events.push({ type: 'toast', message: `${aiPlayer.name} locked a card`, toastType: 'info' });
      break;
    }
    case 'mass_swap': {
      const ownHand = newPlayers[aiSeat].hand;
      const targetHand = newPlayers[decision.targetSeat].hand;
      for (let i = 0; i < 4; i++) {
        if (!ownHand[i].isLocked && !targetHand[i].isLocked) {
          const temp = { ...ownHand[i] };
          ownHand[i] = { ...targetHand[i] };
          targetHand[i] = { ...temp };
        }
      }
      memory.knownCards.set(aiSeat, new Map());
      memory.knownCards.set(decision.targetSeat, new Map());
      events.push({ type: 'toast', message: `${aiPlayer.name} used Mass Swap!`, toastType: 'power' });
      break;
    }
  }
}
