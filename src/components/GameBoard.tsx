'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import Link from 'next/link';
import MainMenu from './MainMenu';
import CardComponent from './Card';
import PlayerHand from './PlayerHand';
import Lobby from './Lobby';
import TutorialView from './TutorialView';
import { getCardImagePath, Difficulty, SeatPosition, GameConfig, getCardPower, Card as CardType, powerName } from '@/types/game';
import {
  Layers,
  Trash2,
  RotateCcw,
  RotateCw,
  Crown,
  Swords,
  Eye,
  Lock,
  Unlock,
  Shuffle,
  Clock,
  Smile,
} from 'lucide-react';

const EMOTES = ['😀', '🤔', '😱', '😡', '😎', '😭'];

const powerIcons = {
  unlock: Unlock,
  swap: Swords,
  peek: Eye,
  lock: Lock,
  mass_swap: Shuffle,
};

const powerInstructions = {
  unlock: 'Select a LOCKED card to unlock it.',
  swap: 'Select one of YOUR cards, then an opponent\'s card to swap.',
  peek: 'Select any card to peek at it for 3 seconds.',
  lock: 'Select any card to lock it.',
  mass_swap: 'Select an opponent to swap all unlocked cards with.',
};

const SEAT_TO_POSITION: SeatPosition[] = ['south', 'west', 'north', 'east'];

