'use client';

import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { Card as CardType, getCardImagePath } from '@/types/game';

interface CardProps {
  card: CardType;
  onClick?: () => void;
  isInteractive?: boolean;
  showFace?: boolean; // override face visibility
  size?: 'sm' | 'md' | 'lg';
  delay?: number;
}

const sizeClasses = {
  sm: 'w-16 h-24 sm:w-20 sm:h-30',
  md: 'w-20 h-30 sm:w-24 sm:h-36',
  lg: 'w-24 h-36 sm:w-28 sm:h-42',
};

function CardBack() {
  return (
    <div className="w-full h-full flex items-center justify-center"
      style={{
        background: 'repeating-conic-gradient(#1a1a2e 0% 25%, #16213e 0% 50%) 50% / 16px 16px',
      }}
    >
      <div className="absolute inset-2 rounded-lg border-2 border-red-500/40" />
      <div className="flex flex-col items-center gap-0">
        <span className="text-red-500 font-serif font-bold text-lg leading-none">7</span>
        <span className="text-blue-900 font-serif font-bold text-xs leading-none">7</span>
        <span className="text-red-500 font-serif font-bold text-lg leading-none">7</span>
      </div>
    </div>
  );
}

export default function Card({
  card,
  onClick,
  isInteractive = false,
  showFace,
  size = 'md',
  delay = 0,
}: CardProps) {
  const faceVisible = showFace ?? card.isFaceUp ?? card.isPeeking;

  return (
    <motion.div
      className={`relative ${sizeClasses[size]} ${isInteractive ? 'cursor-pointer' : 'cursor-default'} select-none`}
      style={{ perspective: '800px' }}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      onClick={isInteractive ? onClick : undefined}
      whileHover={isInteractive ? { y: -8, transition: { duration: 0.2 } } : undefined}
      whileTap={isInteractive ? { scale: 0.95 } : undefined}
    >
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: faceVisible ? 180 : 0 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      >
        {/* Back face */}
        <div
          className="absolute inset-0 rounded-xl overflow-hidden shadow-lg border-2 border-zinc-700"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <CardBack />
        </div>

        {/* Front face */}
        <div
          className="absolute inset-0 rounded-xl overflow-hidden shadow-lg border-2 border-zinc-600 bg-white"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getCardImagePath(card)}
            alt={card.isJoker ? 'Joker' : `${card.rank} of ${card.suit}`}
            className="w-full h-full object-cover"
            draggable={false}
          />
        </div>
      </motion.div>

      {/* Lock indicator */}
      {card.isLocked && (
        <motion.div
          className="absolute -top-2 -right-2 z-10 bg-amber-500 rounded-full p-1 shadow-md"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <Lock className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
        </motion.div>
      )}

      {/* Selected indicator */}
      {card.isSelected && (
        <motion.div
          className="absolute inset-0 rounded-xl border-3 border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.5)] z-10 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        />
      )}

      {/* Peeking glow */}
      {card.isPeeking && (
        <motion.div
          className="absolute inset-0 rounded-xl border-3 border-violet-400 shadow-[0_0_20px_rgba(167,139,250,0.6)] z-10 pointer-events-none"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
}
