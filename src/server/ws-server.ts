/**
 * Socket.io server initialization and message routing.
 */
import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { ClientMessage } from '@/types/ws-messages';
import { createRoom, getRoom, findRoomBySocket, removeRoom } from './game-room';

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    path: '/api/socket',
  });

  io.on('connection', (socket) => {
    console.log(`[WS] Connected: ${socket.id}`);

    socket.on('message', (msg: ClientMessage) => {
      try {
        handleMessage(socket, msg);
      } catch (err) {
        console.error('[WS] Error handling message:', err);
        socket.emit('message', { type: 'error', message: 'Server error' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[WS] Disconnected: ${socket.id}`);
      const room = findRoomBySocket(socket.id);
      if (room) {
        const seats = room.removePlayer(socket.id);
        if (seats) {
          // Notify remaining players
          for (const [, player] of room.players) {
            player.socket.emit('message', {
              type: 'player_left',
              seat: room.players.get(socket.id)?.seat ?? -1,
              seats,
            });
          }
        }

        // If no human players left, remove room
        const hasHumans = Array.from(room.players.values()).length > 0;
        if (!hasHumans) {
          removeRoom(room.id);
          console.log(`[WS] Room ${room.id} removed (empty)`);
        }
      }
    });
  });

  console.log('[WS] Socket.io server initialized');
  return io;
}

function handleMessage(socket: ReturnType<SocketIOServer['sockets']['sockets']['get']> & { id: string; emit: Function; join: Function }, msg: ClientMessage): void {
  switch (msg.type) {
    case 'create_room': {
      const room = createRoom(socket as any, msg.playerName, msg.difficulty);
      socket.join(room.id);
      socket.emit('message', {
        type: 'room_created',
        roomId: room.id,
        seat: 0,
      });
      console.log(`[WS] Room ${room.id} created by ${msg.playerName}`);
      break;
    }

    case 'join_room': {
      const room = getRoom(msg.roomId.toUpperCase());
      if (!room) {
        socket.emit('message', { type: 'error', message: 'Room not found' });
        return;
      }
      const result = room.join(socket as any, msg.playerName);
      if (!result) {
        socket.emit('message', { type: 'error', message: 'Room is full or game already started' });
        return;
      }
      socket.join(room.id);
      socket.emit('message', {
        type: 'room_created',
        roomId: room.id,
        seat: result.seat,
      });
      // Notify all players in room
      for (const [, player] of room.players) {
        player.socket.emit('message', {
          type: 'player_joined',
          playerName: msg.playerName,
          seat: result.seat,
          seats: result.seats,
        });
      }
      console.log(`[WS] ${msg.playerName} joined room ${room.id} at seat ${result.seat}`);
      break;
    }

    case 'start_game': {
      const room = findRoomBySocket(socket.id);
      if (!room) {
        socket.emit('message', { type: 'error', message: 'Not in a room' });
        return;
      }
      if (!room.isHost(socket.id)) {
        socket.emit('message', { type: 'error', message: 'Only the host can start the game' });
        return;
      }
      if (!room.canStart()) {
        socket.emit('message', { type: 'error', message: 'Cannot start game' });
        return;
      }
      room.startGame();
      console.log(`[WS] Game started in room ${room.id}`);
      break;
    }

    case 'draw_from_deck':
    case 'draw_from_discard':
    case 'discard_drawn': {
      const room = findRoomBySocket(socket.id);
      if (!room) return;
      room.processAction(socket.id, msg.type);
      break;
    }

    case 'swap_with_hand': {
      const room = findRoomBySocket(socket.id);
      if (!room) return;
      room.processAction(socket.id, msg.type, { handIndex: msg.handIndex });
      break;
    }

    case 'select_power_target': {
      const room = findRoomBySocket(socket.id);
      if (!room) return;
      room.processAction(socket.id, msg.type, {
        targetSeat: msg.targetSeat,
        targetIndex: msg.targetIndex,
      });
      break;
    }
  }
}
