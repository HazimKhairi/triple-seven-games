'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import CardComponent from './Card';
import PlayerHand from './PlayerHand';
import { Card as CardType, getCardImagePath } from '@/types/game';
import {
    ArrowRight,
    Check,
    RotateCcw,
    X,
    MousePointer2,
    Info
} from 'lucide-react';

const TUTORIAL_STEPS = [
    {
        id: 'intro',
        title: "Welcome to TUJUH",
        text: "This is a card game where the LOWEST score wins. Let's learn how to play in under a minute.",
        highlight: 'center'
    },
    {
        id: 'hand',
        title: "Your Hand",
        text: "You start with 4 face-down cards. You don't know what they are initially! Your goal is to swap high cards for low ones.",
        highlight: 'south'
    },
    {
        id: 'opponents',
        title: "Opponents",
        text: "These are your AI opponents. They also have hidden cards. You can mess with them using Power Cards.",
        highlight: 'others'
    },
    {
        id: 'draw',
        title: "Your Turn: Draw",
        text: "On your turn, tap the Deck to draw a hidden card, or the Discard Pile to take the top face-up card.",
        highlight: 'deck_area',
        action: 'draw'
    },
    {
        id: 'simulate_draw',
        title: "Decision Time",
        text: "You drew a card! Now, click one of your hidden cards to SWAP it, or click 'Discard' to throw this card away.",
        highlight: 'south_interactive',
        action: 'swap'
    },
    {
        id: 'values',
        title: "Card Values",
        text: "7 is 0 points (BEST). Ace is 1 point. Face cards (J,Q,K,10) are 10 points. 2-9 are face value.",
        highlight: 'center_card'
    },
    {
        id: 'powers',
        title: "Power Cards",
        text: "Discarding special cards triggers powers: 10 (Unlock), J (Swap), Q (Peek), K (Lock), Joker (Mass Swap).",
        highlight: 'powers'
    },
    {
        id: 'end',
        title: "Ending the Game",
        text: "The game ends when the Deck runs out. The player with the lowest total score wins!",
        highlight: 'none'
    }
];

// Mock Data
const MOCK_HIDDEN_CARD: CardType = { id: 'm-0', suit: 'spades', rank: '7', isFaceUp: false, isLocked: false, isJoker: false, isSelected: false, isPeeking: false };
const MOCK_FACE_CARD: CardType = { id: 'm-1', suit: 'diamonds', rank: '7', isFaceUp: true, isLocked: false, isJoker: false, isSelected: false, isPeeking: false };

const PLAYER_SOUTH = { id: 'p1', seatIndex: 0, kind: 'human' as const, name: 'You', isLocal: true, score: 0, hand: Array(4).fill(MOCK_HIDDEN_CARD) };
const PLAYER_NORTH = { id: 'p2', seatIndex: 2, kind: 'ai' as const, name: 'AI North', isLocal: false, score: 0, hand: Array(4).fill(MOCK_HIDDEN_CARD) };
const PLAYER_WEST = { id: 'p3', seatIndex: 1, kind: 'ai' as const, name: 'AI West', isLocal: false, score: 0, hand: Array(4).fill(MOCK_HIDDEN_CARD) };
const PLAYER_EAST = { id: 'p4', seatIndex: 3, kind: 'ai' as const, name: 'AI East', isLocal: false, score: 0, hand: Array(4).fill(MOCK_HIDDEN_CARD) };

