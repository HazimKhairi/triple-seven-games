'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '@/store/game-store';
import { ServerMessage, ClientMessage, ClientGameView, RoomSeat } from '@/types/ws-messages';
import { Card, PlayerInfo, GamePhase } from '@/types/game';

export interface MultiplayerState {
  isConnected: boolean;
  isConnecting: boolean;
  roomId: string | null;
  localSeat: number | null;
  seats: RoomSeat[];
  error: string | null;
}

export function useMultiplayer() {
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<MultiplayerState>({
    isConnected: false,
    isConnecting: false,
    roomId: null,
    localSeat: null,
    seats: [],
    error: null,
  });

  const store = useGameStore;

  // Connect to socket server
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    setState((s) => ({ ...s, isConnecting: true, error: null }));

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
    const socket = io(wsUrl, {
      path: '/api/socket',
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setState((s) => ({ ...s, isConnected: true, isConnecting: false }));
    });

    socket.on('disconnect', () => {
      setState((s) => ({ ...s, isConnected: false }));
    });

    socket.on('connect_error', () => {
      setState((s) => ({
        ...s,
        isConnected: false,
        isConnecting: false,
        error: 'Failed to connect to server',
      }));
    });

    socket.on('message', (msg: ServerMessage) => {
      handleServerMessage(msg);
    });

    socketRef.current = socket;
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setState({
      isConnected: false,
      isConnecting: false,
      roomId: null,
      localSeat: null,
      seats: [],
      error: null,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Send message helper
  const send = useCallback((msg: ClientMessage) => {
    socketRef.current?.emit('message', msg);
  }, []);

  // Handle server messages
  const handleServerMessage = useCallback((msg: ServerMessage) => {
    const addToast = store.getState().addToast;

    switch (msg.type) {
      case 'room_created': {
        setState((s) => ({
          ...s,
          roomId: msg.roomId,
          localSeat: msg.seat,
        }));
        break;
      }
      case 'player_joined': {
        setState((s) => ({ ...s, seats: msg.seats }));
        addToast(`${msg.playerName} joined!`, 'info');
        break;
      }
      case 'player_left': {
        setState((s) => ({ ...s, seats: msg.seats }));
        addToast('A player disconnected', 'warning');
        break;
      }
      case 'game_started':
      case 'state_update': {
        applyServerState(msg.state);
        break;
      }
      case 'game_over': {
        applyServerState(msg.state);
        break;
      }
      case 'toast': {
        addToast(msg.message, msg.toastType);
        break;
      }
      case 'error': {
        setState((s) => ({ ...s, error: msg.message }));
        addToast(msg.message, 'warning');
        break;
      }
    }
  }, []);

  // Apply server state to local store
  const applyServerState = useCallback((view: ClientGameView) => {
    const players: PlayerInfo[] = view.players.map((pv) => ({
      id: `seat-${pv.seatIndex}`,
      seatIndex: pv.seatIndex,
      kind: pv.kind,
      name: pv.name,
      hand: pv.hand.map((card, i) =>
        card !== null
          ? card
          : {
              // Hidden card placeholder
              id: `hidden-${pv.seatIndex}-${i}`,
              suit: null,
              rank: null,
              isJoker: false,
              isFaceUp: false,
              isLocked: false,
              isSelected: false,
              isPeeking: false,
            } as Card
      ),
      score: pv.score,
      isLocal: pv.isLocal,
    }));

    store.setState({
      phase: view.phase as GamePhase,
      players,
      currentTurnSeat: view.currentTurnSeat,
      localPlayerSeat: view.localSeat,
      deck: Array(view.deckCount).fill(null) as Card[], // placeholder for deck count
      discardPile: view.discardPile,
      drawnCard: view.drawnCard,
      activePower: view.activePower,
      powerSourceSeat: view.powerSourceSeat,
      turnCount: view.turnCount,
      winnerSeat: view.winnerSeat,
      isOnline: true,
    });
  }, []);

  // Public actions
  const createRoom = useCallback(
    (playerName: string, difficulty: 'beginner' | 'intermediate' | 'hardcore') => {
      connect();
      // Wait for connection then send
      const checkAndSend = () => {
        if (socketRef.current?.connected) {
          send({ type: 'create_room', playerName, difficulty });
          store.setState({ phase: 'lobby', isOnline: true });
        } else {
          setTimeout(checkAndSend, 100);
        }
      };
      checkAndSend();
    },
    [connect, send]
  );

  const joinRoom = useCallback(
    (roomId: string, playerName: string) => {
      connect();
      const checkAndSend = () => {
        if (socketRef.current?.connected) {
          send({ type: 'join_room', roomId, playerName });
          store.setState({ phase: 'lobby', isOnline: true });
        } else {
          setTimeout(checkAndSend, 100);
        }
      };
      checkAndSend();
    },
    [connect, send]
  );

  const startGame = useCallback(() => {
    send({ type: 'start_game' });
  }, [send]);

  const sendAction = useCallback(
    (action: ClientMessage) => {
      send(action);
    },
    [send]
  );

  return {
    ...state,
    createRoom,
    joinRoom,
    startGame,
    sendAction,
    disconnect,
  };
}
