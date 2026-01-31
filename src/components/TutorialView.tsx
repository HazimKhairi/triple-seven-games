'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users,
    Bot,
    ArrowRight,
    Check,
    RotateCcw,
    RotateCw,
    X
} from 'lucide-react';
import Card from './Card'; // Reuse existing card component
import { Card as CardType } from '@/types/game';
import { useGameStore } from '@/store/game-store';

type TutorialStep = {
    title: string;
    description: string;
    highlight?: 'deck' | 'hand' | 'power_overlay' | 'score' | 'none';
    mockCards?: CardType[];
    actionRequired?: boolean; // If true, user must perform action to advance (simulated)
    buttonText?: string;
};

// Mock Cards
const mockHiddenCard: CardType = { id: 't-1', suit: 'spades', rank: '7', isJoker: false, isFaceUp: false, isLocked: false, isSelected: false, isPeeking: false };
const mockSeven: CardType = { id: 't-2', suit: 'diamonds', rank: '7', isJoker: false, isFaceUp: true, isLocked: false, isSelected: false, isPeeking: false };
const mockAce: CardType = { id: 't-3', suit: 'hearts', rank: 'A', isJoker: false, isFaceUp: true, isLocked: false, isSelected: false, isPeeking: false };
const mockKing: CardType = { id: 't-4', suit: 'clubs', rank: 'K', isJoker: false, isFaceUp: true, isLocked: false, isSelected: false, isPeeking: false };
const mockJoker: CardType = { id: 't-5', suit: null, rank: null, isJoker: true, jokerColor: 'red', isFaceUp: true, isLocked: false, isSelected: false, isPeeking: false };

const steps: TutorialStep[] = [
    {
        title: "Welcome to Triple Seven",
        description: "The goal is simple: get the LOWEST score possible. The game ends when the deck runs out.",
        highlight: 'none',
        buttonText: "Let's Start"
    },
    {
        title: "Your Hand",
        description: "You start with 4 face-down cards. You don't know what they are yet! It's a mystery.",
        highlight: 'hand',
        mockCards: [mockHiddenCard, mockHiddenCard, mockHiddenCard, mockHiddenCard]
    },
    {
        title: "The Turn",
        description: "On your turn, you draw a card from the Deck or the Discard Pile.",
        highlight: 'deck',
        mockCards: [mockHiddenCard, mockHiddenCard, mockHiddenCard, mockHiddenCard]
    },
    {
        title: "Values: The Good",
        description: "7 is the Best card (0 points). Ace is 1 point. Low numbers are good!",
        highlight: 'hand',
        mockCards: [mockSeven, mockAce, mockHiddenCard, mockHiddenCard] // Reveal some
    },
    {
        title: "Values: The Bad",
        description: "Face cards (J, Q, K) are 10 points. But wait... Kings are 0 points in some variants? No, in standard Triple Seven here: 10, J, Q, K are 10 points. 7 is 0.",
        highlight: 'hand',
        mockCards: [mockSeven, mockAce, { ...mockKing, rank: 'Q' }, mockHiddenCard]
    },
    {
        title: "Power Cards",
        description: "Some cards have Powers when discarded! 10 = Unlock, J = Swap, Q = Peek, K = Lock.",
        highlight: 'deck',
        mockCards: [mockSeven, mockAce, mockHiddenCard, mockHiddenCard]
    },
    {
        title: "The King (Lock)",
        description: "Discarding a King lets you LOCK an opponent's card. Does nothing to your score directly, but annoys them.",
        highlight: 'none'
    },
    {
        title: "The Joker",
        description: "Jokers are worth 10 points (High!). BUT, discarding one triggers MASS SWAP. Rotates all hands!",
        highlight: 'power_overlay'
    },
    {
        title: "Winning",
        description: "Keep swapping high cards for low ones. Remember your hidden cards. Lowest total score wins!",
        highlight: 'score',
        buttonText: "I'm Ready!"
    }
];

