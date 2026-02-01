/**
 * Game room management. Handles room lifecycle:
 * create, join, start, play, finish.
 */
import { nanoid } from 'nanoid';
import { Socket } from 'socket.io';
import { Difficulty, getNextSeat } from '@/types/game';
import { ClientGameView, ClientPlayerView, RoomSeat } from '@/types/ws-messages';
import {
  ServerGameState,
  GameEvent,
  EngineResult,
  createInitialState,
  processDrawFromDeck,
  processDrawFromDiscard,
  processSwapWithHand,
  processDiscardDrawn,
  processPowerTarget,
  executeAITurnServer,
} from './game-engine';

interface RoomPlayer {
  socket: Socket;
  name: string;
  seat: number;
}

const TURN_TIMER_SECONDS = 15;

export class GameRoom {
  id: string;
  hostSocket: string;
  difficulty: Difficulty;
  players: Map<string, RoomPlayer>; // socketId -> RoomPlayer
  seats: Array<{ socketId: string | null; name: string | null; kind: 'human' | 'ai' | 'empty' }>;
  gameState: ServerGameState | null = null;
  aiTurnTimeout: ReturnType<typeof setTimeout> | null = null;
  peekTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  turnTimerInterval: ReturnType<typeof setInterval> | null = null;
  turnTimerTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(hostSocket: Socket, hostName: string, difficulty: Difficulty) {
    this.id = nanoid(6).toUpperCase();
    this.hostSocket = hostSocket.id;
    this.difficulty = difficulty;
    this.players = new Map();
    this.seats = Array.from({ length: 4 }, () => ({
      socketId: null,
      name: null,
      kind: 'empty' as const,
    }));

    // Host takes seat 0
    this.seats[0] = { socketId: hostSocket.id, name: hostName, kind: 'human' };
    this.players.set(hostSocket.id, { socket: hostSocket, name: hostName, seat: 0 });
  }

  getSeatList(): RoomSeat[] {
    return this.seats.map((s) => ({
      playerName: s.name,
      kind: s.kind,
      isReady: s.kind !== 'empty',
    }));
  }

  join(socket: Socket, playerName: string): { seat: number; seats: RoomSeat[] } | null {
    if (this.gameState) return null; // game already started

    // Find first empty seat
    const emptySeat = this.seats.findIndex((s) => s.kind === 'empty');
    if (emptySeat === -1) return null; // room full

    this.seats[emptySeat] = { socketId: socket.id, name: playerName, kind: 'human' };
    this.players.set(socket.id, { socket, name: playerName, seat: emptySeat });

    return { seat: emptySeat, seats: this.getSeatList() };
  }

  removePlayer(socketId: string): RoomSeat[] | null {
    const player = this.players.get(socketId);
    if (!player) return null;

    if (this.gameState) {
      // Game in progress: replace with AI
      this.seats[player.seat] = {
        socketId: null,
        name: `AI ${player.seat + 1}`,
        kind: 'ai',
      };
      this.gameState.players[player.seat].kind = 'ai';
      this.gameState.players[player.seat].name = `AI ${player.seat + 1}`;

      // If it was this player's turn, execute AI turn
      if (this.gameState.currentTurnSeat === player.seat && this.gameState.phase === 'turn_draw') {
        this.scheduleAITurn();
      }
    } else {
      this.seats[player.seat] = { socketId: null, name: null, kind: 'empty' };
    }

    this.players.delete(socketId);
    return this.getSeatList();
  }

  isHost(socketId: string): boolean {
    return this.hostSocket === socketId;
  }

  canStart(): boolean {
    // At least one human player
    return this.seats.some((s) => s.kind === 'human');
  }

  startGame(): void {
    // Fill empty seats with AI
    this.seats.forEach((s, i) => {
      if (s.kind === 'empty') {
        this.seats[i] = { socketId: null, name: `AI ${i + 1}`, kind: 'ai' };
      }
    });

    const seatConfigs = this.seats.map((s, i) => ({
      kind: s.kind as 'human' | 'ai',
      name: s.name || `AI ${i + 1}`,
      socketId: s.socketId || undefined,
    }));

    this.gameState = createInitialState(seatConfigs, this.difficulty);

    // Broadcast initial state to each player
    this.broadcastState();

    // If first seat is AI, start AI turn; else start timer for human
    if (this.gameState.players[0].kind === 'ai') {
      this.scheduleAITurn();
    } else {
      this.startTurnTimer();
    }
  }