export default function GameBoard() {
  const {
    phase,
    players,
    deck,
    discardPile,
    drawnCard,
    activePower,
    currentTurnSeat,
    localPlayerSeat,
    winnerSeat,
    turnCount,
    turnTimer,
    turnTimerMax,
    isOnline,
    drawFromDeck,
    drawFromDiscard,
    swapWithHand,
    discardDrawn,
    selectPowerTarget,
    rotateHands,
    startGame,
    resetGame,
    setPhase, // destructure setPhase
  } = useGameStore();

  const mp = useMultiplayer();
  const [powerDecision, setPowerDecision] = useState<{ type: 'discard' | 'swap', card?: CardType, handIndex?: number } | null>(null);
  const [showEmotes, setShowEmotes] = useState(false);
  const [dismissedPowerCardId, setDismissedPowerCardId] = useState<string | null>(null);

  const handleEmote = (emote: string) => {
    useGameStore.getState().addToast(`You: ${emote}`, 'info');
    setShowEmotes(false);
    // In a full implementation, we would send this to the server:
    // if (isOnline) mp.sendAction({ type: 'emote', emote });
  };

  // Sound effect
  const playFlipSound = () => {
    const audio = new Audio('/flipcard.mp3');
    audio.play().catch(() => { }); // catch error if user hasn't interacted yet
  };

  const discardTop = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;
  const localPlayer = players[localPlayerSeat];
  const isLocalTurn = localPlayer?.isLocal && currentTurnSeat === localPlayerSeat;

  const canDraw = phase === 'turn_draw' && isLocalTurn;
  const canDecide = phase === 'turn_decision' && isLocalTurn;
  const canTargetPower = phase === 'power_target' && currentTurnSeat === localPlayerSeat;



  // Dispatch actions: online sends via WS, offline uses local store
  const handleDrawFromDeck = () => {
    playFlipSound();
    if (isOnline) {
      mp.sendAction({ type: 'draw_from_deck' });
    } else {
      drawFromDeck();
    }
  };

  const handleDrawFromDiscard = () => {
    playFlipSound();
    if (isOnline) {
      mp.sendAction({ type: 'draw_from_discard' });
    } else {
      drawFromDiscard();
    }
  };

  const handleSwapWithHand = (handIndex: number, usePower: boolean = true) => {
    // Intercept for power decision only if local
    if (!isOnline && usePower) { // check if we need to verify power
      const cardToDiscard = localPlayer.hand[handIndex];
      const power = getCardPower(cardToDiscard);
      if (power) {
        setPowerDecision({ type: 'swap', card: cardToDiscard, handIndex });
        return;
      }
    }

    playFlipSound();
    if (isOnline) {
      mp.sendAction({ type: 'swap_with_hand', handIndex });
    } else {
      swapWithHand(handIndex, usePower);
    }
  };

  const handleDiscardDrawn = (usePower: boolean = true) => {
    // Intercept for power decision
    if (!isOnline && usePower) {
      if (drawnCard) {
        const power = getCardPower(drawnCard);
        if (power) {
          setPowerDecision({ type: 'discard', card: drawnCard });
          return;
        }
      }
    }

    playFlipSound();
    if (isOnline) {
      mp.sendAction({ type: 'discard_drawn' });
    } else {
      discardDrawn(usePower);
    }
  };

  const confirmPowerUsage = (usePower: boolean) => {
    if (!powerDecision) return;

    if (powerDecision.type === 'swap' && powerDecision.handIndex !== undefined) {
      // handleSwapWithHand(powerDecision.handIndex, usePower);
      // Bypass interceptor
      playFlipSound();
      if (isOnline) {
        mp.sendAction({ type: 'swap_with_hand', handIndex: powerDecision.handIndex });
      } else {
        swapWithHand(powerDecision.handIndex, usePower);
      }
    } else if (powerDecision.type === 'discard') {
      // handleDiscardDrawn(usePower);
      // Bypass interceptor
      playFlipSound();
      if (isOnline) {
        mp.sendAction({ type: 'discard_drawn' });
      } else {
        discardDrawn(usePower);
      }
    }
    setPowerDecision(null);
  };

  const cancelPowerUsage = () => {
    // User chose to "Swap" or "Cancel" from auto-prompt
    if (powerDecision?.card) {
      setDismissedPowerCardId(powerDecision.card.id);
    }
    setPowerDecision(null);
  };

  const handleSelectPowerTarget = (targetSeat: number, targetIndex: number) => {
    if (isOnline) {
      mp.sendAction({ type: 'select_power_target', targetSeat, targetIndex });
    } else {
      selectPowerTarget(targetSeat, targetIndex);
    }
  };

  const handleRotateHands = (direction: 'left' | 'right') => {
    if (isOnline) {
      // Offline/Local only for now
    } else {
      rotateHands(direction);
    }
  };

  // Handle card clicks for any seat
  const handleCardClick = (seatIndex: number, cardIndex: number) => {
    if (canDecide && seatIndex === localPlayerSeat && drawnCard) {
      handleSwapWithHand(cardIndex);
    } else if (canTargetPower && activePower) {
      if (activePower === 'mass_swap') {
        // do nothing, wait for UI buttons
      } else {
        handleSelectPowerTarget(seatIndex, cardIndex);
      }
    }
  };

  // EFFECT: Auto-trigger prompt if drawn card has power
  useEffect(() => {
    if (canDecide && drawnCard && !isOnline) {
      // Only if not already dismissed
      if (drawnCard.id === dismissedPowerCardId) return;

      const power = getCardPower(drawnCard);
      if (power) {
        // We only auto-trigger for 'discard' scenario initially (using the drawn card)
        // The user might want to Swap (keep card), acts as "Cancel"
        if (!powerDecision) {
          setPowerDecision({ type: 'discard', card: drawnCard });
        }
      }
    }
  }, [drawnCard, canDecide, isOnline, dismissedPowerCardId, powerDecision]);


  const handleStartLocalGame = ({ difficulty, humanCount, aiNames }: { difficulty: Difficulty; humanCount: number; aiNames: string[] }) => {
    const names = ['You', 'Player 2', 'Player 3', 'Player 4'];
    let aiIdx = 0;

    const config: GameConfig = {
      difficulty,
      isOnline: false,
      seats: Array.from({ length: 4 }, (_, i) => {
        const isHuman = i < humanCount;
        return {
          kind: isHuman ? 'human' as const : 'ai' as const,
          name: isHuman ? names[i] : aiNames[aiIdx++] || `AI ${i}`,
          isLocal: i === 0,
        };
      }),
    };
    startGame(config);
  };

  const handleCreateOnlineRoom = (name: string, difficulty: Difficulty) => {
    mp.createRoom(name, difficulty);
  };

  const handleJoinOnlineRoom = (roomId: string, name: string) => {
    mp.joinRoom(roomId, name);
  };

  const handleBackToMenu = () => {
    mp.disconnect();
    resetGame();
  };

  const handleStartTutorial = () => {
    setPhase('tutorial');
  };

  // Get the relative position for a seat (relative to local player's seat)
  const getRelativePosition = (seatIndex: number): SeatPosition => {
    const offset = (seatIndex - localPlayerSeat + 4) % 4;
    return SEAT_TO_POSITION[offset];
  };

  // ===== LOBBY SCREEN (online) =====
  if (phase === 'lobby') {
    return (
      <Lobby
        roomId={mp.roomId}
        seats={mp.seats}
        isHost={mp.localSeat === 0}
        isConnected={mp.isConnected}
        onStartGame={() => mp.startGame()}
        onBack={handleBackToMenu}
      />
    );
  }

  // ===== MENU SCREEN =====
  if (phase === 'menu') {
    return (
      <MainMenu
        onStartLocalGame={handleStartLocalGame}
        onCreateOnlineRoom={handleCreateOnlineRoom}
        onJoinOnlineRoom={handleJoinOnlineRoom}
        onStartTutorial={handleStartTutorial}
        isConnecting={mp.isConnecting}
        error={mp.error}
      />
    );
  }

  // ===== TUTORIAL SCREEN =====
  if (phase === 'tutorial') {
    return <TutorialView />;
  }

  // ===== GAME OVER SCREEN =====
  if (phase === 'game_over') {
    const sortedPlayers = [...players].sort((a, b) => a.score - b.score);
    const localWon = winnerSeat === localPlayerSeat;

    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-4 bg-[url('/background.png')] bg-cover bg-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="text-center relative z-10 p-8 rounded-2xl bg-black/60 backdrop-blur-md border border-zinc-700"
        >
          <Crown className={`w-16 h-16 mx-auto mb-4 ${localWon ? 'text-amber-400' : 'text-zinc-500'}`} />
          <h2 className="text-3xl font-bold mb-2">
            {localWon ? 'You Win!' : `${players[winnerSeat!]?.name} Wins!`}
          </h2>
          <p className="text-zinc-400">After {turnCount} rounds</p>
        </motion.div>

        {/* Rankings */}
        <div className="flex flex-col gap-2 w-full max-w-sm relative z-10">
          {sortedPlayers.map((p, rank) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: rank * 0.15 }}
              className={`flex items-center justify-between px-4 py-3 rounded-xl border ${p.seatIndex === winnerSeat
                ? 'bg-amber-600/10 border-amber-500/40'
                : 'bg-zinc-800/80 border-zinc-700/50'
                }`}
            >
              <div className="flex items-center gap-3">
                <span className={`text-lg font-bold ${rank === 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
                  #{rank + 1}
                </span>
                <span className={`font-medium ${p.seatIndex === localPlayerSeat ? 'text-emerald-400' : 'text-zinc-300'}`}>
                  {p.name}
                </span>
              </div>
              <span className={`text-xl font-bold ${rank === 0 ? 'text-emerald-400' : 'text-zinc-400'}`}>
                {p.score}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Reveal hands */}
        <div className="flex flex-wrap gap-4 justify-center relative z-10">
          {sortedPlayers.map((p, rank) => (
            <div key={p.id} className="flex flex-col items-center p-2 rounded-lg bg-black/40 backdrop-blur-sm">
              <p className="text-[10px] text-zinc-400 mb-1">{p.name}</p>
              <div className="flex gap-1">
                {p.hand.map((card, i) => (
                  <CardComponent key={card.id} card={card} showFace={true} size="sm" delay={rank * 0.2 + i * 0.05} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          onClick={() => { handleBackToMenu(); }}
          className="relative z-10 flex items-center gap-2 py-3 px-6 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Play Again
        </motion.button>
      </div>
    );
  }

  // ===== MAIN GAME BOARD (Compass Layout) =====
  if (players.length < 4) return null;

  // Organize players by their relative positions
  const southPlayer = players.find((_, i) => getRelativePosition(i) === 'south')!;
  const northPlayer = players.find((_, i) => getRelativePosition(i) === 'north')!;
  const westPlayer = players.find((_, i) => getRelativePosition(i) === 'west')!;
  const eastPlayer = players.find((_, i) => getRelativePosition(i) === 'east')!;

  const currentPlayerName = players[currentTurnSeat]?.name || '';
  const isAnyLocalTurn = isLocalTurn;

  return (
    <div className="flex flex-col h-screen p-1 sm:p-2 overflow-hidden bg-[url('/background.png')] bg-cover bg-center">
      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 mb-1 rounded-lg bg-zinc-900/80 backdrop-blur-md border border-zinc-700/50 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">Round {turnCount + 1}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${isAnyLocalTurn
            ? 'bg-emerald-600/20 text-emerald-400'
            : 'bg-violet-600/20 text-violet-400'
            }`}>
            {isAnyLocalTurn ? 'Your Turn' : `${currentPlayerName}'s turn...`}
          </span>
          {isOnline && (
            <span className="text-[10px] text-violet-400 bg-violet-600/10 px-1.5 py-0.5 rounded">
              Online
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Turn timer */}
          {isAnyLocalTurn && (phase === 'turn_draw' || phase === 'turn_decision' || phase === 'power_target') && (
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-bold ${turnTimer <= 5
              ? 'bg-red-600/20 text-red-400'
              : turnTimer <= 10
                ? 'bg-amber-600/20 text-amber-400'
                : 'bg-zinc-800/50 text-zinc-300'
              }`}>
              <Clock className="w-3 h-3" />
              <span>{turnTimer}s</span>
              {/* Timer bar */}
              <div className="w-12 h-1.5 bg-zinc-700 rounded-full overflow-hidden ml-1">
                <motion.div
                  className={`h-full rounded-full ${turnTimer <= 5
                    ? 'bg-red-500'
                    : turnTimer <= 10
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                    }`}
                  initial={false}
                  animate={{ width: `${(turnTimer / turnTimerMax) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Layers className="w-3 h-3 text-zinc-500" />
            <span className="text-xs text-zinc-500">{deck.length} left</span>
          </div>
        </div>
      </div>

      {/* Power instruction banner */}
      <AnimatePresence>
        {activePower && canTargetPower && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center justify-center gap-2 px-3 py-1.5 mb-1 rounded-lg bg-violet-900/60 backdrop-blur-sm border border-violet-500/50 text-violet-200 text-xs sm:text-sm shrink-0"
          >
            {(() => {
              const Icon = powerIcons[activePower];
              return <Icon className="w-4 h-4" />;
            })()}
            <span>{powerInstructions[activePower]}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compass Grid */}
      <div className="flex-1 grid grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr_auto] gap-1 min-h-0">
        {/* North (top center) */}
        <div className="col-start-2 row-start-1 flex justify-center items-start pt-1">
          <PlayerHand
            player={northPlayer}
            position="north"
            isCurrentTurn={currentTurnSeat === northPlayer.seatIndex}
            onCardClick={(idx) => handleCardClick(northPlayer.seatIndex, idx)}
            isInteractive={canTargetPower}
            showFaces={false}
            isWinner={winnerSeat === northPlayer.seatIndex}
          />
        </div>

        {/* West (left middle) */}
        <div className="col-start-1 row-start-2 flex items-center justify-center px-1">
          <PlayerHand
            player={westPlayer}
            position="west"
            isCurrentTurn={currentTurnSeat === westPlayer.seatIndex}
            onCardClick={(idx) => handleCardClick(westPlayer.seatIndex, idx)}
            isInteractive={canTargetPower}
            showFaces={false}
            isWinner={winnerSeat === westPlayer.seatIndex}
          />
        </div>

        {/* Center: Deck + Discard + Drawn card */}
        <div className="col-start-2 row-start-2 flex items-center justify-center">
          <div className="flex items-center gap-3 sm:gap-6">
            {/* Draw Pile */}
            <motion.div
              className="relative"
              onClick={canDraw ? handleDrawFromDeck : undefined}
              whileHover={canDraw ? { scale: 1.05 } : undefined}
              whileTap={canDraw ? { scale: 0.95 } : undefined}
              style={{ cursor: canDraw ? 'pointer' : 'default' }}
            >
              <div className={`w-16 h-24 sm:w-20 sm:h-30 rounded-xl overflow-hidden shadow-lg border-2 ${canDraw ? 'border-emerald-500 shadow-emerald-500/20' : 'border-zinc-700/80 bg-zinc-800/80'
                }`}>
                {deck.length > 0 ? (
                  <div className="w-full h-full flex items-center justify-center"
                    style={{ background: 'repeating-conic-gradient(#1a1a2e 0% 25%, #16213e 0% 50%) 50% / 16px 16px' }}
                  >
                    <div className="absolute inset-2 rounded-lg border-2 border-red-500/40" />
                    <div className="flex flex-col items-center">
                      <span className="text-red-500 font-serif font-bold text-lg leading-none">7</span>
                      <span className="text-blue-900 font-serif font-bold text-xs leading-none">7</span>
                      <span className="text-red-500 font-serif font-bold text-lg leading-none">7</span>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                    <span className="text-zinc-600 text-[10px]">Empty</span>
                  </div>
                )}
              </div>
              <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] text-zinc-400 whitespace-nowrap bg-black/40 px-1 rounded">
                Deck ({deck.length})
              </span>
            </motion.div>

            {/* Drawn card */}
            <AnimatePresence>
              {drawnCard && canDecide && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5, rotateY: -180 }}
                  animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.5, type: 'spring' }}
                  className="flex flex-col items-center gap-1"
                >
                  <CardComponent card={drawnCard} showFace={true} size="md" />
                  <button
                    onClick={() => handleDiscardDrawn()}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-600/80 border border-red-500 text-white text-[10px] hover:bg-red-500 transition-colors shadow-lg"
                  >
                    <Trash2 className="w-3 h-3" />
                    Discard
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Discard Pile */}
            <motion.div
              className="relative"
              onClick={canDraw && discardTop ? handleDrawFromDiscard : undefined}
              whileHover={canDraw && discardTop ? { scale: 1.05 } : undefined}
              whileTap={canDraw && discardTop ? { scale: 0.95 } : undefined}
              style={{ cursor: canDraw && discardTop ? 'pointer' : 'default' }}
            >
              <div className={`w-16 h-24 sm:w-20 sm:h-30 rounded-xl overflow-hidden shadow-lg border-2 bg-zinc-800/80 ${canDraw && discardTop ? 'border-amber-500 shadow-amber-500/20' : 'border-zinc-700/80'
                }`}>
                {discardTop ? (
                  <img src={getCardImagePath(discardTop)} alt="Discard pile" className="w-full h-full object-cover" draggable={false} />
                ) : (
                  <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                    <span className="text-zinc-600 text-[10px]">Empty</span>
                  </div>
                )}
              </div>
              <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] text-zinc-400 whitespace-nowrap bg-black/40 px-1 rounded">
                Discard ({discardPile.length})
              </span>
            </motion.div>
          </div>
        </div>

        {/* East (right middle) */}
        <div className="col-start-3 row-start-2 flex items-center justify-center px-1">
          <PlayerHand
            player={eastPlayer}
            position="east"
            isCurrentTurn={currentTurnSeat === eastPlayer.seatIndex}
            onCardClick={(idx) => handleCardClick(eastPlayer.seatIndex, idx)}
            isInteractive={canTargetPower}
            showFaces={false}
            isWinner={winnerSeat === eastPlayer.seatIndex}
          />
        </div>

        {/* South (bottom center) - local player */}
        <div className="col-start-2 row-start-3 flex justify-center items-end pb-1">
          <PlayerHand
            player={southPlayer}
            position="south"
            isCurrentTurn={currentTurnSeat === southPlayer.seatIndex}
            onCardClick={(idx) => handleCardClick(southPlayer.seatIndex, idx)}
            isInteractive={canDecide || canTargetPower}
            showFaces={false}
            isWinner={winnerSeat === southPlayer.seatIndex}
          />
        </div>
      </div>

      {/* Power Action Overlay - Mass Swap */}
      <AnimatePresence>
        {canTargetPower && activePower === 'mass_swap' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-6 p-8 bg-zinc-900 border border-amber-500/50 rounded-2xl shadow-2xl shadow-amber-500/20">
              <h3 className="text-2xl font-bold text-amber-400">Joker Mass Swap</h3>
              <p className="text-zinc-400 text-center max-w-xs">
                Select a direction to rotate all hands!
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => handleRotateHands('left')}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 hover:border-amber-500 transition-all group"
                >
                  <RotateCcw className="w-8 h-8 text-zinc-400 group-hover:text-amber-400" />
                  <span className="text-sm font-medium text-zinc-300 group-hover:text-white">Rotate Left</span>
                </button>
                <button
                  onClick={() => handleRotateHands('right')}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 hover:border-amber-500 transition-all group"
                >
                  <RotateCw className="w-8 h-8 text-zinc-400 group-hover:text-amber-400" />
                  <span className="text-sm font-medium text-zinc-300 group-hover:text-white">Rotate Right</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Power Decision Modal */}
      <AnimatePresence>
        {powerDecision && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm h-full w-full"
          >
            <div className="flex flex-col items-center gap-4 p-6 bg-zinc-900 border border-violet-500/50 rounded-2xl shadow-2xl">
              <h3 className="text-xl font-bold text-violet-400">Card Power Available!</h3>
              {powerDecision.card && (
                <div className="transform scale-75">
                  {/* We don't have to show card unless we want to, but it's nice. */}
                  <CardComponent card={{ ...powerDecision.card, isFaceUp: true }} showFace={true} size="lg" />
                </div>
              )}
              <p className="text-zinc-300 max-w-xs text-center">
                Do you want to use the <span className="text-white font-bold">{powerName(getCardPower(powerDecision.card!) || 'unlock')}</span> power?
              </p>
              <div className="flex flex-col gap-2 mt-2 w-full">
                <button
                  onClick={() => confirmPowerUsage(true)}
                  className="w-full px-4 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-violet-500/20"
                >
                  Yes, Use Power
                </button>
                <button
                  onClick={() => confirmPowerUsage(false)}
                  className="w-full px-4 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl font-medium transition-colors"
                >
                  No, Just Discard
                </button>
                <button
                  onClick={cancelPowerUsage}
                  className="w-full px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel (Swap with Hand)
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase instructions */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${phase}-${currentTurnSeat}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="text-center text-[10px] sm:text-xs text-zinc-400 py-1 shrink-0 bg-black/30 backdrop-blur-sm rounded-full px-4 mx-auto mt-2"
        >
          {canDraw && 'Draw a card from the deck or discard pile.'}
          {canDecide && 'Click a card in your hand to swap, or discard the drawn card.'}
          {!isAnyLocalTurn && phase === 'turn_draw' && `${currentPlayerName} ${players[currentTurnSeat]?.kind === 'ai' ? 'is thinking...' : 'is drawing...'}`}
        </motion.div>

        {/* Emote Button */}
        <div className="absolute bottom-4 right-4 z-40">
          <AnimatePresence>
            {showEmotes && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                className="absolute bottom-12 right-0 flex flex-col gap-2 p-2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl min-w-[40px]"
              >
                {EMOTES.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => handleEmote(emoji)}
                    className="text-2xl hover:scale-125 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => setShowEmotes(!showEmotes)}
            className="p-3 bg-zinc-800 border border-zinc-700 rounded-full text-zinc-400 hover:text-amber-400 hover:border-amber-500 transition-colors shadow-lg"
          >
            <Smile className="w-6 h-6" />
          </button>
        </div>
      </AnimatePresence>
    </div>
  );
}
