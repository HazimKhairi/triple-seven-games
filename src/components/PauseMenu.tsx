'use client';
import { motion } from 'framer-motion';
import { RotateCcw, Play, Home } from 'lucide-react';

interface PauseMenuProps {
    onResume: () => void;
    onQuit: () => void;
}

export default function PauseMenu({ onResume, onQuit }: PauseMenuProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md"
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="w-full max-w-md p-6 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl flex flex-col gap-6 max-h-[90vh] overflow-y-auto"
            >
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-white mb-1">Game Paused</h2>
                    <p className="text-zinc-400 text-sm">Rules & Info</p>
                </div>

                <div className="space-y-4">
                    <section>
                        <h3 className="text-amber-400 font-bold mb-2 text-sm uppercase tracking-wider">Card Values</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm text-zinc-300">
                            <div className="flex justify-between bg-zinc-800/50 px-3 py-1.5 rounded">
                                <span>Ace (A)</span>
                                <span className="font-mono font-bold">1 pt</span>
                            </div>
                            <div className="flex justify-between bg-zinc-800/50 px-3 py-1.5 rounded">
                                <span>2 - 9</span>
                                <span className="font-mono font-bold">Face Value</span>
                            </div>
                            <div className="flex justify-between bg-zinc-800/50 px-3 py-1.5 rounded">
                                <span>10, J, Q, K</span>
                                <span className="font-mono font-bold">10 pts</span>
                            </div>
                            <div className="flex justify-between bg-zinc-800/50 px-3 py-1.5 rounded border border-emerald-500/30">
                                <span className="text-emerald-400 font-bold">7</span>
                                <span className="font-mono font-bold text-emerald-400">0 pts</span>
                            </div>
                            <div className="flex justify-between bg-zinc-800/50 px-3 py-1.5 rounded border border-red-500/30">
                                <span className="text-red-400 font-bold">777</span>
                                <span className="font-mono font-bold text-red-400">INSTANT WIN</span>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-violet-400 font-bold mb-2 text-sm uppercase tracking-wider">Power Cards</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-start gap-2 bg-zinc-800/50 p-2 rounded">
                                <span className="font-bold text-white w-8">10</span>
                                <span className="text-zinc-300">
                                    <strong className="text-violet-300">Unlock:</strong> Unlock any locked card.
                                </span>
                            </div>
                            <div className="flex items-start gap-2 bg-zinc-800/50 p-2 rounded">
                                <span className="font-bold text-white w-8">J</span>
                                <span className="text-zinc-300">
                                    <strong className="text-violet-300">Swap:</strong> View one of your cards, then swap it with any opponent's card.
                                </span>
                            </div>
                            <div className="flex items-start gap-2 bg-zinc-800/50 p-2 rounded">
                                <span className="font-bold text-white w-8">Q</span>
                                <span className="text-zinc-300">
                                    <strong className="text-violet-300">Peek:</strong> Look at any card (yours or opponent's) for 3 seconds.
                                </span>
                            </div>
                            <div className="flex items-start gap-2 bg-zinc-800/50 p-2 rounded">
                                <span className="font-bold text-white w-8">K</span>
                                <span className="text-zinc-300">
                                    <strong className="text-violet-300">Lock:</strong> Lock a card so it cannot be swapped or peeked.
                                </span>
                            </div>
                            <div className="flex items-start gap-2 bg-zinc-800/50 p-2 rounded border border-amber-500/30">
                                <span className="font-bold text-amber-400 w-8">Joker</span>
                                <span className="text-zinc-300">
                                    <strong className="text-amber-400">Mass Swap:</strong> Rotate all players' hands to the Left or Right!
                                </span>
                            </div>
                        </div>
                    </section>
                </div>

                <div className="flex flex-col gap-2 mt-2">
                    <button
                        onClick={onResume}
                        className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20"
                    >
                        <Play className="w-5 h-5 fill-current" />
                        Resume Game
                    </button>

                    <button
                        onClick={onQuit}
                        className="flex items-center justify-center gap-2 w-full py-3 bg-zinc-800 hover:bg-red-900/50 hover:text-red-200 text-zinc-400 rounded-xl font-medium transition-all"
                    >
                        <Home className="w-5 h-5" />
                        Quit to Menu
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