  processAction(socketId: string, action: string, payload: Record<string, unknown> = {}): void {
    if (!this.gameState || this.gameState.phase === 'game_over') return;

    const player = this.players.get(socketId);
    if (!player) return;

    const seat = player.seat;
    let result: EngineResult;

    switch (action) {
      case 'draw_from_deck':
        result = processDrawFromDeck(this.gameState, seat);
        break;
      case 'draw_from_discard':
        result = processDrawFromDiscard(this.gameState, seat);
        break;
      case 'swap_with_hand':
        result = processSwapWithHand(this.gameState, seat, payload.handIndex as number);
        break;
      case 'discard_drawn':
        result = processDiscardDrawn(this.gameState, seat);
        break;
      case 'select_power_target':
        result = processPowerTarget(
          this.gameState,
          seat,
          payload.targetSeat as number,
          payload.targetIndex as number
        );
        break;
      default:
        return;
    }

    this.gameState = result.state;
    this.broadcastEvents(result.events);
    this.broadcastState();

    // Handle peek timeout
    if (action === 'select_power_target' && payload.targetSeat !== undefined) {
      this.handlePeekTimeout(payload.targetSeat as number, payload.targetIndex as number);
    }

    // Restart timer / check for AI turn
    this.checkForAITurn();
  }

  private handlePeekTimeout(targetSeat: number, targetIndex: number): void {
    if (!this.gameState) return;
    const card = this.gameState.players[targetSeat]?.hand[targetIndex];
    if (card?.isPeeking) {
      const key = `${targetSeat}-${targetIndex}`;
      if (this.peekTimeouts.has(key)) {
        clearTimeout(this.peekTimeouts.get(key)!);
      }
      this.peekTimeouts.set(
        key,
        setTimeout(() => {
          if (!this.gameState) return;
          const p = this.gameState.players[targetSeat];
          if (p && p.hand[targetIndex]?.isPeeking) {
            p.hand[targetIndex] = { ...p.hand[targetIndex], isPeeking: false };
            this.broadcastState();
          }
          this.peekTimeouts.delete(key);
        }, 3000)
      );
    }
  }

  private checkForAITurn(): void {
    if (!this.gameState || this.gameState.phase === 'game_over') {
      this.clearTurnTimer();
      return;
    }
    const current = this.gameState.players[this.gameState.currentTurnSeat];
    if (current.kind === 'ai' && this.gameState.phase === 'turn_draw') {
      this.clearTurnTimer();
      this.scheduleAITurn();
    } else if (current.kind === 'human') {
      this.startTurnTimer();
    }
  }

  private scheduleAITurn(): void {
    if (this.aiTurnTimeout) clearTimeout(this.aiTurnTimeout);
    this.aiTurnTimeout = setTimeout(() => {
      this.executeAILoop();
    }, 1200);
  }

  private executeAILoop(): void {
    if (!this.gameState || this.gameState.phase === 'game_over') return;
    const current = this.gameState.players[this.gameState.currentTurnSeat];
    if (current.kind !== 'ai') {
      this.broadcastState();
      return;
    }

    const result = executeAITurnServer(this.gameState);
    this.gameState = result.state;
    this.broadcastEvents(result.events);
    this.broadcastState();

    // Check if next is also AI
    if (this.gameState.phase !== 'game_over') {
      const next = this.gameState.players[this.gameState.currentTurnSeat];
      if (next.kind === 'ai' && this.gameState.phase === 'turn_draw') {
        this.scheduleAITurn();
      }
    }
  }

  private startTurnTimer(): void {
    this.clearTurnTimer();
    if (!this.gameState || this.gameState.phase === 'game_over') return;

    this.turnTimerTimeout = setTimeout(() => {
      this.onTurnTimerExpired();
    }, TURN_TIMER_SECONDS * 1000);
  }

  private clearTurnTimer(): void {
    if (this.turnTimerTimeout) {
      clearTimeout(this.turnTimerTimeout);
      this.turnTimerTimeout = null;
    }
  }

