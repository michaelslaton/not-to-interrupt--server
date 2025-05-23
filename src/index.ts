import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

dotenv.config();

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
  },
});
const activeIntervals = new Map<string, NodeJS.Timeout>();

let roomList: any[] = [];

io.on('connection', (socket) => {
  console.log(`Client connected`);

  const clearSocketInterval = (socketId: string) => {
    if (activeIntervals.has(socketId)) {
      clearInterval(activeIntervals.get(socketId));
      activeIntervals.delete(socketId);
    };
  };
  
  socket.on('getRoomList', () => {
    clearSocketInterval(socket.id);
    
    const interval = setInterval(() => {
      socket.emit('getRoomList', roomList);
    }, 1000);
    
    activeIntervals.set(socket.id, interval);
  });

  socket.on('createRoom', (roomData)=>{
    roomList.push(roomData);

    clearSocketInterval(socket.id);

    socket.join(roomData.roomId);
    const interval = setInterval(() => {
      const data = roomList.find((room)=> room.roomId === roomData.roomId);
      io.to(roomData.roomId).emit('roomData', data);
    }, 1000);

    activeIntervals.set(socket.id, interval);
  });

  socket.on('enterRoom', (roomData) => {
    clearSocketInterval(socket.id);

    let roomIndex = roomList.findIndex((room)=> room.roomId === roomData.roomId);
    if (roomIndex === -1) return;
    roomList[roomIndex].users.push(roomData.user);
    socket.join(roomData.roomId);

    const interval = setInterval(() => {
      socket.emit('roomData', roomList[roomIndex]);
    }, 1000);

    activeIntervals.set(socket.id, interval);
  });

socket.on('leaveRoom', (data: { userId: string; roomId: string }) => {
  const { userId, roomId } = data;

  const roomIndex = roomList.findIndex(room => room.roomId === roomId);
  if (roomIndex === -1) {
    console.log(`Room ${roomId} not found for user ${userId}`);
    return;
  }

  roomList[roomIndex].users = roomList[roomIndex].users.filter(user => user.id !== userId);

  if (roomList[roomIndex].users.length === 0) {
    roomList.splice(roomIndex, 1);
    console.log(`Room ${roomId} is now empty and has been removed.`);
  } else {
    io.to(roomId).emit('roomData', roomList[roomIndex]);
  }

  socket.leave(roomId);

  clearSocketInterval(socket.id);

  const interval = setInterval(() => {
    socket.emit('getRoomList', roomList);
  }, 1000);
  activeIntervals.set(socket.id, interval);

  console.log(`User ${userId} left room ${roomId}`);

  io.emit('getRoomList', roomList);
});

  socket.on('disconnect', () => {
    const interval = activeIntervals.get(socket.id);
    if (interval) {
      clearInterval(interval);
      activeIntervals.delete(socket.id);
    }
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});