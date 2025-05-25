import { createServer, Server as HTTPServer  } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { RoomDataType } from './types/RoomData.type';

dotenv.config();

const httpServer: HTTPServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
  },
});
const activeIntervals = new Map<string, NodeJS.Timeout>();
let roomList: RoomDataType[] = [];

io.on('connection', (socket) => {
  console.log(`Client connected`);

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
  
  socket.on('getRoomList', () => {
    setSocketInterval(socket.id, ()=> socket.emit('getRoomList', roomList));
  });

  socket.on('createRoom', (roomData)=>{
    roomList.push(roomData);
    socket.join(roomData.roomId);
    const data = roomList.find((room)=> room.roomId === roomData.roomId);
    setSocketInterval(socket.id, ()=> io.to(roomData.roomId).emit('roomData', data));
  });

  socket.on('enterRoom', (roomData) => {
    clearSocketInterval(socket.id);
    let roomIndex = roomList.findIndex((room)=> room.roomId === roomData.roomId);
    if (roomIndex === -1) return;
    roomList[roomIndex].users.push(roomData.user);
    socket.join(roomData.roomId);
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

  socket.on('disconnect', () => {
    const interval: NodeJS.Timeout | undefined = activeIntervals.get(socket.id);
    if (interval) {
      clearInterval(interval);
      activeIntervals.delete(socket.id);
    };
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});