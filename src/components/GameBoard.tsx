'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import Card from './Card';
import PlayerHand from './PlayerHand';
import Lobby from './Lobby';
import { getCardImagePath, Difficulty, SeatPosition, GameConfig } from '@/types/game';
import {
  Layers,
  Trash2,
  RotateCcw,
  Crown,
  Swords,
  Eye,
  Lock,
  Unlock,
  Shuffle,
  Users,
  Bot,
  Minus,
  Plus,
  Globe,
  Monitor,
  ArrowLeft,
  Clock,
} from 'lucide-react';

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

type MenuStep = 'mode' | 'difficulty' | 'players' | 'online_setup';

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
    startGame,
    resetGame,
  } = useGameStore();

  const mp = useMultiplayer();

  const [menuStep, setMenuStep] = useState<MenuStep>('mode');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('beginner');
  const [humanCount, setHumanCount] = useState(1);
  const [playerName, setPlayerName] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [onlineAction, setOnlineAction] = useState<'create' | 'join'>('create');

  const discardTop = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;
  const localPlayer = players[localPlayerSeat];
  const isLocalTurn = localPlayer?.isLocal && currentTurnSeat === localPlayerSeat;

  const canDraw = phase === 'turn_draw' && isLocalTurn;
  const canDecide = phase === 'turn_decision' && isLocalTurn;
  const canTargetPower = phase === 'power_target' && currentTurnSeat === localPlayerSeat;

  // Dispatch actions: online sends via WS, offline uses local store
  const handleDrawFromDeck = () => {
    if (isOnline) {
      mp.sendAction({ type: 'draw_from_deck' });
    } else {
      drawFromDeck();
    }
  };

  const handleDrawFromDiscard = () => {
    if (isOnline) {
      mp.sendAction({ type: 'draw_from_discard' });
    } else {
      drawFromDiscard();
    }
  };

  const handleSwapWithHand = (handIndex: number) => {
    if (isOnline) {
      mp.sendAction({ type: 'swap_with_hand', handIndex });
    } else {
      swapWithHand(handIndex);
    }
  };

  const handleDiscardDrawn = () => {
    if (isOnline) {
      mp.sendAction({ type: 'discard_drawn' });
    } else {
      discardDrawn();
    }
  };

  const handleSelectPowerTarget = (targetSeat: number, targetIndex: number) => {
    if (isOnline) {
      mp.sendAction({ type: 'select_power_target', targetSeat, targetIndex });
    } else {
      selectPowerTarget(targetSeat, targetIndex);
    }
  };

  // Handle card clicks for any seat
  const handleCardClick = (seatIndex: number, cardIndex: number) => {
    if (canDecide && seatIndex === localPlayerSeat && drawnCard) {
      handleSwapWithHand(cardIndex);
    } else if (canTargetPower && activePower) {
      if (activePower === 'mass_swap' && seatIndex !== localPlayerSeat) {
        handleSelectPowerTarget(seatIndex, 0);
      } else {
        handleSelectPowerTarget(seatIndex, cardIndex);
      }
    }
  };

  const handleStartLocalGame = () => {
    const names = ['You', 'Player 2', 'Player 3', 'Player 4'];
    const aiNames = ['AI West', 'AI North', 'AI East'];
    let aiIdx = 0;

    const config: GameConfig = {
      difficulty: selectedDifficulty,
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
    setMenuStep('mode');
  };

  const handleCreateOnlineRoom = () => {
    const name = playerName.trim() || 'Player';
    mp.createRoom(name, selectedDifficulty);
  };

  const handleJoinOnlineRoom = () => {
    const name = playerName.trim() || 'Player';
    const code = joinRoomId.trim().toUpperCase();
    if (!code) return;
    mp.joinRoom(code, name);
  };

  const handleBackToMenu = () => {
    mp.disconnect();
    resetGame();
    setMenuStep('mode');
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
      <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-4">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-5xl sm:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-amber-400 to-red-500 mb-2">
            777
          </h1>
          <p className="text-zinc-400 text-lg">Triple Seven</p>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* Step 1: Choose mode */}
          {menuStep === 'mode' && (
            <motion.div
              key="mode"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col gap-3 w-full max-w-xs"
            >
              <p className="text-center text-zinc-500 text-sm mb-2">Choose Game Mode</p>
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                onClick={() => setMenuStep('difficulty')}
                className="flex items-center justify-center gap-3 w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200 border bg-emerald-600/20 border-emerald-600 text-emerald-400 hover:bg-emerald-600/30"
              >
                <Monitor className="w-5 h-5" />
                Local Game
              </motion.button>
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                onClick={() => setMenuStep('online_setup')}
                className="flex items-center justify-center gap-3 w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200 border bg-violet-600/20 border-violet-600 text-violet-400 hover:bg-violet-600/30"
              >
                <Globe className="w-5 h-5" />
                Online Multiplayer
              </motion.button>
            </motion.div>
          )}

          {/* Step 2a: Difficulty (local path) */}
          {menuStep === 'difficulty' && (
            <motion.div
              key="difficulty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col gap-3 w-full max-w-xs"
            >
              <p className="text-center text-zinc-500 text-sm mb-2">Select Difficulty</p>
              {(['beginner', 'intermediate', 'hardcore'] as const).map((diff, i) => (
                <motion.button
                  key={diff}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.1 }}
                  onClick={() => { setSelectedDifficulty(diff); setMenuStep('players'); }}
                  className={`w-full py-3 px-6 rounded-xl font-semibold text-sm uppercase tracking-wider transition-all duration-200 border ${
                    diff === 'beginner'
                      ? 'bg-emerald-600/20 border-emerald-600 text-emerald-400 hover:bg-emerald-600/30'
                      : diff === 'intermediate'
                      ? 'bg-amber-600/20 border-amber-600 text-amber-400 hover:bg-amber-600/30'
                      : 'bg-red-600/20 border-red-600 text-red-400 hover:bg-red-600/30'
                  }`}
                >
                  {diff}
                </motion.button>
              ))}
              <button
                onClick={() => setMenuStep('mode')}
                className="mt-2 py-2 text-zinc-500 text-sm hover:text-zinc-300"
              >
                Back
              </button>
            </motion.div>
          )}

          {/* Step 2b: Player count (local path) */}
          {menuStep === 'players' && (
            <motion.div
              key="players"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col gap-4 w-full max-w-xs items-center"
            >
              <p className="text-center text-zinc-500 text-sm">How many human players?</p>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => setHumanCount(Math.max(1, humanCount - 1))}
                  className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span className="text-2xl font-bold text-zinc-100 w-6 text-center">{humanCount}</span>
                </div>
                <button
                  onClick={() => setHumanCount(Math.min(4, humanCount + 1))}
                  className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Seat preview */}
              <div className="grid grid-cols-4 gap-2 w-full">
                {Array.from({ length: 4 }, (_, i) => (
                  <div
                    key={i}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border ${
                      i < humanCount
                        ? 'bg-emerald-600/10 border-emerald-600/30 text-emerald-400'
                        : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-500'
                    }`}
                  >
                    {i < humanCount ? (
                      <Users className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                    <span className="text-[10px]">
                      {['South', 'West', 'North', 'East'][i]}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 w-full">
                <button
                  onClick={() => setMenuStep('difficulty')}
                  className="flex-1 py-2 px-4 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-400 text-sm hover:bg-zinc-700"
                >
                  Back
                </button>
                <button
                  onClick={handleStartLocalGame}
                  className="flex-1 py-2 px-4 rounded-xl bg-emerald-600 border border-emerald-500 text-white text-sm font-semibold hover:bg-emerald-500"
                >
                  Start Game
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 2c: Online setup */}
          {menuStep === 'online_setup' && (
            <motion.div
              key="online"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col gap-4 w-full max-w-xs items-center"
            >
              <p className="text-center text-zinc-500 text-sm">Online Multiplayer</p>

              {/* Name input */}
              <div className="w-full">
                <label className="text-zinc-500 text-xs mb-1 block">Your Name</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name..."
                  maxLength={16}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* Toggle create / join */}
              <div className="flex rounded-xl overflow-hidden border border-zinc-700 w-full">
                <button
                  onClick={() => setOnlineAction('create')}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    onlineAction === 'create'
                      ? 'bg-violet-600/30 text-violet-300'
                      : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Create Room
                </button>
                <button
                  onClick={() => setOnlineAction('join')}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    onlineAction === 'join'
                      ? 'bg-violet-600/30 text-violet-300'
                      : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Join Room
                </button>
              </div>

              {onlineAction === 'create' ? (
                <div className="flex flex-col gap-3 w-full">
                  <label className="text-zinc-500 text-xs">AI Difficulty (for empty seats)</label>
                  <div className="flex gap-2">
                    {(['beginner', 'intermediate', 'hardcore'] as const).map((diff) => (
                      <button
                        key={diff}
                        onClick={() => setSelectedDifficulty(diff)}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                          selectedDifficulty === diff
                            ? diff === 'beginner'
                              ? 'bg-emerald-600/20 border-emerald-600 text-emerald-400'
                              : diff === 'intermediate'
                              ? 'bg-amber-600/20 border-amber-600 text-amber-400'
                              : 'bg-red-600/20 border-red-600 text-red-400'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {diff.charAt(0).toUpperCase() + diff.slice(1)}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleCreateOnlineRoom}
                    disabled={mp.isConnecting}
                    className="w-full py-2.5 rounded-xl bg-violet-600 border border-violet-500 text-white text-sm font-semibold hover:bg-violet-500 transition-colors disabled:opacity-50"
                  >
                    {mp.isConnecting ? 'Connecting...' : 'Create Room'}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 w-full">
                  <label className="text-zinc-500 text-xs">Room Code</label>
                  <input
                    type="text"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                    placeholder="Enter room code..."
                    maxLength={6}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm font-mono tracking-[0.2em] text-center placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
                  />
                  <button
                    onClick={handleJoinOnlineRoom}
                    disabled={mp.isConnecting || !joinRoomId.trim()}
                    className="w-full py-2.5 rounded-xl bg-violet-600 border border-violet-500 text-white text-sm font-semibold hover:bg-violet-500 transition-colors disabled:opacity-50"
                  >
                    {mp.isConnecting ? 'Connecting...' : 'Join Room'}
                  </button>
                </div>
              )}

              {mp.error && (
                <p className="text-red-400 text-xs">{mp.error}</p>
              )}

              <button
                onClick={() => { setMenuStep('mode'); mp.disconnect(); }}
                className="flex items-center gap-2 py-2 text-zinc-500 text-sm hover:text-zinc-300"
              >
                <ArrowLeft className="w-3 h-3" />
                Back
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="max-w-md text-center text-zinc-600 text-xs leading-relaxed mt-4"
        >
          <p className="mb-2 text-zinc-400 font-medium">How to Play</p>
          <p>4 players, lowest score wins. 7 = 0 pts (best). Face cards = 10 pts.</p>
          <p>Draw a card, then keep it (swap) or discard it. Power cards trigger on discard.</p>
        </motion.div>
      </div>
    );
  }

  // ===== GAME OVER SCREEN =====
  if (phase === 'game_over') {
    const sortedPlayers = [...players].sort((a, b) => a.score - b.score);
    const localWon = winnerSeat === localPlayerSeat;

    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="text-center"
        >
          <Crown className={`w-16 h-16 mx-auto mb-4 ${localWon ? 'text-amber-400' : 'text-zinc-500'}`} />
          <h2 className="text-3xl font-bold mb-2">
            {localWon ? 'You Win!' : `${players[winnerSeat!]?.name} Wins!`}
          </h2>
          <p className="text-zinc-400">After {turnCount} rounds</p>
        </motion.div>

        {/* Rankings */}
        <div className="flex flex-col gap-2 w-full max-w-sm">
          {sortedPlayers.map((p, rank) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: rank * 0.15 }}
              className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                p.seatIndex === winnerSeat
                  ? 'bg-amber-600/10 border-amber-500/40'
                  : 'bg-zinc-800/50 border-zinc-700/50'
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
        <div className="flex flex-wrap gap-4 justify-center">
          {sortedPlayers.map((p, rank) => (
            <div key={p.id} className="flex flex-col items-center">
              <p className="text-[10px] text-zinc-500 mb-1">{p.name}</p>
              <div className="flex gap-1">
                {p.hand.map((card, i) => (
                  <Card key={card.id} card={card} showFace={true} size="sm" delay={rank * 0.2 + i * 0.05} />
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
          className="flex items-center gap-2 py-3 px-6 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition-colors"
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
    <div className="flex flex-col h-screen p-1 sm:p-2 overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 mb-1 rounded-lg bg-zinc-900/50 border border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">Round {turnCount + 1}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
            isAnyLocalTurn
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
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-bold ${
              turnTimer <= 5
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
                  className={`h-full rounded-full ${
                    turnTimer <= 5
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
            className="flex items-center justify-center gap-2 px-3 py-1.5 mb-1 rounded-lg bg-violet-900/30 border border-violet-700 text-violet-300 text-xs sm:text-sm shrink-0"
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
              <div className={`w-16 h-24 sm:w-20 sm:h-30 rounded-xl overflow-hidden shadow-lg border-2 ${
                canDraw ? 'border-emerald-500 shadow-emerald-500/20' : 'border-zinc-700'
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
              <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] text-zinc-500 whitespace-nowrap">
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
                  <Card card={drawnCard} showFace={true} size="md" />
                  <button
                    onClick={handleDiscardDrawn}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-600/20 border border-red-600 text-red-400 text-[10px] hover:bg-red-600/30 transition-colors"
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
              <div className={`w-16 h-24 sm:w-20 sm:h-30 rounded-xl overflow-hidden shadow-lg border-2 ${
                canDraw && discardTop ? 'border-amber-500 shadow-amber-500/20' : 'border-zinc-700'
              }`}>
                {discardTop ? (
                  <img src={getCardImagePath(discardTop)} alt="Discard pile" className="w-full h-full object-cover" draggable={false} />
                ) : (
                  <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                    <span className="text-zinc-600 text-[10px]">Empty</span>
                  </div>
                )}
              </div>
              <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] text-zinc-500 whitespace-nowrap">
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

      {/* Phase instructions */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${phase}-${currentTurnSeat}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="text-center text-[10px] sm:text-xs text-zinc-500 py-1 shrink-0"
        >
          {canDraw && 'Draw a card from the deck or discard pile.'}
          {canDecide && 'Click a card in your hand to swap, or discard the drawn card.'}
          {!isAnyLocalTurn && phase === 'turn_draw' && `${currentPlayerName} is drawing...`}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
