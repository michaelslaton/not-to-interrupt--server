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
  
  socket.on('getRoomList', () => {
    if (activeIntervals.has(socket.id)) {
      clearInterval(activeIntervals.get(socket.id));
      activeIntervals.delete(socket.id);
    };
    
    const interval = setInterval(() => {
      socket.emit('getRoomList', roomList);
    }, 1000);
    
    activeIntervals.set(socket.id, interval);
  });

  socket.on('createRoom', (roomData)=>{
    roomList.push(roomData);
    
    if (activeIntervals.has(socket.id)) {
      clearInterval(activeIntervals.get(socket.id));
      activeIntervals.delete(socket.id);
    };

    const interval = setInterval(() => {
      const data = roomList.find((room)=> room.roomId === roomData.roomId);
      socket.emit('roomData', data);
    }, 1000);

    activeIntervals.set(socket.id, interval);
  });

  socket.on('enterRoom', (roomId) => {
    if (activeIntervals.has(socket.id)) {
      clearInterval(activeIntervals.get(socket.id));
      activeIntervals.delete(socket.id);
    };

    const interval = setInterval(() => {
      const data = `The data is ${roomId}`
      socket.emit('roomData', data);
    }, 1000);

    activeIntervals.set(socket.id, interval);
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