  private onTurnTimerExpired(): void {
    if (!this.gameState || this.gameState.phase === 'game_over') return;
    const seat = this.gameState.currentTurnSeat;
    const current = this.gameState.players[seat];
    if (current.kind !== 'human') return;

    // Auto-act based on phase
    if (this.gameState.phase === 'turn_draw') {
      // Auto draw from deck then discard
      let result = processDrawFromDeck(this.gameState, seat);
      this.gameState = result.state;
      this.broadcastEvents(result.events);
      // Then auto-discard
      result = processDiscardDrawn(this.gameState, seat);
      this.gameState = result.state;
      this.broadcastEvents(result.events);
    } else if (this.gameState.phase === 'turn_decision' && this.gameState.drawnCard) {
      const result = processDiscardDrawn(this.gameState, seat);
      this.gameState = result.state;
      this.broadcastEvents(result.events);
    } else if (this.gameState.phase === 'power_target') {
      // Skip power
      this.gameState.activePower = null;
      this.gameState.powerSourceSeat = null;
      this.gameState.swapSource = null;
      // Advance turn manually
      const nextSeat = getNextSeat(seat);
      this.gameState.currentTurnSeat = nextSeat;
      this.gameState.phase = 'turn_draw';
      if (nextSeat === 0) this.gameState.turnCount++;
    }

    // Broadcast toast and state
    for (const [, player] of this.players) {
      player.socket.emit('message', {
        type: 'toast',
        message: `${current.name}'s time ran out! Auto-playing...`,
        toastType: 'warning',
      });
    }
    this.broadcastState();
    this.checkForAITurn();
  }

  private broadcastState(): void {
    if (!this.gameState) return;

    for (const [socketId, player] of this.players) {
      const view = this.buildClientView(player.seat);
      const msgType = this.gameState.phase === 'game_over' ? 'game_over' : 'state_update';
      player.socket.emit('message', { type: msgType, state: view });
    }
  }

  private broadcastEvents(events: GameEvent[]): void {
    for (const event of events) {
      for (const [, player] of this.players) {
        player.socket.emit('message', {
          type: 'toast',
          message: event.message,
          toastType: event.toastType,
        });
      }
    }
  }

  buildClientView(forSeat: number): ClientGameView {
    const gs = this.gameState!;
    const players: ClientPlayerView[] = gs.players.map((p) => ({
      name: p.name,
      kind: p.kind,
      seatIndex: p.seatIndex,
      hand: p.hand.map((card) => {
        // Show face-up, peeking, or locked indicators for all
        // But only reveal actual card values for the requesting player
        if (p.seatIndex === forSeat || card.isFaceUp || card.isPeeking) {
          return card;
        }
        // Hide opponent face-down cards
        return null;
      }),
      score: gs.phase === 'game_over' ? p.score : 0,
      isLocal: p.seatIndex === forSeat,
    }));

    return {
      players,
      currentTurnSeat: gs.currentTurnSeat,
      localSeat: forSeat,
      deckCount: gs.deck.length,
      discardPile: gs.discardPile,
      drawnCard: gs.currentTurnSeat === forSeat ? gs.drawnCard : null,
      activePower: gs.activePower,
      powerSourceSeat: gs.powerSourceSeat,
      swapSource: gs.swapSource,
      phase: gs.phase,
      turnCount: gs.turnCount,
      winnerSeat: gs.winnerSeat,
    };
  }

  cleanup(): void {
    if (this.aiTurnTimeout) clearTimeout(this.aiTurnTimeout);
    this.clearTurnTimer();
    for (const [, timeout] of this.peekTimeouts) {
      clearTimeout(timeout);
    }
    this.peekTimeouts.clear();
  }
}

// Room manager
const rooms = new Map<string, GameRoom>();

export function createRoom(socket: Socket, playerName: string, difficulty: Difficulty): GameRoom {
  const room = new GameRoom(socket, playerName, difficulty);
  rooms.set(room.id, room);
  return room;
}

export function getRoom(roomId: string): GameRoom | undefined {
  return rooms.get(roomId);
}

export function removeRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (room) {
    room.cleanup();
    rooms.delete(roomId);
  }
}

export function findRoomBySocket(socketId: string): GameRoom | undefined {
  for (const [, room] of rooms) {
    if (room.players.has(socketId)) return room;
  }
  return undefined;
}
