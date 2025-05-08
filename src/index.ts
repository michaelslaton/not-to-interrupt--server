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

let crudData: any[] = [];

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('create', (data)=>{
    crudData.push(data);
    socket.emit('crudData', crudData);
  })

  setInterval(() => {
    socket.emit('crudData', crudData);
  }, 1000);
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});