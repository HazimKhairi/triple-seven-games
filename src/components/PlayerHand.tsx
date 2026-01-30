'use client';

import { motion } from 'framer-motion';
import Card from './Card';
import { PlayerInfo, SeatPosition } from '@/types/game';
import { Crown, Bot, User } from 'lucide-react';

interface PlayerHandProps {
  player: PlayerInfo;
  position: SeatPosition;
  isCurrentTurn: boolean;
  onCardClick?: (index: number) => void;
  isInteractive: boolean;
  showFaces: boolean;
  isWinner?: boolean;
}

export default function PlayerHand({
  player,
  position,
  isCurrentTurn,
  onCardClick,
  isInteractive,
  showFaces,
  isWinner = false,
}: PlayerHandProps) {
  const isVertical = position === 'west' || position === 'east';
  const cardSize = isVertical ? 'sm' : 'md';

  return (
    <motion.div
      className={`flex flex-col items-center gap-1 ${
        isCurrentTurn ? 'opacity-100' : 'opacity-75'
      }`}
      animate={{ opacity: isCurrentTurn ? 1 : 0.75 }}
    >
      {/* Player label */}
      <div
        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium mb-1 ${
          isCurrentTurn
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
        {player.hand.map((card, i) => (
          <div
            key={card.id}
            className={isVertical ? 'transform-gpu' : ''}
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
          </div>
        ))}
      </div>

      {/* Turn indicator */}
      {isCurrentTurn && (
        <motion.div
          className="w-2 h-2 rounded-full bg-emerald-400 mt-1"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
}
