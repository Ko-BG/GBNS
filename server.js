const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Shared Global Vault
let vault = {
    documents: {
        "DOC-77": { body: "Initial Contract Terms...", locked: false, fingerprint: null },
        "DOC-88": { body: "Project Scope Alpha...", locked: false, fingerprint: null }
    },
    chatStream: []
};

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    // 1. Authenticate user into the Global Node
    socket.on('auth-global', (phone) => {
        console.log(`[AUTH] Node ${socket.id} joined via ${phone}`);
        socket.emit('init-vault', vault);
    });

    // 2. Messaging Logic
    socket.on('message', (data) => {
        const msg = { ...data, time: new Date().toLocaleTimeString() };
        vault.chatStream.push(msg);
        io.emit('new-entry', msg);
    });

    // 3. Document Logic
    socket.on('update-doc', (data) => {
        if (vault.documents[data.id] && !vault.documents[data.id].locked) {
            vault.documents[data.id].body = data.body;
            socket.broadcast.emit('sync-doc', data);
        }
    });

    socket.on('trigger-lock', (id) => {
        vault.documents[id].locked = true;
        vault.documents[id].fingerprint = `SIG-${Math.random().toString(36).toUpperCase().substring(7)}`;
        io.emit('vault-sealed', { id, doc: vault.documents[id] });
    });
});

server.listen(3000, () => console.log('COMM-OS ONLINE: PORT 3000'));
