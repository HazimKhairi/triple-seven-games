'use client';

import GameBoard from '@/components/GameBoard';
import ToastContainer from '@/components/Toast';

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      <GameBoard />
      <ToastContainer />
    </main>
  );
}