export default function TutorialView() {
    const [currentStep, setCurrentStep] = useState(0);
    const { setPhase } = useGameStore();

    const step = steps[currentStep];

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(c => c + 1);
        } else {
            setPhase('menu');
        }
    };

    const progress = ((currentStep + 1) / steps.length) * 100;

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white relative overflow-hidden p-6">
            {/* Background Decor */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-violet-900/20 via-zinc-950 to-zinc-950 pointer-events-none" />

            <div className="absolute top-6 right-6">
                <button
                    onClick={() => setPhase('menu')}
                    className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>

            <div className="z-10 w-full max-w-4xl flex flex-col md:flex-row gap-12 items-center">

                {/* Visual Stage */}
                <div className="flex-1 w-full flex items-center justify-center min-h-[300px] relative bg-zinc-900/30 rounded-3xl border border-zinc-800 p-8 shadow-2xl">
                    {step.highlight === 'none' && (
                        <div className="text-center">
                            <h1 className="text-4xl md:text-6xl font-black mb-4 tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 to-purple-600">
                                TRIPLE<br />SEVEN
                            </h1>
                            <RotateCcw className="w-16 h-16 mx-auto text-zinc-600 animate-spin-slow" />
                        </div>
                    )}

                    {step.highlight === 'hand' && step.mockCards && (
                        <div className="flex gap-2">
                            {step.mockCards.map((c, i) => (
                                <motion.div
                                    key={`${c.id}-${i}`}
                                    initial={{ y: 50, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: i * 0.1 }}
                                >
                                    <Card card={c} showFace={c.isFaceUp} size="lg" />
                                </motion.div>
                            ))}
                        </div>
                    )}

                    {step.highlight === 'deck' && (
                        <div className="flex gap-8">
                            <div className="w-24 h-36 bg-zinc-800 rounded-xl border-2 border-zinc-700 flex items-center justify-center relative shadow-xl">
                                <span className="text-zinc-500 font-bold">DECK</span>
                                {/* Highlight Ring */}
                                <motion.div
                                    className="absolute -inset-2 rounded-xl border-2 border-emerald-500"
                                    animate={{ scale: [1, 1.05, 1], opacity: [0.5, 1, 0.5] }}
                                    transition={{ repeat: Infinity, duration: 2 }}
                                />
                            </div>
                            <div className="w-24 h-36 bg-zinc-800 rounded-xl border-2 border-zinc-700 flex items-center justify-center">
                                <span className="text-zinc-600 text-xs">DISCARD</span>
                            </div>
                        </div>
                    )}

                    {step.highlight === 'power_overlay' && (
                        <div className="flex gap-4">
                            <motion.button
                                className="flex flex-col items-center gap-2 p-4 bg-zinc-800 border border-green-500 rounded-xl text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                                animate={{ y: [-5, 5, -5] }}
                                transition={{ repeat: Infinity, duration: 3 }}
                            >
                                <RotateCcw className="w-8 h-8" />
                                <span>Rotate Left</span>
                            </motion.button>
                            <motion.button
                                className="flex flex-col items-center gap-2 p-4 bg-zinc-800 border border-amber-500 rounded-xl text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                                animate={{ y: [5, -5, 5] }}
                                transition={{ repeat: Infinity, duration: 3, delay: 1.5 }}
                            >
                                <RotateCw className="w-8 h-8" />
                                <span>Rotate Right</span>
                            </motion.button>
                        </div>
                    )}

                    {step.highlight === 'score' && (
                        <div className="text-center space-y-4">
                            <div className="text-6xl font-black text-amber-500">0</div>
                            <div className="text-xl text-zinc-300">Target Score</div>
                        </div>
                    )}
                </div>

                {/* Content Panel */}
                <div className="flex-1 w-full max-w-md space-y-6">
                    <div className="space-y-2">
                        <span className="text-zinc-500 font-mono text-sm uppercase tracking-widest">
                            Tutorial {currentStep + 1}/{steps.length}
                        </span>
                        <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-violet-600"
                                animate={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-4"
                        >
                            <h2 className="text-3xl font-bold text-white">{step.title}</h2>
                            <p className="text-lg text-zinc-400 leading-relaxed">
                                {step.description}
                            </p>
                        </motion.div>
                    </AnimatePresence>

                    <button
                        onClick={handleNext}
                        className="group flex items-center justify-between w-full p-4 bg-white hover:bg-zinc-200 text-black rounded-xl font-bold text-lg shadow-lg shadow-white/10 transition-all hover:scale-[1.02]"
                    >
                        <span>{step.buttonText || "Next"}</span>
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
}
