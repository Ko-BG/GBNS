const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// State Management
let docState = {
    content: "",
    locked: false,
    lastModified: Date.now()
};

// Serve the UI from root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    // Initial Sync
    socket.emit('init-state', docState);

    // Live Editing Logic
    socket.on('doc-update', (data) => {
        if (!docState.locked) {
            docState.content = data;
            docState.lastModified = Date.now();
            socket.broadcast.emit('doc-sync', data);
        }
    });

    // The Lock Protocol
    socket.on('lock-request', () => {
        docState.locked = true;
        io.emit('doc-locked', {
            content: docState.content,
            timestamp: new Date().toISOString()
        });
    });

    // Global Messaging
    socket.on('message', (msg) => {
        const payload = {
            id: Math.random().toString(36).substr(2, 9),
            text: msg.text,
            user: msg.user || 'Anonymous',
            time: new Date().toLocaleTimeString()
        };
        io.emit('new-message', payload);
    });

    socket.on('error', (err) => console.error("Socket Error:", err));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Comm-OS Terminal Active: http://localhost:${PORT}`);
});
