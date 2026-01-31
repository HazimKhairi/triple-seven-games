'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users,
    Bot,
    Globe,
    Monitor,
    ArrowLeft,
    Plus,
    Minus,
    Play,
    Info,
    RotateCcw
} from 'lucide-react';
import { Difficulty } from '@/types/game';

interface MainMenuProps {
    onStartLocalGame: (config: { difficulty: Difficulty; humanCount: number; aiNames: string[] }) => void;
    onCreateOnlineRoom: (name: string, difficulty: Difficulty) => void;
    onJoinOnlineRoom: (roomId: string, name: string) => void;
    onStartTutorial: () => void;
    isConnecting: boolean;
    error: string | null;
}

type MenuStep = 'home' | 'mode' | 'difficulty' | 'players' | 'online_setup' | 'rules';

export default function MainMenu({
    onStartLocalGame,
    onCreateOnlineRoom,
    onJoinOnlineRoom,
    onStartTutorial,
    isConnecting,
    error
}: MainMenuProps) {
    const [menuStep, setMenuStep] = useState<MenuStep>('home');
    const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('beginner');
    const [humanCount, setHumanCount] = useState(1);
    const [playerName, setPlayerName] = useState('');
    const [joinRoomId, setJoinRoomId] = useState('');
    const [onlineAction, setOnlineAction] = useState<'create' | 'join'>('create');

    const handleStartLocal = () => {
        const aiNames = ['AI West', 'AI North', 'AI East'];
        onStartLocalGame({
            difficulty: selectedDifficulty,
            humanCount,
            aiNames
        });
    };

    return (
        <div className="relative flex flex-col items-center justify-center min-h-screen w-full overflow-hidden bg-zinc-950 text-zinc-100">
            {/* Background Decor */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/10 rounded-full blur-[100px]" />
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,transparent_0%,#09090b_100%)]" />
            </div>

            <div className="relative z-10 w-full max-w-4xl px-4 flex flex-col items-center">
                {/* Header / Title */}
                <motion.div
                    initial={{ opacity: 0, y: -50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="text-center mb-12"
                >
                    <div className="relative inline-block">
                        <h1 className="text-8xl md:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-zinc-400 to-zinc-600">
                            777
                        </h1>
                        <div className="absolute -top-6 -right-8 rotate-12 bg-amber-500 text-black font-bold text-xs px-2 py-1 rounded shadow-lg border border-amber-400">
                            ZERO IS HERO
                        </div>
                    </div>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="text-2xl md:text-3xl font-light text-zinc-400 mt-2 tracking-wide"
                    >
                        TRIPLE SEVEN
                    </motion.p>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="text-sm md:text-base text-zinc-500 mt-4 max-w-lg mx-auto leading-relaxed"
                    >
                        A high-stakes strategic card game where lowest score wins.
                        <br />
                        Blind Draw • Tactical Powers • Abrupt Endings
                    </motion.p>
                </motion.div>

                {/* Main Content Area */}
                <div className="w-full max-w-md min-h-[300px] flex flex-col items-center">
                    <AnimatePresence mode="wait">

                        {/* HOME SCREEN */}
                        {menuStep === 'home' && (
                            <motion.div
                                key="home"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="flex flex-col gap-4 w-full"
                            >
                                <button
                                    onClick={() => setMenuStep('mode')}
                                    className="group relative w-full py-4 bg-zinc-100 hover:bg-white text-zinc-950 rounded-xl font-bold text-lg shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                                >
                                    <Play className="w-5 h-5 fill-current" />
                                    PLAY NOW
                                </button>

                                <button
                                    onClick={() => setMenuStep('rules')}
                                    className="w-full py-4 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-xl font-semibold transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                                >
                                    <Info className="w-5 h-5" />
                                    HOW TO PLAY
                                </button>

                                <button
                                    onClick={onStartTutorial}
                                    className="w-full py-4 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 text-emerald-400 hover:text-emerald-300 rounded-xl font-semibold transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                                >
                                    <RotateCcw className="w-5 h-5" />
                                    INTERACTIVE TUTORIAL
                                </button>
                            </motion.div>
                        )}

                        {/* RULES SCREEN */}
                        {menuStep === 'rules' && (
                            <motion.div
                                key="rules"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="w-full bg-zinc-900/80 border border-zinc-800 p-6 rounded-2xl backdrop-blur-sm"
                            >
                                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                    <Info className="w-5 h-5 text-amber-500" />
                                    Game Rules
                                </h3>
                                <div className="text-sm text-zinc-400 space-y-3 leading-relaxed h-64 overflow-y-auto pr-2 custom-scrollbar">
                                    <p>
                                        <strong className="text-zinc-200">Objective:</strong> Achieve the lowest score possible. The game ends when the deck runs out.
                                    </p>
                                    <p>
                                        <strong className="text-zinc-200">Scoring:</strong>
                                        <br />• 7 = 0 points (Best)
                                        <br />• A = 1 point
                                        <br />• 2-9 = Face Value
                                        <br />• 10, J, Q, K, Joker = 10 points
                                    </p>
                                    <p>
                                        <strong className="text-zinc-200">Gameplay:</strong> You start with 4 face-down cards. Unknown even to you.
                                        On your turn, draw a card. You can swap it with one of your hidden cards or discard it.
                                    </p>
                                    <p>
                                        <strong className="text-zinc-200">Power Cards (Discard to use):</strong>
                                        <br />• 10: <span className="text-violet-400">Unlock</span> an opponent's card
                                        <br />• J: <span className="text-violet-400">Swap</span> a card with opponent
                                        <br />• Q: <span className="text-violet-400">Peek</span> at a card
                                        <br />• K: <span className="text-red-400">Lock</span> an opponent's card
                                        <br />• Joker: <span className="text-amber-400">Mass Swap</span> (Left or Right)
                                    </p>
                                </div>
                                <button
                                    onClick={() => setMenuStep('home')}
                                    className="mt-6 w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors"
                                >
                                    Back to Menu
                                </button>
                            </motion.div>
                        )}

                        {/* MODE SELECTION */}
                        {menuStep === 'mode' && (
                            <motion.div
                                key="mode"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex flex-col gap-4 w-full"
                            >
                                <h2 className="text-center text-zinc-400 mb-2 font-medium">Select Game Mode</h2>
                                <button
                                    onClick={() => setMenuStep('difficulty')}
                                    className="flex items-center justify-between p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-emerald-500/50 group transition-all"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-black transition-colors">
                                            <Monitor className="w-6 h-6" />
                                        </div>
                                        <div className="text-left">
                                            <div className="font-bold text-white group-hover:text-emerald-400 transition-colors">Local Play</div>
                                            <div className="text-xs text-zinc-500">Play against AI bots</div>
                                        </div>
                                    </div>
                                    <ArrowLeft className="w-5 h-5 text-zinc-600 rotate-180" />
                                </button>

                                <button
                                    onClick={() => setMenuStep('online_setup')}
                                    className="flex items-center justify-between p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-violet-500/50 group transition-all"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-lg bg-violet-500/10 text-violet-500 group-hover:bg-violet-500 group-hover:text-black transition-colors">
                                            <Globe className="w-6 h-6" />
                                        </div>
                                        <div className="text-left">
                                            <div className="font-bold text-white group-hover:text-violet-400 transition-colors">Online Multiplayer</div>
                                            <div className="text-xs text-zinc-500">Play with friends globally</div>
                                        </div>
                                    </div>
                                    <ArrowLeft className="w-5 h-5 text-zinc-600 rotate-180" />
                                </button>

                                <button
                                    onClick={() => setMenuStep('home')}
                                    className="mt-4 text-zinc-500 hover:text-white text-sm py-2"
                                >
                                    Cancel
                                </button>
                            </motion.div>
                        )}

                        {/* DIFFICULTY SELECTION (Local) */}
                        {menuStep === 'difficulty' && (
                            <motion.div
                                key="difficulty"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex flex-col gap-3 w-full"
                            >
                                <div className="flex items-center gap-2 mb-4">
                                    <button onClick={() => setMenuStep('mode')} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400">
                                        <ArrowLeft className="w-5 h-5" />
                                    </button>
                                    <h2 className="text-lg font-bold text-white">Select Difficulty</h2>
                                </div>

                                {(['beginner', 'intermediate', 'hardcore'] as const).map((diff) => (
                                    <button
                                        key={diff}
                                        onClick={() => { setSelectedDifficulty(diff); setMenuStep('players'); }}
                                        className={`relative overflow-hidden w-full p-4 rounded-xl border text-left transition-all ${diff === 'beginner'
                                            ? 'bg-emerald-950/20 border-emerald-900/50 hover:border-emerald-500 text-emerald-100'
                                            : diff === 'intermediate'
                                                ? 'bg-amber-950/20 border-amber-900/50 hover:border-amber-500 text-amber-100'
                                                : 'bg-red-950/20 border-red-900/50 hover:border-red-500 text-red-100'
                                            }`}
                                    >
                                        <div className="font-bold text-lg capitalize mb-1">{diff}</div>
                                        <div className="text-xs opacity-70">
                                            {diff === 'beginner' && "Standard AI. Good for learning."}
                                            {diff === 'intermediate' && "Smarter AI. Uses power cards effectively."}
                                            {diff === 'hardcore' && "Ruthless AI. Remembers everything."}
                                        </div>
                                    </button>
                                ))}
                            </motion.div>
                        )}

                        {/* PLAYER COUNT (Local) */}
                        {menuStep === 'players' && (
                            <motion.div
                                key="players"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex flex-col gap-6 w-full"
                            >
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setMenuStep('difficulty')} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400">
                                        <ArrowLeft className="w-5 h-5" />
                                    </button>
                                    <h2 className="text-lg font-bold text-white">Setup Players</h2>
                                </div>

                                <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 flex flex-col items-center gap-6">
                                    <span className="text-zinc-400 text-sm uppercase tracking-wider font-medium">Single Player</span>

                                    <div className="flex items-center gap-4 py-2">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center">
                                                <Users className="w-8 h-8 text-emerald-400" />
                                            </div>
                                            <span className="text-xs font-bold text-emerald-400">YOU</span>
                                        </div>
                                        <div className="h-px w-12 bg-zinc-700" />
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-16 h-16 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center">
                                                <Bot className="w-8 h-8 text-zinc-500" />
                                            </div>
                                            <span className="text-xs font-bold text-zinc-500">3 BOTS</span>
                                        </div>
                                    </div>

                                    <p className="text-zinc-500 text-xs text-center max-w-xs">
                                        You are playing against 3 AI opponents. Good luck!
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <button
                                        onClick={handleStartLocal}
                                        className="w-full py-4 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold text-lg shadow-lg shadow-white/10 transition-colors"
                                    >
                                        Start Game
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* ONLINE SETUP */}
                        {menuStep === 'online_setup' && (
                            <motion.div
                                key="online"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex flex-col gap-6 w-full"
                            >
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setMenuStep('mode')} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400">
                                        <ArrowLeft className="w-5 h-5" />
                                    </button>
                                    <h2 className="text-lg font-bold text-white">Online Lobby</h2>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-2 block ml-1">Your Name</label>
                                        <input
                                            type="text"
                                            value={playerName}
                                            onChange={(e) => setPlayerName(e.target.value)}
                                            placeholder="Enter nickname..."
                                            maxLength={12}
                                            className="w-full px-5 py-4 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 p-1 bg-zinc-900 rounded-xl border border-zinc-800">
                                        <button
                                            onClick={() => setOnlineAction('create')}
                                            className={`py-3 rounded-lg text-sm font-bold transition-all ${onlineAction === 'create'
                                                ? 'bg-zinc-800 text-white shadow-sm'
                                                : 'text-zinc-500 hover:text-zinc-300'
                                                }`}
                                        >
                                            Create Room
                                        </button>
                                        <button
                                            onClick={() => setOnlineAction('join')}
                                            className={`py-3 rounded-lg text-sm font-bold transition-all ${onlineAction === 'join'
                                                ? 'bg-zinc-800 text-white shadow-sm'
                                                : 'text-zinc-500 hover:text-zinc-300'
                                                }`}
                                        >
                                            Join Room
                                        </button>
                                    </div>

                                    {onlineAction === 'create' ? (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                            <div className="space-y-2">
                                                <label className="text-zinc-500 text-xs font-semibold uppercase tracking-wider block ml-1">Bot Difficulty</label>
                                                <div className="flex gap-2">
                                                    {(['beginner', 'intermediate', 'hardcore'] as const).map((diff) => (
                                                        <button
                                                            key={diff}
                                                            onClick={() => setSelectedDifficulty(diff)}
                                                            className={`flex-1 py-3 rounded-lg text-xs font-bold border transition-colors ${selectedDifficulty === diff
                                                                ? diff === 'beginner'
                                                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                                                    : diff === 'intermediate'
                                                                        ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                                                                        : 'bg-red-500/20 border-red-500 text-red-400'
                                                                : 'bg-zinc-900 border-zinc-800 text-zinc-600 hover:bg-zinc-800'
                                                                }`}
                                                        >
                                                            {diff}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => onCreateOnlineRoom(playerName, selectedDifficulty)}
                                                disabled={isConnecting || !playerName.trim()}
                                                className="w-full py-4 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold shadow-lg shadow-violet-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                                            >
                                                {isConnecting ? 'Connecting...' : 'Create & Host'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                            <div>
                                                <label className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-2 block ml-1">Room Code</label>
                                                <input
                                                    type="text"
                                                    value={joinRoomId}
                                                    onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                                                    placeholder="CODE"
                                                    maxLength={6}
                                                    className="w-full px-5 py-4 text-center text-2xl font-mono tracking-[0.3em] rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-700 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                                                />
                                            </div>
                                            <button
                                                onClick={() => onJoinOnlineRoom(joinRoomId, playerName)}
                                                disabled={isConnecting || !playerName.trim() || !joinRoomId.trim()}
                                                className="w-full py-4 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold shadow-lg shadow-violet-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isConnecting ? 'Connecting...' : 'Join Lobby'}
                                            </button>
                                        </div>
                                    )}

                                    {error && (
                                        <p className="text-red-400 text-sm text-center bg-red-950/30 py-2 rounded-lg border border-red-900/50">
                                            {error}
                                        </p>
                                    )}
                                </div>
                            </motion.div>
                        )}

                    </AnimatePresence>
                </div>
            </div>

            {/* Footer Branding */}
            <div className="absolute bottom-6 text-zinc-600 text-xs tracking-widest font-mono uppercase">
                Triple Seven v1.0
            </div>
        </div>
    );
}
