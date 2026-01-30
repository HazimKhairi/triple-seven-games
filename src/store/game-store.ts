import { create } from 'zustand';
import {
  GameState,
  GamePhase,
  Difficulty,
  Card,
  PowerType,
  Toast,
  AIMemory,
  PlayerInfo,
  GameConfig,
  getCardPower,
  calculateHandScore,
  getNextSeat,
  powerName,
  createEmptyAIMemory,
} from '@/types/game';
import { createDeck, shuffleDeck, dealCards } from '@/lib/deck';
import {
  aiChooseDraw,
  aiDecide,
  aiPowerTarget,
  updateMemory,
  AIPowerDecision,
  Opponent,
} from '@/lib/ai-logic';

function generateToastId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Timer interval stored outside Zustand (not serializable)
let _timerInterval: ReturnType<typeof setInterval> | null = null;

const TURN_TIMER_SECONDS = 15;

interface GameActions {
  startGame: (config: GameConfig) => void;
  resetGame: () => void;
  drawFromDeck: () => void;
  drawFromDiscard: () => void;
  swapWithHand: (handIndex: number) => void;
  discardDrawn: () => void;
  selectPowerTarget: (targetSeat: number, targetIndex: number) => void;
  executeAITurn: (seat: number) => void;
  _endTurn: () => void;
  _endGame: () => void;
  _startTimer: () => void;
  _clearTimer: () => void;
  _onTimerExpired: () => void;
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;
  setPhase: (phase: GamePhase) => void;
}

const initialState: Omit<GameState, keyof GameActions> = {
  phase: 'menu',
  difficulty: 'beginner',
  deck: [],
  discardPile: [],
  players: [],
  currentTurnSeat: 0,
  localPlayerSeat: 0,
  drawnCard: null,
  drawnFrom: null,
  activePower: null,
  powerSourceSeat: null,
  aiMemories: new Map(),
  toasts: [],
  winnerSeat: null,
  turnCount: 0,
  roomId: null,
  isOnline: false,
  swapSelectedOwnIndex: null,
  turnTimer: TURN_TIMER_SECONDS,
  turnTimerMax: TURN_TIMER_SECONDS,
};

