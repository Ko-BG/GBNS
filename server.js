const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" },
    connectionStateRecovery: {} // Allows temporary disconnects without losing state
});

const DATA_FILE = './workspace_state.json';

// --- ROBUST STATE MANAGEMENT ---
let docState = {
    content: "// Welcome to Comm-OS. Terminal initialized.",
    locked: false,
    lastModified: Date.now(),
    history: []
};

// Load existing state from disk if it exists
if (fs.existsSync(DATA_FILE)) {
    try {
        const savedData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        docState = { ...docState, ...savedData };
        console.log("💾 Existing workspace state recovered from disk.");
    } catch (e) {
        console.error("⚠️ Failed to parse saved state, starting fresh.");
    }
}

const saveState = () => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(docState, null, 2));
};

// --- ROUTES ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- SOCKET ORCHESTRATION ---
io.on('connection', (socket) => {
    const userId = socket.id.substring(0, 5);
    console.log(`📡 [${userId}] Terminal Link Established`);

    // 1. Initial Handshake
    socket.emit('init-state', {
        content: docState.content,
        locked: docState.locked
    });

    // 2. Real-time Document Stream
    socket.on('doc-update', (content) => {
        if (docState.locked) return;

        docState.content = content;
        docState.lastModified = Date.now();
        
        // Broadcast to everyone EXCEPT the sender to prevent cursor jumps
        socket.broadcast.emit('doc-sync', content);
    });

    // 3. The Lock Protocol (Finalization)
    socket.on('lock-request', () => {
        if (docState.locked) return;

        docState.locked = true;
        const timestamp = new Date().toISOString();
        
        console.log(`🔒 [PROTOCOL] Document finalized at ${timestamp}`);
        
        io.emit('doc-locked', {
            content: docState.content,
            timestamp: timestamp
        });

        saveState(); // Commit to permanent record
    });

    // 4. Messaging Layer
    socket.on('message', (data) => {
        const payload = {
            id: Math.random().toString(36).substring(2, 9),
            text: data.text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            user: userId
        };

        // Add to persistent chat history (max 50)
        docState.history.push(payload);
        if (docState.history.length > 50) docState.history.shift();

        io.emit('new-message', payload);
    });

    // 5. Cleanup
    socket.on('disconnect', () => {
        console.log(`🔌 [${userId}] Terminal Link Terminated`);
    });
});

// --- STARTUP ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`
    -------------------------------------------
    🚀 COMM-OS ENGINE v1.1 ACTIVE
    📍 URL: http://localhost:${PORT}
    🛡️ LOCK STATUS: ${docState.locked ? 'FINALIZED' : 'OPEN'}
    -------------------------------------------
    `);
});
