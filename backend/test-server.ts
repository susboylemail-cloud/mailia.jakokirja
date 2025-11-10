import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

httpServer.listen(3000, () => {
    console.log('Test server running on port 3000');
});

io.on('connection', (socket) => {
    console.log('Client connected');
});
