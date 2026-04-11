const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let state = {
    doc: "",
    locked: false,
    sigData: null,
    history: []
};

io.on('connection', (socket) => {
    socket.emit('sync-all', state);

    socket.on('chat', (msg) => {
        state.history.push(msg);
        io.emit('chat-new', msg);
    });

    socket.on('seal-record', (data) => {
        state.doc = data.body;
        state.sigData = data.sig;
        state.locked = true;
        
        // Permanent Record Generation
        fs.writeFileSync('./OFFICIAL_VAULT.json', JSON.stringify(state, null, 2));
        io.emit('record-sealed', state);
    });
});

server.listen(3000, () => console.log('Comm-OS: SEALED_ENGINE_ON'));
