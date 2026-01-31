'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Bot, User, Copy, Check, ArrowLeft, Play, Wifi, WifiOff } from 'lucide-react';
import { RoomSeat } from '@/types/ws-messages';

interface LobbyProps {
  roomId: string | null;
  seats: RoomSeat[];
  isHost: boolean;
  isConnected: boolean;
  onStartGame: () => void;
  onBack: () => void;
}

const SEAT_LABELS = ['South', 'West', 'North', 'East'];

export default function Lobby({
  roomId,
  seats,
  isHost,
  isConnected,
  onStartGame,
  onBack,
}: LobbyProps) {
  const [copied, setCopied] = useState(false);

  const copyRoomCode = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const humanCount = seats.filter((s) => s.kind === 'human').length;
  const canStart = isHost && humanCount >= 1;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-4">
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-amber-400 to-red-500 mb-2">
          TUJUH
        </h1>
        <p className="text-zinc-400 text-sm">Online Lobby</p>
      </motion.div>

      {/* Connection status */}
      <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border ${isConnected
          ? 'bg-emerald-600/10 border-emerald-600/30 text-emerald-400'
          : 'bg-red-600/10 border-red-600/30 text-red-400'
        }`}>
        {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
        {isConnected ? 'Connected' : 'Disconnected'}
      </div>

      {/* Room code */}
      {roomId && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-2"
        >
          <p className="text-zinc-500 text-xs">Room Code</p>
          <button
            onClick={copyRoomCode}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-colors"
          >
            <span className="text-2xl font-mono font-bold tracking-[0.3em] text-zinc-100">
              {roomId}
            </span>
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4 text-zinc-500" />
            )}
          </button>
          <p className="text-zinc-600 text-[10px]">
            {copied ? 'Copied!' : 'Click to copy'}
          </p>
        </motion.div>
      )}

      {/* Seats */}
      <div className="w-full max-w-sm">
        <p className="text-zinc-500 text-xs text-center mb-3">Players ({humanCount}/4 seats filled)</p>
        <div className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout">
            {(seats.length > 0 ? seats : Array.from({ length: 4 }, () => ({ playerName: null, kind: 'empty' as const, isReady: false }))).map(
              (seat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border ${seat.kind === 'human'
                      ? 'bg-emerald-600/10 border-emerald-600/30'
                      : seat.kind === 'ai'
                        ? 'bg-violet-600/10 border-violet-600/30'
                        : 'bg-zinc-800/50 border-zinc-700/50'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500 text-xs w-10">{SEAT_LABELS[i]}</span>
                    {seat.kind === 'human' ? (
                      <User className="w-4 h-4 text-emerald-400" />
                    ) : seat.kind === 'ai' ? (
                      <Bot className="w-4 h-4 text-violet-400" />
                    ) : (
                      <Users className="w-4 h-4 text-zinc-600" />
                    )}
                    <span
                      className={`text-sm font-medium ${seat.kind === 'human'
                          ? 'text-emerald-300'
                          : seat.kind === 'ai'
                            ? 'text-violet-300'
                            : 'text-zinc-600'
                        }`}
                    >
                      {seat.playerName || (seat.kind === 'ai' ? `AI ${i + 1}` : 'Waiting...')}
                    </span>
                  </div>
                  {seat.isReady && (
                    <span className="text-[10px] text-emerald-400 bg-emerald-600/20 px-2 py-0.5 rounded-full">
                      Ready
                    </span>
                  )}
                </motion.div>
              )
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Info text */}
      <p className="text-zinc-600 text-xs text-center max-w-xs">
        {isHost
          ? 'Share the room code with other players. Empty seats will be filled with AI.'
          : 'Waiting for the host to start the game...'}
      </p>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 py-2.5 px-5 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-400 text-sm hover:bg-zinc-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Leave
        </button>
        {isHost && (
          <button
            onClick={onStartGame}
            disabled={!canStart}
            className={`flex items-center gap-2 py-2.5 px-6 rounded-xl text-sm font-semibold transition-colors ${canStart
                ? 'bg-emerald-600 border border-emerald-500 text-white hover:bg-emerald-500'
                : 'bg-zinc-800 border border-zinc-700 text-zinc-600 cursor-not-allowed'
              }`}
          >
            <Play className="w-4 h-4" />
            Start Game
          </button>
        )}
      </div>
    </div>
  );
}
