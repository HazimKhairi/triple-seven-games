import { motion, AnimatePresence } from 'framer-motion';
import Card from './Card';
import { PlayerInfo, SeatPosition } from '@/types/game';
import { Crown, Bot, User, Swords, Shuffle } from 'lucide-react';
import { useGameStore } from '@/store/game-store';

interface PlayerHandProps {
  player: PlayerInfo;
  position: SeatPosition;
  isCurrentTurn: boolean;
  onCardClick?: (index: number) => void;
  isInteractive: boolean;
  showFaces: boolean;
  isWinner?: boolean;
  disableBlur?: boolean;
}

export default function PlayerHand({
  player,
  position,
  isCurrentTurn,
  onCardClick,
  isInteractive,
  showFaces,
  isWinner = false,
  disableBlur = false,
}: PlayerHandProps) {
  const isVertical = position === 'west' || position === 'east';
  const cardSize = isVertical ? 'sm' : 'md';
  const cardAnimations = useGameStore((state) => state.cardAnimations);

  const isActive = isCurrentTurn || disableBlur;

  return (
    <motion.div
      className={`flex flex-col items-center gap-1 transition-all duration-300 ${isActive ? 'opacity-100 blur-none z-10' : 'opacity-40 blur-[2px] grayscale-[0.5]'
        }`}
      animate={{
        opacity: isActive ? 1 : 0.4,
        filter: isActive ? 'blur(0px) grayscale(0%)' : 'blur(2px) grayscale(50%)',
        scale: isActive ? 1.05 : 0.95
      }}
    >
      {/* Player label */}
      <div
        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium mb-1 ${isCurrentTurn
          ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-600/50'
          : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/50'
          } ${isWinner ? 'bg-amber-600/30 text-amber-300 border-amber-500/50' : ''}`}
      >
        {player.kind === 'ai' ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
        <span>{player.name}</span>
        {isWinner && <Crown className="w-3 h-3 text-amber-400" />}
        {player.score > 0 && (
          <span className="text-[10px] opacity-60">({player.score}pts)</span>
        )}
      </div>

      {/* Cards */}
      <div
        className={`flex ${isVertical ? 'flex-col' : 'flex-row'} gap-1 sm:gap-2`}
      >
        {player.hand.map((card, i) => {
          const animation = cardAnimations.find(
            (a) => a.seatIndex === player.seatIndex && a.cardIndex === i
          );

          return (
            <div
              key={card.id}
              className={`relative ${isVertical ? 'transform-gpu' : ''}`}
              style={isVertical ? { transform: `rotate(${position === 'west' ? 90 : -90}deg)` } : undefined}
            >
              <Card
                card={card}
                onClick={() => onCardClick?.(i)}
                isInteractive={isInteractive}
                showFace={showFaces ? true : card.isFaceUp || card.isPeeking}
                size={cardSize}
                delay={i * 0.05}
              />

              {/* Swap Animation Overlay */}
              <AnimatePresence>
                {animation && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1.1 }}
                    exit={{ opacity: 0, scale: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px] rounded-lg pointer-events-none"
                  >
                    <div className="p-1.5 bg-amber-500 rounded-full shadow-lg shadow-amber-500/50">
                      {animation.type === 'mass_swap' ? (
                        <Shuffle className="w-6 h-6 text-white animate-spin-slow" />
                      ) : (
                        <Swords className="w-6 h-6 text-white" />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

    </motion.div>
  );
}