export default function TutorialView() {
    const { setPhase } = useGameStore();
    const [stepIndex, setStepIndex] = useState(0);
    const [mockDrawnCard, setMockDrawnCard] = useState<CardType | null>(null);

    const step = TUTORIAL_STEPS[stepIndex];

    const handleNext = () => {
        if (step.action === 'draw' && !mockDrawnCard) {
            // Simulate draw
            setMockDrawnCard({ ...MOCK_FACE_CARD, id: 'drawn-1', rank: 'A', suit: 'hearts' });
            setStepIndex(s => s + 1);
        } else if (step.action === 'swap') {
            // Simulate swap
            setMockDrawnCard(null);
            // Flash a toast or something?
            setStepIndex(s => s + 1);
        } else {
            if (stepIndex < TUTORIAL_STEPS.length - 1) {
                setStepIndex(s => s + 1);
            } else {
                setPhase('menu');
            }
        }
    };

    const handlePrev = () => {
        if (stepIndex > 0) setStepIndex(s => s - 1);
    };

    return (
        <div className="relative flex flex-col h-screen p-1 sm:p-2 overflow-hidden bg-[url('/background.png')] bg-cover bg-center">

            {/* Dark Overlay for focus */}
            <div className="absolute inset-0 bg-black/60 z-30 pointer-events-none transition-colors duration-500" />

            {/* EXIT BUTTON */}
            <div className="absolute top-4 right-4 z-[60]">
                <button onClick={() => setPhase('menu')} className="p-2 bg-zinc-900 rounded-full border border-zinc-700 text-zinc-400 hover:text-white">
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* TUTORIAL CARD / DIALOG */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-[50] pointer-events-auto px-4">
                <motion.div
                    key={step.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-zinc-900/95 border border-zinc-700 p-6 rounded-2xl shadow-2xl backdrop-blur-xl"
                >
                    <div className="flex items-center gap-2 mb-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase">
                            Step {stepIndex + 1}/{TUTORIAL_STEPS.length}
                        </span>
                        <h2 className="text-xl font-bold text-white text-shadow">{step.title}</h2>
                    </div>

                    <p className="text-zinc-300 leading-relaxed mb-6 min-h-[60px]">
                        {step.text}
                    </p>

                    <div className="flex items-center justify-between gap-4">
                        <button
                            onClick={handlePrev}
                            disabled={stepIndex === 0}
                            className="px-4 py-2 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 font-medium"
                        >
                            Back
                        </button>

                        <button
                            onClick={handleNext}
                            className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl font-bold hover:scale-105 transition-transform shadow-lg shadow-white/10"
                        >
                            {stepIndex === TUTORIAL_STEPS.length - 1 ? "Finish" : (step.action === 'draw' ? "Draw Card" : step.action === 'swap' ? "Swap Card" : "Next")}
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </motion.div>
            </div>

            {/* GAME BOARD MOCKUP (Behind Overlay) */}
            <div className="flex-1 grid grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr_auto] gap-1 min-h-0 relative z-20">

                {/* --- HIGHLIGHT LOGIC --- */}
                {/* We render highlighters behind the components but above the dark overlay? 
                    Actually, simplest is to apply z-index 40 to the specific components we want highlighted.
                */}

                {/* NORTH */}
                <div className={`col-start-2 row-start-1 flex justify-center items-start pt-1 ${step.highlight === 'others' || step.highlight === 'opponents' ? 'z-40 relative' : ''}`}>
                    <PlayerHand player={PLAYER_NORTH} position="north" isInteractive={false} showFaces={false} isCurrentTurn={false} />
                    {step.highlight === 'others' && <HighlightLabel text="Opponent" />}
                </div>

                {/* WEST */}
                <div className={`col-start-1 row-start-2 flex items-center justify-center px-1 ${step.highlight === 'others' ? 'z-40 relative' : ''}`}>
                    <PlayerHand player={PLAYER_WEST} position="west" isInteractive={false} showFaces={false} isCurrentTurn={false} />
                </div>

                {/* CENTER (DECK) */}
                <div className={`col-start-2 row-start-2 flex items-center justify-center ${step.highlight === 'deck_area' || step.highlight === 'center' || step.highlight === 'center_card' ? 'z-40 relative' : ''}`}>
                    <div className="flex items-center gap-3 sm:gap-6 relative">
                        {/* DECK */}
                        <div className="relative">
                            <div className="w-16 h-24 sm:w-20 sm:h-30 rounded-xl overflow-hidden shadow-lg border-2 border-emerald-500 shadow-emerald-500/20">
                                <div className="w-full h-full flex items-center justify-center" style={{ background: 'repeating-conic-gradient(#1a1a2e 0% 25%, #16213e 0% 50%) 50% / 16px 16px' }}>
                                    <div className="absolute inset-2 rounded-lg border-2 border-red-500/20" />
                                    <div className="flex flex-col items-center justify-center">
                                        <span className="text-red-600/80 font-black tracking-[0.2em] text-xs sm:text-sm writing-mode-vertical rotate-180" style={{ writingMode: 'vertical-rl' }}>
                                            TUJUH
                                        </span>
                                    </div>
                                </div>
                            </div>
                            {step.highlight === 'deck_area' && !mockDrawnCard && (
                                <motion.div
                                    className="absolute inset-0 border-4 border-yellow-400 rounded-xl"
                                    animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.05, 1] }}
                                    transition={{ repeat: Infinity, duration: 2 }}
                                />
                            )}
                        </div>

                        {/* DRAWN CARD SPOT */}
                        <AnimatePresence>
                            {mockDrawnCard && (
                                <motion.div
                                    initial={{ scale: 0, rotateY: 180 }}
                                    animate={{ scale: 1, rotateY: 0 }}
                                    className="flex flex-col items-center gap-1"
                                >
                                    <CardComponent card={mockDrawnCard} showFace={true} size="md" />
                                    <div className="px-2 py-1 bg-zinc-800 rounded text-[10px] text-zinc-400">Drawn</div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* DISCARD */}
                        <div className="relative">
                            <div className="w-16 h-24 sm:w-20 sm:h-30 rounded-xl overflow-hidden shadow-lg border-2 border-zinc-700/80 bg-zinc-800">
                                <div className="w-full h-full flex items-center justify-center bg-black/40">
                                    <span className="text-zinc-600 text-xs">Empty</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* EAST */}
                <div className={`col-start-3 row-start-2 flex items-center justify-center px-1 ${step.highlight === 'others' ? 'z-40 relative' : ''}`}>
                    <PlayerHand player={PLAYER_EAST} position="east" isInteractive={false} showFaces={false} isCurrentTurn={false} />
                </div>

                {/* SOUTH (YOU) */}
                <div className={`col-start-2 row-start-3 flex justify-center items-end pb-1 ${step.highlight === 'south' || step.highlight === 'south_interactive' ? 'z-40 relative' : ''}`}>
                    <div className="relative">
                        <PlayerHand
                            player={PLAYER_SOUTH}
                            position="south"
                            isInteractive={step.highlight === 'south_interactive'}
                            showFaces={false}
                            isCurrentTurn={false}
                            onCardClick={() => {
                                if (step.action === 'swap') handleNext();
                            }}
                        />
                        {step.highlight === 'south' && <HighlightLabel text="Your Hand (Hidden)" />}
                        {step.highlight === 'south_interactive' && (
                            <motion.div
                                className="absolute -top-12 left-1/2 -translate-x-1/2 bg-yellow-500 text-black font-bold px-3 py-1 rounded-full text-xs shadow-lg whitespace-nowrap"
                                animate={{ y: [0, -5, 0] }}
                                transition={{ repeat: Infinity, duration: 1 }}
                            >
                                Tap a card to Swap!
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>

            {/* POWERS OVERLAY (Special Step) */}
            <AnimatePresence>
                {step.highlight === 'powers' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[45] flex items-center justify-center pointer-events-none"
                    >
                        {/* We use the text box for this, maybe just show some floating icons? */}
                    </motion.div>
                )}
            </AnimatePresence>

        </div >
    );
}

function HighlightLabel({ text }: { text: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-emerald-500 text-black font-bold text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap"
        >
            {text}
        </motion.div>
    );
}
