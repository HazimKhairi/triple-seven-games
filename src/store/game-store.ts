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
  applyAIPower,
} from '@/lib/ai-logic';

function generateToastId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Timer interval stored outside Zustand (not serializable)
let _timerInterval: ReturnType<typeof setInterval> | null = null;

const TURN_TIMER_SECONDS = 15;
const PLAYER_TURN_TIMER_SECONDS = 45;

interface GameActions {
  startGame: (config: GameConfig) => void;
  resetGame: () => void;
  drawFromDeck: () => void;
  drawFromDiscard: () => void;
  swapWithHand: (handIndex: number, usePower?: boolean) => void;
  discardDrawn: (usePower?: boolean) => void;
  selectPowerTarget: (targetSeat: number, targetIndex: number) => void;
  rotateHands: (direction: 'left' | 'right') => void;
  executeAITurn: (seat: number) => void;
  setPhase: (phase: GamePhase) => void;
  triggerCardAnimation: (seatIndex: number, cardIndex: number, type: 'swap' | 'mass_swap') => void;
  _endTurn: () => void;
  _endGame: () => void;
  _startTimer: (resetCount?: boolean) => void;
  _clearTimer: () => void;
  _onTimerExpired: () => void;
  addToast: (message: string, type?: Toast['type'], seatIndex?: number) => void;
  removeToast: (id: string) => void;
  setVolume: (type: 'master' | 'music' | 'sfx', value: number) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
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
  swapSource: null,
  turnTimer: TURN_TIMER_SECONDS,
  turnTimerMax: TURN_TIMER_SECONDS,
  isDiscardBurned: false,
  masterVolume: 0.5,
  musicVolume: 0.5,
  sfxVolume: 0.5,
  cardAnimations: [],
  isPaused: false,
};

