'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import { getNextSeat } from '@/types/game';
import { X } from 'lucide-react';

const typeStyles = {
  info: 'bg-zinc-800/90 border-zinc-600 text-zinc-100',
  power: 'bg-violet-900/90 border-violet-500 text-violet-100',
  warning: 'bg-amber-900/90 border-amber-500 text-amber-100',
  success: 'bg-emerald-900/90 border-emerald-500 text-emerald-100',
};

export default function ToastContainer() {
  const toasts = useGameStore((s) => s.toasts);
  const removeToast = useGameStore((s) => s.removeToast);
  const localPlayerSeat = useGameStore((s) => s.localPlayerSeat);

  // Helper to determine position class based on seat
  const getPositionClass = (seatIndex?: number) => {
    if (seatIndex === undefined) return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'; // Center (System)

    // Calculate relative position: 0=South (Local), 1=West, 2=North, 3=East
    // Formula: (target - local + 4) % 4
    const offset = (seatIndex - localPlayerSeat + 4) % 4;

    switch (offset) {
      case 0: return 'bottom-[25%] left-1/2 -translate-x-1/2'; // South (You) - Above hand
      case 1: return 'top-1/2 left-[15%] -translate-y-1/2';   // West - Right of hand (which is on left)
      case 2: return 'top-[25%] left-1/2 -translate-x-1/2';    // North - Below hand
      case 3: return 'top-1/2 right-[15%] -translate-y-1/2';   // East - Left of hand (which is on right)
      default: return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3 }}
            className={`absolute flex items-center gap-2 px-4 py-2 rounded-lg border shadow-xl text-xs sm:text-sm font-medium backdrop-blur-sm max-w-[200px] sm:max-w-xs text-center pointer-events-auto ${typeStyles[toast.type]} ${getPositionClass(toast.seatIndex)}`}
          >
            <span>{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} className="opacity-60 hover:opacity-100 shrink-0">
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
