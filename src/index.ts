import { createServer, Server as HTTPServer  } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { RoomDataType } from './types/RoomData.type';
import { UserType } from './types/UserType.type';

dotenv.config();

const httpServer: HTTPServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
  },
});
const activeIntervals = new Map<string, NodeJS.Timeout>();
let roomList: RoomDataType[] = [];
const lastPongMap = new Map<string, number>();

const startPingingSocket = (socketId: string) => {
  targetSocketIds.add(socketId);
};

const stopPingingSocket = (socketId: string) => {
  targetSocketIds.delete(socketId);
};

const removeUserBySocketId = (socketId: string) => {
  for (const room of roomList) room.users = room.users.filter(user => user.socketId !== socketId);
  roomList = roomList.filter(room => room.users.length > 0);
};

io.on('connection', (socket) => {
  console.log(`Client connected`);
  
  // Helper Functions ------------------------------------------------------------------>
  const clearSocketInterval = (socketId: string): void => {
    if (activeIntervals.has(socketId)) {
      clearInterval(activeIntervals.get(socketId));
      activeIntervals.delete(socketId);
    };
  };
  
  const setSocketInterval = (socketId: string, fn: () => void): void => {
    clearSocketInterval(socketId);
    fn();
    const interval = setInterval(fn, 1000);
    activeIntervals.set(socketId, interval);
  };

  const emitError = (msg: string): void => {
    socket.emit('error', msg);
    console.error(msg);
  };
  
  // Socket Functions ------------------------------------------------------------------>
  socket.on('chat', (data: { roomId: string, user: string, message: string })=>{
    const { roomId, user, message } = data;
    if (!roomId?.trim()) return emitError('Missing RoomID');
    if (!user?.trim()) return emitError('Missing User');
    if (!message?.trim()) return emitError('Missing Message');

    const roomIndex: number = roomList.findIndex(room => room.roomId === roomId);
    if (roomIndex === -1) return emitError(`Room ${roomId} not found for user ${user}`);
    roomList[roomIndex].chat.push({ user, message });
    io.to(roomId).emit('roomData', roomList[roomIndex]);
  });

  socket.on('pongCheck', () => {
    lastPongMap.set(socket.id, Date.now());
  });
  
  socket.on('getRoomList', () => {
    setSocketInterval(socket.id, ()=> socket.emit('getRoomList', roomList));
  });

  socket.on('createRoom', (roomData: RoomDataType)=>{
    if(!roomData) return emitError('Missing Room Data');
    const { roomId, users, hostId, name } = roomData;
    if (!Array.isArray(users) || users.length === 0) return emitError('No users provided.');
    if(!roomId?.trim()) return emitError('Missing roomId');
    if(!hostId?.trim()) return emitError('Missing hostId');
    if(!name?.trim()) return emitError('Missing Room Name');
    const roomExists = roomList.some(room => room.roomId === roomData.roomId || room.name === roomData.name);
    if (roomExists) return emitError(`Room with ID "${roomData.roomId}" or name "${roomData.name}" already exists.`);

    roomList.push(roomData);
    socket.join(roomId);
    lastPongMap.set(socket.id, Date.now());
    startPingingSocket(roomData.users[0].socketId);
    const data: RoomDataType | undefined = roomList.find((room)=> room.roomId === roomId);
    setSocketInterval(socket.id, ()=> io.to(roomId).emit('roomData', data));
  });

  socket.on('enterRoom', (data: {roomId: string, user: UserType, socketId: string}) => {
    const {roomId, user} = data;
    if(!roomId?.trim()) return emitError('Missing roomId');
    if (!user) return emitError('Missing user data');
    if (!user.id?.trim()) return emitError('Missing user id');
    if (!user.name?.trim()) return emitError('Missing user name');
    if (!user.socketId?.trim()) return emitError('Missing socketId');
    if (!user.controller) return emitError('Missing controller');
    if (user.controller.afk === undefined) return emitError('Missing controller component');
    if (user.controller.handUp === undefined) return emitError('Missing controller component');
    if (!('comment' in user.controller)) return emitError('Missing controller component');

    clearSocketInterval(socket.id);
    lastPongMap.set(socket.id, Date.now());
    let roomIndex: number = roomList.findIndex((room)=> room.roomId === roomId);
    if (roomIndex === -1) return;
    roomList[roomIndex].users.push(user);
    socket.join(roomId);
    setSocketInterval(socket.id, ()=> socket.emit('roomData', roomList[roomIndex]));
  });

  socket.on('leaveRoom', (data: { userId: string; roomId: string }) => {
    const { userId, roomId } = data;
    const roomIndex: number = roomList.findIndex(room => room.roomId === roomId);
    if (roomIndex === -1) return console.log(`Room ${roomId} not found for user ${userId}`);
    roomList[roomIndex].users = roomList[roomIndex].users.filter(user => user.id !== userId);
    if (roomList[roomIndex].users.length === 0) {
      roomList.splice(roomIndex, 1);
      console.log(`Room ${roomId} is now empty and has been removed.`);
    } else {
      io.to(roomId).emit('roomData', roomList[roomIndex]);
    };
    socket.leave(roomId);
    clearSocketInterval(socket.id);
    setSocketInterval(socket.id, ()=> socket.emit('getRoomList', roomList));
    console.log(`User ${userId} left room ${roomId}`);
    io.emit('getRoomList', roomList);
  });

  socket.on('controllerUpdate', ({ user, roomId }) => {
    const roomIndex: number = roomList.findIndex(room => room.roomId === roomId);
    if (roomIndex === -1) {
      console.log(`Room ${roomId} not found.`);
      return;
    };
    const userIndex: number = roomList[roomIndex].users.findIndex(u => u.id === user.id);
    if (userIndex === -1) {
      console.log(`User ${user.id} not found in room ${roomId}.`);
      return;
    };
    roomList[roomIndex].users[userIndex] = user;
    io.emit('getRoomList', roomList);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);

    const interval = activeIntervals.get(socket.id);
    if (interval) {
      clearInterval(interval);
      activeIntervals.delete(socket.id);
    }

    removeUserBySocketId(socket.id);

    lastPongMap.delete(socket.id);
    targetSocketIds.delete(socket.id);

    io.emit('getRoomList', roomList);
  });
});
const targetSocketIds = new Set<string>();

// Ping interval logic ------------------------------------------------------------------>
setInterval(() => {
  const now = Date.now();

  for (const [socketId, lastPong] of lastPongMap.entries()) {
    const socket = io.sockets.sockets.get(socketId);

    if (!socket) {
      console.log(`Socket ${socketId} not found. Removing from map.`);
      lastPongMap.delete(socketId);
      continue;
    };

    if (now - lastPong > 10000) {
      console.log(`Socket ${socketId} timed out. Disconnecting.`);
      socket.disconnect(true);
      lastPongMap.delete(socketId);
      removeUserBySocketId(socketId);
      continue;
    };

    socket.emit('pingCheck');
  };
}, 5000);

//  ------------------------------------------------------------------------------------->
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});