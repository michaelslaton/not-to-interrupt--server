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

// const stopPingingSocket = (socketId: string) => {
//   targetSocketIds.delete(socketId);
// };

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
  
  // Validation Functions ------------------------------------------------------------------>
  const userValidation = (user: UserType): boolean => {
    if (!user) return emitError('Missing user data'), false;
    if (!user.id?.trim()) return emitError('Missing user id'), false;
    if (!user.name?.trim()) return emitError('Missing user name'), false;
    if (!user.socketId?.trim()) return emitError('Missing socketId'), false;
    if (!user.controller) return emitError('Missing controller'), false;
    if (user.controller.afk === undefined) return emitError('Missing controller component'), false;
    if (user.controller.handUp === undefined) return emitError('Missing controller component'), false;
    if (!('comment' in user.controller)) return emitError('Missing controller component'), false;
    return true;
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
    if(roomExists) return emitError(`Room with ID '${roomData.roomId}' or name '${roomData.name}' already exists.`);
    if(!users.length) return emitError('Missing User List');
    if(!userValidation(users[0])) return;

    roomList.push(roomData);
    socket.join(roomId);
    lastPongMap.set(socket.id, Date.now());
    startPingingSocket(socket.id);
    const data: RoomDataType | undefined = roomList.find((room)=> room.roomId === roomId);
    setSocketInterval(socket.id, ()=> io.to(roomId).emit('roomData', data));
  });

  socket.on('enterRoom', (data: {roomId: string, user: UserType, socketId: string}) => {
    const {roomId, user} = data;
    if(!roomId?.trim()) return emitError('Missing roomId');
    if(!userValidation(user)) return;

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
    if(!userId?.trim()) return emitError('Missing userId');
    if(!roomId?.trim()) return emitError('Missing roomId');
    const roomIndex: number = roomList.findIndex(room => room.roomId === roomId);
    if (roomIndex === -1) return console.log(`Room ${roomId} not found for user ${userId}`);
    const userInRoom = roomList[roomIndex].users.some(user => user.id === userId);
    if (!userInRoom) return console.log(`User ${userId} not found in room ${roomId}`);

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

  socket.on('controllerUpdate', (data: { user: UserType, roomId: string}) => {
    const { user, roomId } = data;
    if(!roomId?.trim()) return emitError('Missing roomId');
    if(!userValidation(user)) return;

    const roomIndex: number = roomList.findIndex(room => room.roomId === roomId);
    if (roomIndex === -1) return console.log(`Room ${roomId} not found.`);
    const userIndex: number = roomList[roomIndex].users.findIndex(u => u.id === user.id);
    if (userIndex === -1) return console.log(`User ${user.id} not found in room ${roomId}.`);
    roomList[roomIndex].users[userIndex] = user;
    io.emit('getRoomList', roomList);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    const interval = activeIntervals.get(socket.id);
    if (interval) {
      clearInterval(interval);
      activeIntervals.delete(socket.id);
    };
    removeUserBySocketId(socket.id);
    lastPongMap.delete(socket.id);
    targetSocketIds.delete(socket.id);

    io.emit('getRoomList', roomList);
  });

  socket.on('passMic', (data: { currentUser: string; newUser: string }) => {
    const { currentUser, newUser } = data;

    if (!currentUser?.trim()) return emitError('Missing currentUser');
    if (!newUser?.trim()) return emitError('Missing newUser');

    // Find the room containing both users
    const roomIndex = roomList.findIndex(room =>
      room.users.some(u => u.id === currentUser) &&
      room.users.some(u => u.id === newUser)
    );
    if (roomIndex === -1) return emitError('Room with both users not found');

    const room = roomList[roomIndex];
    const fromUserIndex = room.users.findIndex(user => user.id === currentUser);
    const toUserIndex = room.users.findIndex(user => user.id === newUser);

    if (fromUserIndex === -1) return emitError('Current user not found');
    if (toUserIndex === -1) return emitError('New user not found');
    if (!room.users[fromUserIndex].controller.hasMic) return emitError('Current user does not have the mic');

    // Pass the mic
    room.users[fromUserIndex].controller.hasMic = false;
    room.users[toUserIndex].controller.hasMic = true;
    room.users[toUserIndex].controller.handUp = false;

    // Update the room in the list
    roomList[roomIndex] = { ...room };

    // Emit updates
    io.to(room.users[toUserIndex].socketId).emit('receiveMic', {
      userId: room.users[toUserIndex].id,
      roomId: room.roomId,
    });

    io.to(room.roomId).emit('roomData', room);
    // io.emit('getRoomList', roomList); // Optional: update room list for everyone
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