export const useGameStore = create<GameState & GameActions>((set, get) => ({
  ...initialState,

  startGame: (config: GameConfig) => {
    const deck = shuffleDeck(createDeck(true));
    let remaining = deck;
    const players: PlayerInfo[] = config.seats.map((seat, i) => {
      const { dealt, remaining: rest } = dealCards(remaining, 4);
      remaining = rest;
      dealt.forEach((c) => { c.isFaceUp = false; });
      return {
        id: `seat-${i}`,
        seatIndex: i,
        kind: seat.kind,
        name: seat.name,
        hand: dealt,
        score: 0,
        isLocal: seat.isLocal ?? (seat.kind === 'human' && i === 0),
      };
    });

    const firstDiscard = { ...remaining[0], isFaceUp: true };
    const deckRemaining = remaining.slice(1);

    // Create AI memories
    const aiMemories = new Map<number, AIMemory>();
    players.forEach((p) => {
      if (p.kind === 'ai') {
        aiMemories.set(p.seatIndex, createEmptyAIMemory());
      }
    });

    // Find the first local human seat
    const localSeat = players.find((p) => p.isLocal)?.seatIndex ?? 0;

    set({
      phase: 'turn_draw',
      difficulty: config.difficulty,
      deck: deckRemaining,
      discardPile: [firstDiscard],
      players,
      currentTurnSeat: 0,
      localPlayerSeat: localSeat,
      drawnCard: null,
      drawnFrom: null,
      activePower: null,
      powerSourceSeat: null,
      aiMemories,
      toasts: [],
      winnerSeat: null,
      turnCount: 0,
      roomId: null,
      isOnline: config.isOnline,
      swapSelectedOwnIndex: null,
      turnTimer: TURN_TIMER_SECONDS,
      turnTimerMax: TURN_TIMER_SECONDS,
    });

    // If first seat is AI, trigger AI turn
    if (players[0].kind === 'ai') {
      setTimeout(() => get().executeAITurn(0), 800);
    } else {
      // Start timer for first human turn
      get()._startTimer();
    }
  },

  resetGame: () => {
    get()._clearTimer();
    set({ ...initialState, aiMemories: new Map() });
  },

  drawFromDeck: () => {
    const { deck, phase, currentTurnSeat, players } = get();
    if (phase !== 'turn_draw' || deck.length === 0) return;
    const current = players[currentTurnSeat];
    if (!current.isLocal) return;

    const drawnCard = { ...deck[0], isFaceUp: true };
    set({
      deck: deck.slice(1),
      drawnCard,
      drawnFrom: 'deck',
      phase: 'turn_decision',
    });
  },

  drawFromDiscard: () => {
    const { discardPile, phase, currentTurnSeat, players } = get();
    if (phase !== 'turn_draw' || discardPile.length === 0) return;
    const current = players[currentTurnSeat];
    if (!current.isLocal) return;

    const drawnCard = { ...discardPile[discardPile.length - 1], isFaceUp: true };
    set({
      discardPile: discardPile.slice(0, -1),
      drawnCard,
      drawnFrom: 'discard',
      phase: 'turn_decision',
    });
  },

  swapWithHand: (handIndex: number) => {
    const { drawnCard, players, currentTurnSeat, discardPile, phase, aiMemories } = get();
    if (phase !== 'turn_decision' || !drawnCard) return;
    const current = players[currentTurnSeat];
    if (current.hand[handIndex].isLocked) {
      get().addToast('That card is locked!', 'warning');
      return;
    }

    const newPlayers = players.map((p) => ({ ...p, hand: [...p.hand] }));
    const newHand = newPlayers[currentTurnSeat].hand;
    const removedCard = { ...newHand[handIndex], isFaceUp: true };
    newHand[handIndex] = { ...drawnCard, isFaceUp: false };

    const newDiscardPile = [...discardPile, removedCard];

    // Update all AI memories — they see the discard
    const newMemories = new Map(aiMemories);
    for (const [aiSeat, mem] of newMemories) {
      let updated = { ...mem, knownCards: new Map(mem.knownCards), discardedCards: [...mem.discardedCards, removedCard] };
      // Clear knowledge of what was at this position for the current player
      const seatKnown = new Map(updated.knownCards.get(currentTurnSeat) || new Map());
      seatKnown.delete(handIndex);
      updated.knownCards.set(currentTurnSeat, seatKnown);
      // If this AI is the one who swapped, remember what it placed
      if (aiSeat === currentTurnSeat) {
        updated = updateMemory(updated, currentTurnSeat, handIndex, drawnCard);
      }
      newMemories.set(aiSeat, updated);
    }

    const power = getCardPower(removedCard);

    set({
      players: newPlayers,
      discardPile: newDiscardPile,
      drawnCard: null,
      drawnFrom: null,
      aiMemories: newMemories,
    });

    if (power) {
      get().addToast(`${removedCard.isJoker ? 'Joker' : removedCard.rank} power: ${powerName(power)}!`, 'power');
      set({ activePower: power, powerSourceSeat: currentTurnSeat, phase: 'power_target' });
    } else {
      get()._endTurn();
    }
  },

  discardDrawn: () => {
    const { drawnCard, discardPile, phase, aiMemories } = get();
    if (phase !== 'turn_decision' || !drawnCard) return;

    const discarded = { ...drawnCard, isFaceUp: true };
    const newDiscardPile = [...discardPile, discarded];
    const power = getCardPower(discarded);

    // Update AI memories
    const newMemories = new Map(aiMemories);
    for (const [aiSeat, mem] of newMemories) {
      newMemories.set(aiSeat, {
        ...mem,
        knownCards: new Map(mem.knownCards),
        discardedCards: [...mem.discardedCards, discarded],
      });
    }

    set({
      discardPile: newDiscardPile,
      drawnCard: null,
      drawnFrom: null,
      aiMemories: newMemories,
    });

    if (power) {
      get().addToast(`${discarded.isJoker ? 'Joker' : discarded.rank} power: ${powerName(power)}!`, 'power');
      set({ activePower: power, powerSourceSeat: get().currentTurnSeat, phase: 'power_target' });
    } else {
      get()._endTurn();
    }
  },

  selectPowerTarget: (targetSeat: number, targetIndex: number) => {
    const state = get();
    const { activePower, players, currentTurnSeat, aiMemories, swapSelectedOwnIndex } = state;
    if (!activePower) return;

    const newPlayers = players.map((p) => ({ ...p, hand: [...p.hand] }));
    const currentPlayer = newPlayers[currentTurnSeat];
    let newMemories = new Map(aiMemories);

    switch (activePower) {
      case 'unlock': {
        const hand = newPlayers[targetSeat].hand;
        if (hand[targetIndex].isLocked) {
          hand[targetIndex] = { ...hand[targetIndex], isLocked: false };
          get().addToast(`Unlocked ${newPlayers[targetSeat].name}'s card #${targetIndex + 1}!`, 'info');
        }
        break;
      }
      case 'peek': {
        const hand = newPlayers[targetSeat].hand;
        if (hand[targetIndex].isLocked) {
          get().addToast('Cannot peek at a locked card!', 'warning');
          return;
        }
        hand[targetIndex] = { ...hand[targetIndex], isPeeking: true };
        get().addToast(`Peeking at ${newPlayers[targetSeat].name}'s card #${targetIndex + 1}...`, 'info');

        set({
          players: newPlayers,
          activePower: null,
          powerSourceSeat: null,
        });

        setTimeout(() => {
          const s = get();
          const updatedPlayers = s.players.map((p) => ({ ...p, hand: [...p.hand] }));
          updatedPlayers[targetSeat].hand[targetIndex] = {
            ...updatedPlayers[targetSeat].hand[targetIndex],
            isPeeking: false,
          };
          set({ players: updatedPlayers });
        }, 3000);

        get()._endTurn();
        return;
      }
      case 'swap': {
        // Two-step: first select own card, then opponent card
        if (targetSeat === currentTurnSeat) {
          // Selecting own card
          currentPlayer.hand.forEach((c, i) => {
            currentPlayer.hand[i] = { ...c, isSelected: i === targetIndex };
          });
          set({ players: newPlayers, swapSelectedOwnIndex: targetIndex });
          return; // Wait for opponent card
        }

        // Selecting opponent card
        const ownIdx = swapSelectedOwnIndex;
        if (ownIdx === null) {
          get().addToast('Select your own card first!', 'warning');
          return;
        }
        if (newPlayers[targetSeat].hand[targetIndex].isLocked) {
          get().addToast('Cannot swap a locked card!', 'warning');
          return;
        }
        if (currentPlayer.hand[ownIdx].isLocked) {
          get().addToast('Your selected card is locked!', 'warning');
          return;
        }

        const temp = { ...currentPlayer.hand[ownIdx] };
        currentPlayer.hand[ownIdx] = { ...newPlayers[targetSeat].hand[targetIndex], isSelected: false };
        newPlayers[targetSeat].hand[targetIndex] = { ...temp, isSelected: false };
        currentPlayer.hand.forEach((c, i) => { currentPlayer.hand[i] = { ...c, isSelected: false }; });

        // Update AI memories
        for (const [aiSeat, mem] of newMemories) {
          const updated = { ...mem, knownCards: new Map(mem.knownCards) };
          const seatKnownOwn = new Map(updated.knownCards.get(currentTurnSeat) || new Map());
          seatKnownOwn.delete(ownIdx);
          updated.knownCards.set(currentTurnSeat, seatKnownOwn);
          const seatKnownTarget = new Map(updated.knownCards.get(targetSeat) || new Map());
          seatKnownTarget.delete(targetIndex);
          updated.knownCards.set(targetSeat, seatKnownTarget);
          newMemories.set(aiSeat, updated);
        }

        get().addToast('Swapped cards!', 'info');
        break;
      }
      case 'lock': {
        newPlayers[targetSeat].hand[targetIndex] = {
          ...newPlayers[targetSeat].hand[targetIndex],
          isLocked: true,
        };
        get().addToast(`Locked ${newPlayers[targetSeat].name}'s card #${targetIndex + 1}!`, 'info');
        break;
      }
      case 'mass_swap': {
        // Swap all unlocked cards between current player and target
        for (let i = 0; i < 4; i++) {
          if (!currentPlayer.hand[i].isLocked && !newPlayers[targetSeat].hand[i].isLocked) {
            const temp = { ...currentPlayer.hand[i] };
            currentPlayer.hand[i] = { ...newPlayers[targetSeat].hand[i] };
            newPlayers[targetSeat].hand[i] = { ...temp };
          }
        }
        // Clear AI memories for swapped seats
        for (const [aiSeat, mem] of newMemories) {
          const updated = { ...mem, knownCards: new Map(mem.knownCards) };
          updated.knownCards.set(currentTurnSeat, new Map());
          updated.knownCards.set(targetSeat, new Map());
          newMemories.set(aiSeat, updated);
        }
        get().addToast(`Mass swap with ${newPlayers[targetSeat].name}!`, 'power');
        break;
      }
    }

    set({
      players: newPlayers,
      activePower: null,
      powerSourceSeat: null,
      aiMemories: newMemories,
      swapSelectedOwnIndex: null,
    });

    get()._endTurn();
  },

  _endTurn: () => {
    get()._clearTimer();
    const { deck, currentTurnSeat, players } = get();
    if (deck.length === 0) {
      get()._endGame();
      return;
    }

    const nextSeat = getNextSeat(currentTurnSeat);
    const nextPlayer = players[nextSeat];

    const turnCount = get().turnCount + (nextSeat === 0 ? 1 : 0); // increment per round

    set({
      currentTurnSeat: nextSeat,
      turnCount,
      swapSelectedOwnIndex: null,
    });

    if (nextPlayer.kind === 'ai') {
      set({ phase: 'turn_draw' }); // Show AI is drawing
      setTimeout(() => get().executeAITurn(nextSeat), 1000);
    } else if (nextPlayer.isLocal) {
      set({ phase: 'turn_draw' });
      get()._startTimer();
    }
    // If remote human (online), phase stays and we wait for WS message
  },

  executeAITurn: (seat: number) => {
    const state = get();
    const { players, deck, discardPile, difficulty, aiMemories } = state;

    if (deck.length === 0) {
      get()._endGame();
      return;
    }

    const aiPlayer = players[seat];
    const memory = aiMemories.get(seat) || createEmptyAIMemory();

    const newPlayers = players.map((p) => ({ ...p, hand: [...p.hand] }));
    let newDeck = [...deck];
    let newDiscardPile = [...discardPile];
    let newMemory = { ...memory, knownCards: new Map(memory.knownCards), discardedCards: [...memory.discardedCards] };

    // Build opponents list
    const opponents: Opponent[] = newPlayers
      .filter((p) => p.seatIndex !== seat)
      .map((p) => ({ seatIndex: p.seatIndex, hand: p.hand }));

    // 1. Draw
    const discardTop = newDiscardPile.length > 0 ? newDiscardPile[newDiscardPile.length - 1] : null;
    const drawChoice = aiChooseDraw(difficulty, discardTop);

    let drawnCard: Card;
    if (drawChoice === 'discard' && discardTop) {
      drawnCard = { ...newDiscardPile.pop()!, isFaceUp: true };
      get().addToast(`${aiPlayer.name} drew from discard`, 'info');
    } else {
      drawnCard = { ...newDeck[0], isFaceUp: true };
      newDeck = newDeck.slice(1);
      get().addToast(`${aiPlayer.name} drew from deck`, 'info');
    }

    // 2. Decide
    const decision = aiDecide(difficulty, drawnCard, newPlayers[seat].hand, newMemory, seat);

    if (decision.action === 'swap' && decision.swapIndex !== undefined) {
      const idx = decision.swapIndex;
      if (!newPlayers[seat].hand[idx].isLocked) {
        const removed = { ...newPlayers[seat].hand[idx], isFaceUp: true };
        newPlayers[seat].hand[idx] = { ...drawnCard, isFaceUp: false };
        newDiscardPile.push(removed);

        newMemory = updateMemory(newMemory, seat, idx, drawnCard);
        newMemory.discardedCards.push(removed);

        get().addToast(`${aiPlayer.name} swapped a card`, 'info');

        const power = getCardPower(removed);
        if (power) {
          get().addToast(`${aiPlayer.name} used ${removed.isJoker ? 'Joker' : removed.rank}: ${powerName(power)}!`, 'power');
          const powerDecision = aiPowerTarget(difficulty, power, seat, newPlayers[seat].hand, opponents, newMemory);
          if (powerDecision) {
            applyAIPower(powerDecision, seat, newPlayers, newMemory, get().addToast);
          }
        }
      } else {
        newDiscardPile.push({ ...drawnCard, isFaceUp: true });
        newMemory.discardedCards.push(drawnCard);
      }
    } else {
      const discarded = { ...drawnCard, isFaceUp: true };
      newDiscardPile.push(discarded);
      newMemory.discardedCards.push(discarded);

      const power = getCardPower(discarded);
      if (power) {
        get().addToast(`${aiPlayer.name} used ${discarded.isJoker ? 'Joker' : discarded.rank}: ${powerName(power)}!`, 'power');
        const opponents2: Opponent[] = newPlayers
          .filter((p) => p.seatIndex !== seat)
          .map((p) => ({ seatIndex: p.seatIndex, hand: p.hand }));
        const powerDecision = aiPowerTarget(difficulty, power, seat, newPlayers[seat].hand, opponents2, newMemory);
        if (powerDecision) {
          applyAIPower(powerDecision, seat, newPlayers, newMemory, get().addToast);
        }
      }
    }

    // Update this AI's memory
    const newMemories = new Map(aiMemories);
    newMemories.set(seat, newMemory);

    set({
      players: newPlayers,
      deck: newDeck,
      discardPile: newDiscardPile,
      aiMemories: newMemories,
    });

    // Check end condition then advance turn
    if (newDeck.length === 0) {
      setTimeout(() => get()._endGame(), 800);
    } else {
      get()._endTurn();
    }
  },

  _startTimer: () => {
    // Clear any existing timer
    if (_timerInterval) clearInterval(_timerInterval);
    set({ turnTimer: TURN_TIMER_SECONDS });

    _timerInterval = setInterval(() => {
      const s = get();
      const newTime = s.turnTimer - 1;
      if (newTime <= 0) {
        get()._clearTimer();
        get()._onTimerExpired();
      } else {
        set({ turnTimer: newTime });
      }
    }, 1000);
  },

  _clearTimer: () => {
    if (_timerInterval) {
      clearInterval(_timerInterval);
      _timerInterval = null;
    }
  },

  _onTimerExpired: () => {
    const { phase, currentTurnSeat, players, deck, discardPile, drawnCard, activePower } = get();
    const current = players[currentTurnSeat];
    // Only auto-act for local human players
    if (!current.isLocal || current.kind === 'ai') return;

    get().addToast('Time\'s up! Auto-playing...', 'warning');

    if (phase === 'turn_draw') {
      // Auto-draw from deck
      if (deck.length > 0) {
        get().drawFromDeck();
        // After drawing, if we're now in turn_decision, auto-discard after a brief moment
        setTimeout(() => {
          const s2 = get();
          if (s2.phase === 'turn_decision' && s2.drawnCard) {
            get().discardDrawn();
          }
        }, 500);
      }
    } else if (phase === 'turn_decision' && drawnCard) {
      // Auto-discard the drawn card
      get().discardDrawn();
    } else if (phase === 'power_target' && activePower) {
      // Auto-skip power: just end the turn without using the power
      set({ activePower: null, powerSourceSeat: null, swapSelectedOwnIndex: null });
      get()._endTurn();
    }
  },

  _endGame: () => {
    get()._clearTimer();
    const { players } = get();
    const newPlayers = players.map((p) => {
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

    set({
      phase: 'game_over',
      players: newPlayers,
      winnerSeat,
    });

    const winner = newPlayers[winnerSeat];
    const localPlayer = newPlayers.find((p) => p.isLocal);
    if (localPlayer && localPlayer.seatIndex === winnerSeat) {
      get().addToast(`You win with ${lowestScore} points!`, 'success');
    } else {
      get().addToast(`${winner.name} wins with ${lowestScore} points!`, 'warning');
    }
  },

  addToast: (message: string, type: Toast['type'] = 'info') => {
    const id = generateToastId();
    set((s) => ({ toasts: [...s.toasts.slice(-4), { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3500);
  },

  removeToast: (id: string) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  setPhase: (phase: GamePhase) => set({ phase }),
}));

// Apply AI power card effect (mutates newPlayers and memory in place)
function applyAIPower(
  decision: AIPowerDecision,
  aiSeat: number,
  newPlayers: PlayerInfo[],
  memory: AIMemory,
  addToast: (msg: string, type?: Toast['type']) => void
) {
  const aiPlayer = newPlayers[aiSeat];

  switch (decision.power) {
    case 'unlock': {
      const hand = newPlayers[decision.targetSeat].hand;
      if (hand[decision.targetIndex].isLocked) {
        hand[decision.targetIndex] = { ...hand[decision.targetIndex], isLocked: false };
        addToast(`${aiPlayer.name} unlocked ${newPlayers[decision.targetSeat].name}'s card`, 'info');
      }
      break;
    }
    case 'peek': {
      const hand = newPlayers[decision.targetSeat].hand;
      if (!hand[decision.targetIndex].isLocked) {
        const card = hand[decision.targetIndex];
        // AI remembers peeked card
        const seatKnown = new Map(memory.knownCards.get(decision.targetSeat) || new Map());
        seatKnown.set(decision.targetIndex, { ...card });
        memory.knownCards.set(decision.targetSeat, seatKnown);
        addToast(`${aiPlayer.name} peeked at ${newPlayers[decision.targetSeat].name}'s card`, 'info');
      }
      break;
    }
    case 'swap': {
      const ownIdx = decision.swapOwnIndex ?? 0;
      const targetHand = newPlayers[decision.targetSeat].hand;
      const ownHand = newPlayers[aiSeat].hand;
      if (!ownHand[ownIdx].isLocked && !targetHand[decision.targetIndex].isLocked) {
        const temp = { ...ownHand[ownIdx] };
        ownHand[ownIdx] = { ...targetHand[decision.targetIndex] };
        targetHand[decision.targetIndex] = { ...temp };

        // Clear memory for swapped positions
        const ownKnown = new Map(memory.knownCards.get(aiSeat) || new Map());
        ownKnown.delete(ownIdx);
        memory.knownCards.set(aiSeat, ownKnown);
        const targetKnown = new Map(memory.knownCards.get(decision.targetSeat) || new Map());
        targetKnown.delete(decision.targetIndex);
        memory.knownCards.set(decision.targetSeat, targetKnown);

        addToast(`${aiPlayer.name} swapped cards with ${newPlayers[decision.targetSeat].name}!`, 'warning');
      }
      break;
    }
    case 'lock': {
      const hand = newPlayers[decision.targetSeat].hand;
      hand[decision.targetIndex] = { ...hand[decision.targetIndex], isLocked: true };
      addToast(`${aiPlayer.name} locked ${newPlayers[decision.targetSeat].name}'s card`, 'info');
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
      addToast(`${aiPlayer.name} used Mass Swap with ${newPlayers[decision.targetSeat].name}!`, 'power');
      break;
    }
  }
}
