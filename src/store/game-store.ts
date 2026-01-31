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
  _endTurn: () => void;
  _endGame: () => void;
  _startTimer: () => void;
  _clearTimer: () => void;
  _onTimerExpired: () => void;
  addToast: (message: string, type?: Toast['type'], seatIndex?: number) => void;
  removeToast: (id: string) => void;
  setPhase: (phase: GamePhase) => void;
  setVolume: (type: 'master' | 'music' | 'sfx', value: number) => void;
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
      swapSource: null,
      turnTimer: TURN_TIMER_SECONDS,
      turnTimerMax: TURN_TIMER_SECONDS,
      isDiscardBurned: false,
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

    // Rule: Cannot pick up if burned (power used)
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
    // Reset powerUsed when card enters hand, so it can be used again if discarded later
    newHand[handIndex] = { ...drawnCard, isFaceUp: false, powerUsed: false };

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

    // Power Logic Change: Swapped cards (from hand) NEVER trigger powers.
    // Powers only trigger on "Draw & Immediate Discard".
    const power = null;

    set({
      players: newPlayers,
      discardPile: newDiscardPile,
      drawnCard: null,
      drawnFrom: null,
      aiMemories: newMemories,
    });

    // Normal discard, safe to pick up next turn
    set({ isDiscardBurned: false });
    get()._endTurn();
  },

  discardDrawn: (usePower: boolean = true) => {
    const { drawnCard, discardPile, phase, aiMemories, players, currentTurnSeat } = get();
    if (phase !== 'turn_decision' || !drawnCard) return;

    const discarded = { ...drawnCard, isFaceUp: true };
    const newDiscardPile = [...discardPile, discarded];
    let power = usePower ? getCardPower(discarded) : null;

    // Special check: If power is 'unlock', verify there are actually locked cards
    if (power === 'unlock') {
      const hasLockedCards = players.some(p => p.hand.some(c => c.isLocked));
      if (!hasLockedCards) {
        power = null;
        get().addToast('No locked cards to unlock!', 'info', currentTurnSeat);
      }
    }

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
      discarded.powerUsed = true; // Mark as permanently used
      get().addToast(`${discarded.isJoker ? 'Joker' : discarded.rank} power: ${powerName(power)}!`, 'power', get().currentTurnSeat);
      set({ activePower: power, powerSourceSeat: get().currentTurnSeat, phase: 'power_target', isDiscardBurned: true });
    } else {
      // Normal discard
      set({ isDiscardBurned: false });
      get()._endTurn();
    }
  },

  selectPowerTarget: (targetSeat: number, targetIndex: number) => {
    const state = get();
    const { activePower, players, currentTurnSeat, aiMemories, swapSource } = state;
    if (!activePower) return;

    // For mass_swap, use rotateHands instead
    if (activePower === 'mass_swap') return;

    const newPlayers = players.map((p) => ({ ...p, hand: [...p.hand] }));
    const currentPlayer = newPlayers[currentTurnSeat];
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
      case 'swap': {
        // Global Swap: Can swap ANY two cards on the board
        const { swapSource } = get();

        if (swapSource === null) {
          // First selection
          if (newPlayers[targetSeat].hand[targetIndex].isLocked) {
            get().addToast('Cannot select a locked card!', 'warning', currentTurnSeat);
            return; // Don't end turn, user must pick valid card
          }

          // Mark first card as selected
          newPlayers[targetSeat].hand[targetIndex] = {
            ...newPlayers[targetSeat].hand[targetIndex],
            isSelected: true
          };

          get().addToast('Select second card to swap.', 'info', currentTurnSeat);
          set({ players: newPlayers, swapSource: { seat: targetSeat, index: targetIndex } });
          return; // Wait for second click
        }

        // Second selection
        // Check if same card clicked
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

        // Deselect first card
        newPlayers[sourceSeat].hand[sourceIndex] = { ...newPlayers[sourceSeat].hand[sourceIndex], isSelected: false };

        // Perform swap
        const temp = { ...newPlayers[sourceSeat].hand[sourceIndex] };
        newPlayers[sourceSeat].hand[sourceIndex] = { ...newPlayers[targetSeat].hand[targetIndex] };
        newPlayers[targetSeat].hand[targetIndex] = { ...temp };

        // Clear selection visual just in case
        newPlayers[sourceSeat].hand[sourceIndex].isSelected = false;
        newPlayers[targetSeat].hand[targetIndex].isSelected = false;

        // Update AI memories for both locations
        for (const [aiSeat, mem] of newMemories) {
          const updated = { ...mem, knownCards: new Map(mem.knownCards) };

          const seatKnownSource = new Map(updated.knownCards.get(sourceSeat) || new Map());
          seatKnownSource.delete(sourceIndex);
          updated.knownCards.set(sourceSeat, seatKnownSource);

          const seatKnownTarget = new Map(updated.knownCards.get(targetSeat) || new Map());
          seatKnownTarget.delete(targetIndex);
          updated.knownCards.set(targetSeat, seatKnownTarget);

          newMemories.set(aiSeat, updated);
        }

        get().addToast('Swapped cards!', 'info', currentTurnSeat);
        break;
      }
      case 'lock': {
        newPlayers[targetSeat].hand[targetIndex] = {
          ...newPlayers[targetSeat].hand[targetIndex],
          isLocked: true,
        };
        get().addToast(`Locked ${newPlayers[targetSeat].name}'s card #${targetIndex + 1}!`, 'info', currentTurnSeat);
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
    const count = newPlayers.length; // 4

    // Rotate hands logic:
    // Left: P0 gets P1's hand, P1 gets P2's hand, etc.
    // Wait, visually:
    // P0 (South) -> P1 (West) -> P2 (North) -> P3 (East) -> P0 (South)
    // Left Rotation = Hands shift to the Left Player.
    // P0's hand goes to P1. P1's hand goes to P2.
    // New P0 Hand = Old P3 Hand.
    // New P[i] Hand = Old P[i-1] Hand.

    if (direction === 'left') {
      const lastHand = newPlayers[count - 1].hand;
      for (let i = count - 1; i > 0; i--) {
        newPlayers[i].hand = newPlayers[i - 1].hand;
      }
      newPlayers[0].hand = lastHand;
    } else {
      // Right Rotation
      // Hand moves to Right Player: P0 -> P3.
      // P3's Hand comes from P0.
      // New P[i] Hand = Old P[i+1] Hand.
      const firstHand = newPlayers[0].hand;
      for (let i = 0; i < count - 1; i++) {
        newPlayers[i].hand = newPlayers[i + 1].hand;
      }
      newPlayers[count - 1].hand = firstHand;
    }

    // Wipe memories because total chaos
    let newMemories = new Map();
    players.forEach((p) => {
      if (p.kind === 'ai') {
        newMemories.set(p.seatIndex, { knownCards: new Map(), discardedCards: [...(aiMemories.get(p.seatIndex)?.discardedCards || [])] });
      }
    });

    get().addToast(`Global Swap! Hands rotated to the ${direction.toUpperCase()}!`, 'power', activePower === 'mass_swap' ? undefined : undefined); // Mass swap affects everyone, maybe center?

    set({
      players: newPlayers,
      activePower: null,
      powerSourceSeat: null,
      aiMemories: newMemories,
      swapSource: null,
    });

    // Note: If rotated, the 'discard pile' didn't technically receive a new top card via normal discard action here,
    // but the 'power action' triggered it. The flag should already be set to true by the trigger.
    // However, mass swap is chaotic. Let's keep isDiscardBurned = true because a power WAS used.

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
      swapSource: null,
    });

    if (nextPlayer.kind === 'ai') {
      set({ phase: 'turn_draw' }); // Show AI is drawing/thinking
      // Random delay 5-10 seconds
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
      get().addToast(`${aiPlayer.name} drew from discard`, 'info', seat);
    } else {
      drawnCard = { ...newDeck[0], isFaceUp: true };
      newDeck = newDeck.slice(1);
      get().addToast(`${aiPlayer.name} drew from deck`, 'info', seat);
    }

    // 2. Decide
    const decision = aiDecide(difficulty, drawnCard, newPlayers[seat].hand, newMemory, seat);

    if (decision.action === 'swap' && decision.swapIndex !== undefined) {
      const idx = decision.swapIndex;
      if (!newPlayers[seat].hand[idx].isLocked) {
        const removed = { ...newPlayers[seat].hand[idx], isFaceUp: true };
        newPlayers[seat].hand[idx] = { ...drawnCard, isFaceUp: false };
        newDiscardPile.push(removed);

        newMemory.discardedCards.push(removed);

        // AI Logic for swap
        const power = getCardPower(removed);
        if (power) {
          removed.powerUsed = true; // Mark as permanently used
          get().addToast(`${aiPlayer.name} used ${removed.isJoker ? 'Joker' : removed.rank}: ${powerName(power)}!`, 'power', seat);
          set({ isDiscardBurned: true }); // AI used power
          const powerDecision = aiPowerTarget(difficulty, power, seat, newPlayers[seat].hand, opponents, newMemory);
          if (powerDecision) {
            applyAIPower(powerDecision, seat, newPlayers, newMemory, get().addToast, get().rotateHands);
          }
        } else {
          set({ isDiscardBurned: false }); // Normal swap discard
        }
      } else {
        newDiscardPile.push({ ...drawnCard, isFaceUp: true });
        newMemory.discardedCards.push(drawnCard);
        // "Discarded drawn card" path
        const power = getCardPower(drawnCard);
        // ... (logic continues in else block)
      }
    } else {
      const discarded = { ...drawnCard, isFaceUp: true };
      newDiscardPile.push(discarded);
      newMemory.discardedCards.push(discarded);

      set({ isDiscardBurned: false }); // Default false, set true if power used below

      const power = getCardPower(discarded);
      if (power) {
        discarded.powerUsed = true; // Mark as permanently used
        get().addToast(`${aiPlayer.name} used ${discarded.isJoker ? 'Joker' : discarded.rank}: ${powerName(power)}!`, 'power', seat);
        set({ isDiscardBurned: true }); // AI used power
        const opponents2: Opponent[] = newPlayers
          .filter((p) => p.seatIndex !== seat)
          .map((p) => ({ seatIndex: p.seatIndex, hand: p.hand }));
        const powerDecision = aiPowerTarget(difficulty, power, seat, newPlayers[seat].hand, opponents2, newMemory);
        if (powerDecision) {
          applyAIPower(powerDecision, seat, newPlayers, newMemory, get().addToast, get().rotateHands);
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

    // Determine timer duration based on current player type
    const { players, currentTurnSeat } = get();
    const currentPlayer = players[currentTurnSeat];
    const duration = (currentPlayer.kind === 'human') ? PLAYER_TURN_TIMER_SECONDS : TURN_TIMER_SECONDS;

    set({ turnTimer: duration, turnTimerMax: duration });

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

    get().addToast('Time\'s up! Auto-playing...', 'warning', currentTurnSeat);

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
      set({ activePower: null, powerSourceSeat: null, swapSource: null });
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

  addToast: (message: string, type: Toast['type'] = 'info', seatIndex?: number) => {
    const id = generateToastId();
    // Reduce max toasts stack to 2 to prevent clutter
    set((s) => ({ toasts: [...s.toasts.slice(-1), { id, message, type, seatIndex }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3000);
  },

  removeToast: (id: string) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  setPhase: (phase: GamePhase) => set({ phase }),

  setVolume: (type, value) => set((state) => {
    switch (type) {
      case 'master': return { masterVolume: value };
      case 'music': return { musicVolume: value };
      case 'sfx': return { sfxVolume: value };
    }
  }),
}));

// Apply AI power card effect (mutates newPlayers and memory in place)
function applyAIPower(
  decision: AIPowerDecision,
  aiSeat: number,
  newPlayers: PlayerInfo[],
  memory: AIMemory,
  addToast: (msg: string, type?: Toast['type'], seatIndex?: number) => void,
  rotateHands?: (direction: 'left' | 'right') => void
) {
  const aiPlayer = newPlayers[aiSeat];

  switch (decision.power) {
    case 'unlock': {
      const hand = newPlayers[decision.targetSeat].hand;
      if (hand[decision.targetIndex].isLocked) {
        hand[decision.targetIndex] = { ...hand[decision.targetIndex], isLocked: false };
        addToast(`${aiPlayer.name} unlocked ${newPlayers[decision.targetSeat].name}'s card`, 'info', aiSeat);
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
        addToast(`${aiPlayer.name} peeked at ${newPlayers[decision.targetSeat].name}'s card`, 'info', aiSeat);
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

        addToast(`${aiPlayer.name} swapped Card #${ownIdx + 1} with ${newPlayers[decision.targetSeat].name}'s Card #${decision.targetIndex + 1}!`, 'warning', aiSeat);
      }
      break;
    }
    case 'lock': {
      const hand = newPlayers[decision.targetSeat].hand;
      hand[decision.targetIndex] = { ...hand[decision.targetIndex], isLocked: true };
      addToast(`${aiPlayer.name} locked ${newPlayers[decision.targetSeat].name}'s card`, 'info', aiSeat);
      break;
    }
    case 'mass_swap': {
      if (rotateHands) {
        // AI chooses random direction or simple heuristic?
        // Since logic supports Left/Right, let's just pick one.
        const dir = Math.random() > 0.5 ? 'left' : 'right';
        rotateHands(dir);
      }
      break;
    }
  }
}
