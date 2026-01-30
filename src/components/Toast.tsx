'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import { X } from 'lucide-react';

const typeStyles = {
  info: 'bg-zinc-800 border-zinc-600 text-zinc-100',
  power: 'bg-violet-900/90 border-violet-500 text-violet-100',
  warning: 'bg-amber-900/90 border-amber-500 text-amber-100',
  success: 'bg-emerald-900/90 border-emerald-500 text-emerald-100',
};

export default function ToastContainer() {
  const toasts = useGameStore((s) => s.toasts);
  const removeToast = useGameStore((s) => s.removeToast);

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-xs sm:max-w-sm">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className={`px-4 py-3 rounded-lg border shadow-xl text-sm font-medium flex items-center justify-between gap-2 ${typeStyles[toast.type]}`}
          >
            <span>{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} className="opacity-60 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