export const useGameStore = create<GameState & GameActions>((set, get) => ({
  ...initialState,

  pauseGame: () => {
    set({ isPaused: true });
    get()._clearTimer();
  },

  resumeGame: () => {
    set({ isPaused: false });
    const { phase, players, currentTurnSeat } = get();
    // Resume timer if it's a local human turn
    if (
      (phase === 'turn_draw' || phase === 'turn_decision' || phase === 'power_target') &&
      players[currentTurnSeat]?.kind === 'human' &&
      players[currentTurnSeat]?.isLocal
    ) {
      get()._startTimer(false); // false = do not reset timer count
    }
  },

  restartGame: () => {
    get()._clearTimer();
    get().resetGame();
    set({ isPaused: false, phase: 'menu' });
  },

  setVolume: (type, value) => {
    set({ [`${type}Volume`]: value });
  },

  addToast: (message, type = 'info', seatIndex) => {
    const id = generateToastId();
    const newToast: Toast = { id, message, type, seatIndex, timestamp: Date.now() };
    set((state) => ({ toasts: [...state.toasts, newToast] }));
    setTimeout(() => get().removeToast(id), 3000);
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  setPhase: (phase) => set({ phase }),

  _startTimer: (resetCount = true) => {
    get()._clearTimer();

    // Only reset timer if requested (default true)
    if (resetCount) {
      const { players, currentTurnSeat } = get();
      const currentPlayer = players[currentTurnSeat];
      const duration = (currentPlayer?.kind === 'human') ? PLAYER_TURN_TIMER_SECONDS : TURN_TIMER_SECONDS;
      set({ turnTimer: duration, turnTimerMax: duration });
    }

    _timerInterval = setInterval(() => {
      const { turnTimer, isPaused } = get();
      if (isPaused) return;

      if (turnTimer <= 0) {
        get()._onTimerExpired();
      } else {
        set({ turnTimer: turnTimer - 1 });
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
    const { phase, currentTurnSeat, players, deck, drawnCard, activePower } = get();
    const current = players[currentTurnSeat];

    // Safety check
    if (!current) return;

    // Only auto-act for local human players
    if (current.kind === 'human' && current.isLocal) {
      get().addToast('Time\'s up! Auto-playing...', 'warning', currentTurnSeat);

      if (phase === 'turn_draw') {
        if (deck.length > 0) {
          get().drawFromDeck();
          setTimeout(() => {
            const s2 = get();
            if (s2.phase === 'turn_decision' && s2.drawnCard) {
              get().discardDrawn();
            }
          }, 500);
        } else {
          get()._endGame();
        }
      } else if (phase === 'turn_decision' && drawnCard) {
        get().discardDrawn();
      } else if (phase === 'power_target') {
        set({ activePower: null, powerSourceSeat: null, swapSource: null });
        get()._endTurn();
      }
    } else if (current.kind === 'ai') {
      // Fallback for AI if it stuck. Usually AI execute functions handle this.
      get()._endTurn();
    }
  },

  triggerCardAnimation: (seatIndex: number, cardIndex: number, type: 'swap' | 'mass_swap') => {
    set((s) => ({ cardAnimations: [...s.cardAnimations, { seatIndex, cardIndex, type }] }));
    setTimeout(() => {
      set((s) => ({
        cardAnimations: s.cardAnimations.filter(
          (a) => !(a.seatIndex === seatIndex && a.cardIndex === cardIndex && a.type === type)
        )
      }));
    }, 3000);
  },

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
      swapSource: null,
      turnTimer: TURN_TIMER_SECONDS,
      turnTimerMax: TURN_TIMER_SECONDS,
      isDiscardBurned: false,
      isPaused: false,
    });

    if (players[0].kind === 'ai') {
      setTimeout(() => get().executeAITurn(0), 800);
    } else {
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

    if (get().isDiscardBurned) {
      get().addToast('Cannot pick up! Power was used.', 'warning', currentTurnSeat);
      return;
    }

    const drawnCard = { ...discardPile[discardPile.length - 1], isFaceUp: true };
    set({
      discardPile: discardPile.slice(0, -1),
      drawnCard,
      drawnFrom: 'discard',
      phase: 'turn_decision',
    });
  },

  swapWithHand: (handIndex: number, usePower: boolean = true) => {
    const { drawnCard, players, currentTurnSeat, discardPile, phase, aiMemories } = get();
    if (phase !== 'turn_decision' || !drawnCard) return;
    const current = players[currentTurnSeat];
    if (current.hand[handIndex].isLocked) {
      get().addToast('That card is locked!', 'warning', currentTurnSeat);
      return;
    }

    const newPlayers = players.map((p) => ({ ...p, hand: [...p.hand] }));
    const newHand = newPlayers[currentTurnSeat].hand;
    const removedCard = { ...newHand[handIndex], isFaceUp: true };
    newHand[handIndex] = { ...drawnCard, isFaceUp: false, powerUsed: false };

    const newDiscardPile = [...discardPile, removedCard];

    const newMemories = new Map(aiMemories);
    for (const [aiSeat, mem] of newMemories) {
      let updated = { ...mem, knownCards: new Map(mem.knownCards), discardedCards: [...mem.discardedCards, removedCard] };
      const seatKnown = new Map(updated.knownCards.get(currentTurnSeat) || new Map());
      seatKnown.delete(handIndex);
      updated.knownCards.set(currentTurnSeat, seatKnown);
      if (aiSeat === currentTurnSeat) {
        updated = updateMemory(updated, currentTurnSeat, handIndex, drawnCard);
      }
      newMemories.set(aiSeat, updated);
    }

    set({
      players: newPlayers,
      discardPile: newDiscardPile,
      drawnCard: null,
      drawnFrom: null,
      aiMemories: newMemories,
      isDiscardBurned: false,
    });

    get().triggerCardAnimation(currentTurnSeat, handIndex, 'swap');
    get()._endTurn();
  },

  discardDrawn: (usePower: boolean = true) => {
    const { drawnCard, discardPile, phase, aiMemories, players, currentTurnSeat } = get();
    if (phase !== 'turn_decision' || !drawnCard) return;

    const discarded = { ...drawnCard, isFaceUp: true };
    const newDiscardPile = [...discardPile, discarded];
    let power = usePower ? getCardPower(discarded) : null;

    if (power === 'unlock') {
      const hasLockedCards = players.some(p => p.hand.some(c => c.isLocked));
      if (!hasLockedCards) {
        power = null;
        get().addToast('No locked cards to unlock!', 'info', currentTurnSeat);
      }
    }

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
      discarded.powerUsed = true;
      get().addToast(`${discarded.isJoker ? 'Joker' : discarded.rank} power: ${powerName(power)}!`, 'power', get().currentTurnSeat);
      set({ activePower: power, powerSourceSeat: get().currentTurnSeat, phase: 'power_target', isDiscardBurned: true });
    } else {
      set({ isDiscardBurned: false });
      get()._endTurn();
    }
  },

  selectPowerTarget: (targetSeat: number, targetIndex: number) => {
    const state = get();
    const { activePower, players, currentTurnSeat, aiMemories, swapSource } = state;
    if (!activePower) return;
    if (activePower === 'mass_swap') return;

    const newPlayers = players.map((p) => ({ ...p, hand: [...p.hand] }));
    let newMemories = new Map(aiMemories);

    switch (activePower) {
      case 'unlock': {
        const hand = newPlayers[targetSeat].hand;
        if (hand[targetIndex].isLocked) {
          hand[targetIndex] = { ...hand[targetIndex], isLocked: false };
          get().addToast(`Unlocked ${newPlayers[targetSeat].name}'s card #${targetIndex + 1}!`, 'info', currentTurnSeat);
        }
        break;
      }
      case 'peek': {
        const hand = newPlayers[targetSeat].hand;
        if (hand[targetIndex].isLocked) {
          get().addToast('Cannot peek at a locked card!', 'warning', currentTurnSeat);
          return;
        }
        hand[targetIndex] = { ...hand[targetIndex], isPeeking: true };
        get().addToast(`Peeking at ${newPlayers[targetSeat].name}'s card #${targetIndex + 1}...`, 'info', currentTurnSeat);

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
      case 'lock': {
        newPlayers[targetSeat].hand[targetIndex].isLocked = true;
        get().addToast(`Locked ${newPlayers[targetSeat].name}'s card #${targetIndex + 1}!`, 'info', currentTurnSeat);
        break;
      }
      case 'swap': {
        const { swapSource } = get();
        if (swapSource === null) {
          if (newPlayers[targetSeat].hand[targetIndex].isLocked) {
            get().addToast('Cannot select a locked card!', 'warning', currentTurnSeat);
            return;
          }
          newPlayers[targetSeat].hand[targetIndex].isSelected = true;
          get().addToast('Select second card to swap.', 'info', currentTurnSeat);
          set({ players: newPlayers, swapSource: { seat: targetSeat, index: targetIndex } });
          return;
        }

        if (swapSource.seat === targetSeat && swapSource.index === targetIndex) {
          get().addToast('Select a different card!', 'warning', currentTurnSeat);
          return;
        }
        if (newPlayers[targetSeat].hand[targetIndex].isLocked) {
          get().addToast('Cannot swap with a locked card!', 'warning', currentTurnSeat);
          return;
        }

        const sourceSeat = swapSource.seat;
        const sourceIndex = swapSource.index;
        newPlayers[sourceSeat].hand[sourceIndex].isSelected = false;

        const temp = { ...newPlayers[sourceSeat].hand[sourceIndex] };
        newPlayers[sourceSeat].hand[sourceIndex] = { ...newPlayers[targetSeat].hand[targetIndex] };
        newPlayers[targetSeat].hand[targetIndex] = { ...temp };
        newPlayers[sourceSeat].hand[sourceIndex].isSelected = false;
        newPlayers[targetSeat].hand[targetIndex].isSelected = false;

        for (const [aiSeat, mem] of newMemories) {
          const updated = { ...mem, knownCards: new Map(mem.knownCards) };
          const sK = new Map(updated.knownCards.get(sourceSeat) || new Map()); sK.delete(sourceIndex); updated.knownCards.set(sourceSeat, sK);
          const tK = new Map(updated.knownCards.get(targetSeat) || new Map()); tK.delete(targetIndex); updated.knownCards.set(targetSeat, tK);
          newMemories.set(aiSeat, updated);
        }

        get().triggerCardAnimation(sourceSeat, sourceIndex, 'swap');
        get().triggerCardAnimation(targetSeat, targetIndex, 'swap');

        get().addToast('Swapped cards!', 'info', currentTurnSeat);
        break;
      }
    }

    set({
      players: newPlayers,
      activePower: null,
      powerSourceSeat: null,
      aiMemories: newMemories,
      swapSource: null,
    });
    get()._endTurn();
  },

  rotateHands: (direction: 'left' | 'right') => {
    const { activePower, players, aiMemories } = get();
    if (activePower !== 'mass_swap') return;

    const newPlayers = players.map((p) => ({ ...p, hand: [...p.hand] }));
    const count = newPlayers.length;

    if (direction === 'left') {
      const lastHand = newPlayers[count - 1].hand;
      for (let i = count - 1; i > 0; i--) {
        newPlayers[i].hand = newPlayers[i - 1].hand;
      }
      newPlayers[0].hand = lastHand;
    } else {
      const firstHand = newPlayers[0].hand;
      for (let i = 0; i < count - 1; i++) {
        newPlayers[i].hand = newPlayers[i + 1].hand;
      }
      newPlayers[count - 1].hand = firstHand;
    }

    const newMemories = new Map();
    players.forEach((p) => {
      if (p.kind === 'ai') {
        newMemories.set(p.seatIndex, { knownCards: new Map(), discardedCards: [...(aiMemories.get(p.seatIndex)?.discardedCards || [])] });
      }
    });

    get().addToast(`Global Swap! Hands rotated to the ${direction.toUpperCase()}!`, 'power');

    set({
      players: newPlayers,
      activePower: null,
      powerSourceSeat: null,
      aiMemories: newMemories,
      swapSource: null,
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
    const turnCount = get().turnCount + (nextSeat === 0 ? 1 : 0);

    set({
      currentTurnSeat: nextSeat,
      turnCount,
      swapSource: null,
    });

    if (nextPlayer.kind === 'ai') {
      set({ phase: 'turn_draw' });
      const delay = Math.floor(Math.random() * 5000) + 5000;
      setTimeout(() => get().executeAITurn(nextSeat), delay);
    } else if (nextPlayer.isLocal) {
      set({ phase: 'turn_draw' });
      get()._startTimer();
    }
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

    const opponents: Opponent[] = newPlayers
      .filter((p) => p.seatIndex !== seat)
      .map((p) => ({ seatIndex: p.seatIndex, hand: p.hand }));

    const discardTop = newDiscardPile.length > 0 ? newDiscardPile[newDiscardPile.length - 1] : null;
    const drawChoice = aiChooseDraw(difficulty, discardTop);

    let drawnCard: Card;
    if (drawChoice === 'discard' && discardTop) {
      drawnCard = { ...newDiscardPile.pop()!, isFaceUp: true };
      get().addToast(`${aiPlayer.name} drew from discard`, 'info', seat);
    } else {
      drawnCard = { ...newDeck[0], isFaceUp: true };
      newDeck = newDeck.slice(1);
      get().addToast(`${aiPlayer.name} drew from deck`, 'info', seat);
    }

    const decision = aiDecide(difficulty, drawnCard, newPlayers[seat].hand, newMemory, seat);

    if (decision.action === 'swap' && decision.swapIndex !== undefined) {
      const idx = decision.swapIndex;
      if (!newPlayers[seat].hand[idx].isLocked) {
        const removed = { ...newPlayers[seat].hand[idx], isFaceUp: true };
        newPlayers[seat].hand[idx] = { ...drawnCard, isFaceUp: false };
        newDiscardPile.push(removed);
        newMemory.discardedCards.push(removed);

        get().triggerCardAnimation(seat, idx, 'swap');

        const power = getCardPower(removed);
        if (power) {
          removed.powerUsed = true;
          get().addToast(`${aiPlayer.name} used ${removed.isJoker ? 'Joker' : removed.rank}: ${powerName(power)}!`, 'power', seat);
          set({ isDiscardBurned: true });
          const powerDecision = aiPowerTarget(difficulty, power, seat, newPlayers[seat].hand, opponents, newMemory);
          if (powerDecision) {
            applyAIPower(powerDecision, seat, newPlayers, newMemory, get().addToast, get().rotateHands, get().triggerCardAnimation);
          }
        } else {
          set({ isDiscardBurned: false });
        }
      } else {
        newDiscardPile.push({ ...drawnCard, isFaceUp: true });
        newMemory.discardedCards.push(drawnCard);
        // "Discarded drawn card" path - reusing var drawnCard for power check logic below if needed
        const power = getCardPower(drawnCard);
        if (power) {
          drawnCard.powerUsed = true;
          get().addToast(`${aiPlayer.name} used ${drawnCard.isJoker ? 'Joker' : drawnCard.rank}: ${powerName(power)}!`, 'power', seat);
          set({ isDiscardBurned: true });
          const powerDecision = aiPowerTarget(difficulty, power, seat, newPlayers[seat].hand, opponents, newMemory);
          if (powerDecision) {
            // Need opponents list again or similar
            applyAIPower(powerDecision, seat, newPlayers, newMemory, get().addToast, get().rotateHands, get().triggerCardAnimation);
          }
        }
      }
    } else {
      // Discard Only
      const discarded = { ...drawnCard, isFaceUp: true };
      newDiscardPile.push(discarded);
      newMemory.discardedCards.push(discarded);
      set({ isDiscardBurned: false });

      const power = getCardPower(discarded);
      if (power) {
        discarded.powerUsed = true;
        get().addToast(`${aiPlayer.name} used ${discarded.isJoker ? 'Joker' : discarded.rank}: ${powerName(power)}!`, 'power', seat);
        set({ isDiscardBurned: true });
        const powerDecision = aiPowerTarget(difficulty, power, seat, newPlayers[seat].hand, opponents, newMemory);
        if (powerDecision) {
          applyAIPower(powerDecision, seat, newPlayers, newMemory, get().addToast, get().rotateHands, get().triggerCardAnimation);
        }
      }
    }

    const newMemories = new Map(aiMemories);
    newMemories.set(seat, newMemory);

    set({
      players: newPlayers,
      deck: newDeck,
      discardPile: newDiscardPile,
      aiMemories: newMemories,
    });

    if (newDeck.length === 0) {
      setTimeout(() => get()._endGame(), 800);
    } else {
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
  }
}));
