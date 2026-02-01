'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users,
    Bot,
    Globe,
    Monitor,
    ArrowLeft,
    Play,
    Info,
    RotateCcw,
    Settings,
    Volume2,
    Volume1,
    VolumeX
} from 'lucide-react';
import { Difficulty } from '@/types/game';
import { useGameStore } from '@/store/game-store';

interface MainMenuProps {
    onStartLocalGame: (config: { difficulty: Difficulty; humanCount: number; aiNames: string[] }) => void;
    onCreateOnlineRoom: (name: string, difficulty: Difficulty) => void;
    onJoinOnlineRoom: (roomId: string, name: string) => void;
    onStartTutorial: () => void;
    isConnecting: boolean;
    error: string | null;
}

type MenuStep = 'splash' | 'home' | 'mode' | 'difficulty' | 'players' | 'online_setup' | 'rules' | 'settings';

export default function MainMenu({
    onStartLocalGame,
    onCreateOnlineRoom,
    onJoinOnlineRoom,
    onStartTutorial,
    isConnecting,
    error
}: MainMenuProps) {
    const { masterVolume, musicVolume, setVolume } = useGameStore();

    // Local state for immediate slider feedback, though we sync with store
    const [menuStep, setMenuStep] = useState<MenuStep>('splash');
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

    // Initialize Audio
    useEffect(() => {
        const audio = new Audio('/bgm.mp3');
        audio.loop = true;
        (window as any).__menuAudio = audio;

        return () => {
            audio.pause();
            audio.currentTime = 0;
            delete (window as any).__menuAudio;
        };
    }, []);

    // Handle "Click to Start"
    const handleSplashClick = () => {
        const audio = (window as any).__menuAudio as HTMLAudioElement;
        if (audio) {
            audio.volume = masterVolume * musicVolume;
            audio.play().catch(e => console.log("Audio play failed:", e));
        }
        setMenuStep('home');
    };

    // Volume update effect
    useEffect(() => {
        const audio = (window as any).__menuAudio as HTMLAudioElement;
        if (audio) {
            audio.volume = Math.max(0, Math.min(1, masterVolume * musicVolume));
        }
    }, [masterVolume, musicVolume]);


    // Portal 2 Style Menu Item
    const MenuItem = ({ onClick, children, className = "" }: { onClick: () => void, children: React.ReactNode, className?: string }) => (
        <button
            onClick={onClick}
            className={`text-left text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-zinc-300 hover:text-white uppercase transition-all duration-200 hover:pl-4 hover:tracking-wide active:text-amber-400 group ${className}`}
        >
            <span className="inline-block group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">{children}</span>
        </button>
    );

    // Settings Slider
    const VolumeSlider = ({ label, value, onChange }: { label: string, value: number, onChange: (val: number) => void }) => (
        <div className="w-full max-w-sm mb-6">
            <div className="flex justify-between mb-2">
                <span className="text-zinc-400 font-bold tracking-wider uppercase text-sm">{label}</span>
                <span className="text-amber-500 font-mono text-sm">{(value * 100).toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-4">
                <button onClick={() => onChange(0)} className="text-zinc-500 hover:text-white">
                    {value === 0 ? <VolumeX className="w-5 h-5" /> : <Volume1 className="w-5 h-5" />}
                </button>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400"
                />
                <Volume2 className="w-5 h-5 text-zinc-500" />
            </div>
        </div>
    );

    return (
        <div className="relative flex min-h-screen w-full overflow-hidden bg-black text-white font-sans selection:bg-amber-500/30">
            {/* Background Image */}
            <div className="absolute inset-0 z-0">
                <img
                    src="/tujuh_portal_bg.png"
                    alt="Background"
                    className="w-full h-full object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
            </div>

            {/* Left Content Container */}
            <div className="relative z-10 flex flex-col justify-center h-full px-6 md:px-24 w-full md:max-w-3xl overflow-y-auto md:overflow-hidden pb-10 md:pb-0">

                {/* Logo Area */}
                <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="mb-12"
                >
                    <h1 className="text-6xl md:text-9xl font-black tracking-tighter text-white drop-shadow-2xl">
                        TUJUH
                    </h1>
                    <div className="flex items-center gap-4 mt-2 ml-2">
                        <div className="h-[2px] w-12 bg-amber-500" />
                        <span className="text-xl tracking-[0.2em] font-light text-zinc-300 uppercase">Card Game</span>
                    </div>
                </motion.div>

                {/* Animated Menu Panel */}
                <div className="min-h-[400px] md:min-h-[400px] flex flex-col">
                    <AnimatePresence mode="wait">

                        {/* SPLASH SCREEN */}
                        {menuStep === 'splash' && (
                            <motion.div
                                key="splash"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-start gap-8 mt-12 cursor-pointer"
                                onClick={handleSplashClick}
                            >
                                <motion.div
                                    animate={{ opacity: [0.4, 1, 0.4] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="text-2xl md:text-3xl font-bold tracking-[0.3em] text-white hover:text-amber-400 transition-colors uppercase"
                                >
                                    [ Click to Start ]
                                </motion.div>
                            </motion.div>
                        )}

                        {/* MAIN MENU */}
                        {menuStep === 'home' && (
                            <motion.div
                                key="home"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                                className="flex flex-col items-start gap-6"
                            >
                                <MenuItem onClick={() => setMenuStep('mode')}>Play Game</MenuItem>
                                <MenuItem onClick={onStartTutorial}>Tutorial</MenuItem>
                                <MenuItem onClick={() => setMenuStep('settings')}>Settings</MenuItem>
                                <MenuItem onClick={() => setMenuStep('rules')}>Rules</MenuItem>
                            </motion.div>
                        )}

                        {/* SETTINGS */}
                        {menuStep === 'settings' && (
                            <motion.div
                                key="settings"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                                className="flex flex-col items-start gap-2 w-full"
                            >
                                <div className="text-amber-500 text-sm font-bold tracking-widest uppercase mb-6">Audio Settings</div>

                                <VolumeSlider
                                    label="Master Volume"
                                    value={masterVolume}
                                    onChange={(v) => setVolume('master', v)}
                                />

                                <VolumeSlider
                                    label="Music Volume"
                                    value={musicVolume}
                                    onChange={(v) => setVolume('music', v)}
                                />

                                <div className="h-px w-24 bg-zinc-700 my-4" />
                                <MenuItem onClick={() => setMenuStep('home')} className="text-zinc-500 hover:text-zinc-300 !text-xl">Back</MenuItem>
                            </motion.div>
                        )}

                        {/* MODE SELECTION */}
                        {menuStep === 'mode' && (
                            <motion.div
                                key="mode"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                                className="flex flex-col items-start gap-6"
                            >
                                <div className="text-amber-500 text-sm font-bold tracking-widest uppercase mb-2">Select Mode</div>
                                <MenuItem onClick={() => setMenuStep('difficulty')}>Single Player</MenuItem>
                                <MenuItem onClick={() => setMenuStep('online_setup')}>Online Multiplayer</MenuItem>
                                <div className="h-px w-24 bg-zinc-700 my-2" />
                                <MenuItem onClick={() => setMenuStep('home')} className="text-zinc-500 hover:text-zinc-300 !text-xl">Back</MenuItem>
                            </motion.div>
                        )}

                        {/* DIFFICULTY SELECTION */}
                        {menuStep === 'difficulty' && (
                            <motion.div
                                key="difficulty"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                                className="flex flex-col items-start gap-6"
                            >
                                <div className="text-amber-500 text-sm font-bold tracking-widest uppercase mb-2">Select Difficulty</div>
                                <MenuItem onClick={() => { setSelectedDifficulty('beginner'); setMenuStep('players'); }}>Beginner</MenuItem>
                                <MenuItem onClick={() => { setSelectedDifficulty('intermediate'); setMenuStep('players'); }}>Intermediate</MenuItem>
                                <MenuItem onClick={() => { setSelectedDifficulty('hardcore'); setMenuStep('players'); }}>Hardcore</MenuItem>
                                <div className="h-px w-24 bg-zinc-700 my-2" />
                                <MenuItem onClick={() => setMenuStep('mode')} className="text-zinc-500 hover:text-zinc-300 !text-xl">Back</MenuItem>
                            </motion.div>
                        )}

                        {/* PLAYERS CONFIRMATION */}
                        {menuStep === 'players' && (
                            <motion.div
                                key="players"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                                className="flex flex-col items-start gap-8"
                            >
                                <div className="text-amber-500 text-sm font-bold tracking-widest uppercase mb-2">Confirm Setup</div>
                                <div className="bg-white/5 border-l-4 border-amber-500 p-6 max-w-md backdrop-blur-sm">
                                    <p className="text-zinc-300 text-lg">
                                        Starting a <span className="text-white font-bold capitalize">{selectedDifficulty}</span> game against 3 AI opponents.
                                    </p>
                                </div>

                                <MenuItem onClick={handleStartLocal} className="!text-amber-400 hover:!text-amber-300">Start Match</MenuItem>
                                <MenuItem onClick={() => setMenuStep('difficulty')} className="text-zinc-500 hover:text-zinc-300 !text-xl">Back</MenuItem>
                            </motion.div>
                        )}

                        {/* ONLINE */}
                        {menuStep === 'online_setup' && (
                            <motion.div
                                key="online"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                                className="flex flex-col gap-6 w-full max-w-md"
                            >
                                <div className="text-amber-500 text-sm font-bold tracking-widest uppercase mb-2">Online Lobby</div>

                                <div className="space-y-4 bg-black/40 p-6 border border-zinc-800 backdrop-blur-md">
                                    <input
                                        type="text"
                                        placeholder="YOUR NAME"
                                        value={playerName}
                                        onChange={(e) => setPlayerName(e.target.value)}
                                        className="w-full bg-transparent border-b border-zinc-500 py-2 text-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors font-bold uppercase"
                                    />

                                    <div className="flex gap-4 pt-4">
                                        <button
                                            onClick={() => setOnlineAction('create')}
                                            className={`flex-1 py-2 text-sm font-bold uppercase tracking-wider border transition-all ${onlineAction === 'create' ? 'border-amber-500 text-amber-500 bg-amber-500/10' : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'}`}
                                        >
                                            Create
                                        </button>
                                        <button
                                            onClick={() => setOnlineAction('join')}
                                            className={`flex-1 py-2 text-sm font-bold uppercase tracking-wider border transition-all ${onlineAction === 'join' ? 'border-amber-500 text-amber-500 bg-amber-500/10' : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'}`}
                                        >
                                            Join
                                        </button>
                                    </div>

                                    {onlineAction === 'join' && (
                                        <input
                                            type="text"
                                            placeholder="ROOM CODE"
                                            value={joinRoomId}
                                            onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                                            className="w-full bg-transparent border-b border-zinc-500 py-2 text-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors font-bold uppercase tracking-widest"
                                        />
                                    )}

                                    <button
                                        onClick={() => onlineAction === 'create' ? onCreateOnlineRoom(playerName, 'beginner') : onJoinOnlineRoom(joinRoomId, playerName)}
                                        disabled={isConnecting || !playerName}
                                        className="w-full mt-4 py-4 bg-white text-black font-black uppercase tracking-widest hover:bg-amber-400 transition-colors disabled:opacity-50"
                                    >
                                        {isConnecting ? 'Connecting...' : (onlineAction === 'create' ? 'Launch Server' : 'Connect')}
                                    </button>
                                    {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
                                </div>

                                <MenuItem onClick={() => setMenuStep('mode')} className="text-zinc-500 hover:text-zinc-300 !text-xl">Back</MenuItem>
                            </motion.div>
                        )}

                        {/* RULES */}
                        {menuStep === 'rules' && (
                            <motion.div
                                key="rules"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                                className="flex flex-col items-start gap-4 max-w-lg"
                            >
                                <div className="text-amber-500 text-sm font-bold tracking-widest uppercase mb-2">How To Play</div>
                                <div className="text-zinc-300 space-y-4 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
                                    <p>Your goal is to get the <strong className="text-white">LOWEST SCORE</strong>. <br /> 7 is 0 points (Best).</p>
                                    <p>Draw cards, swap them with your hidden hand, or discard them.</p>
                                    <ul className="list-disc pl-5 space-y-2 text-sm text-zinc-400">
                                        <li><strong className="text-white">10</strong>: Unlock a card</li>
                                        <li><strong className="text-white">J</strong>: Swap with opponent</li>
                                        <li><strong className="text-white">Q</strong>: Peek at a card</li>
                                        <li><strong className="text-white">K</strong>: Lock a card</li>
                                    </ul>
                                </div>
                                <MenuItem onClick={() => setMenuStep('home')} className="text-zinc-500 hover:text-zinc-300 !text-xl mt-4">Back</MenuItem>
                            </motion.div>
                        )}

                    </AnimatePresence>
                </div>

            </div>

            {/* Footer */}
            <div className="absolute bottom-8 left-8 md:left-24 text-zinc-600 text-xs font-mono">
                TUJUH // SYSTEM VERSION 1.0 // ONLINE
            </div>
        </div>
    );
}
