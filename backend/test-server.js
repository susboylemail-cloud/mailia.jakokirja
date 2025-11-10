const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: '*' }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

httpServer.listen(3000, () => {
    console.log('JAVASCRIPT TEST SERVER RUNNING ON PORT 3000 - SHOULD STAY ALIVE!');
    console.log('Visit http://localhost:3000/health');
});

io.on('connection', (socket) => {
    console.log('Client connected');
});

// Keep alive
setInterval(() => {
    console.log('Server alive check:', new Date().toISOString());
}, 5000);
