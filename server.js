const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk'); // Optional: for colored terminal logs

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// --- CONSTANTS & PATHS ---
const PORT = process.env.PORT || 3000;
const VAULT_FILE = path.join(__dirname, 'vault_storage.json');

// --- INITIAL STATE ---
let vault = {
    activeDoc: {
        body: "Comm-OS Global First & Unique Terminal initialized.\nDraft your official record here...",
        isLocked: false,
        fingerprint: null
    },
    chatStream: []
};

// --- DATA PERSISTENCE: LOAD ON START ---
if (fs.existsSync(VAULT_FILE)) {
    try {
        const data = fs.readFileSync(VAULT_FILE, 'utf8');
        vault = JSON.parse(data);
        console.log(chalk.green('💾 VAULT_RECOVERED: Existing records loaded from disk.'));
    } catch (err) {
        console.log(chalk.red('⚠️ VAULT_ERROR: Could not parse storage, starting fresh.'));
    }
}

// Save helper
const commitToDisk = () => {
    fs.writeFileSync(VAULT_FILE, JSON.stringify(vault, null, 2));
};

// --- ROUTES ---
app.use(express.static(__dirname)); // Serves your index.html automatically

// --- SOCKET ORCHESTRATION ---
io.on('connection', (socket) => {
    const nodeId = socket.id.substring(0, 6).toUpperCase();
    console.log(chalk.cyan(`📡 [NODE_${nodeId}] Link established.`));

    // 1. Initial Handshake
    socket.emit('init-vault', vault);

    // 2. Chat Stream Logic (WhatsApp/Telegram Style)
    socket.on('message', (text) => {
        const msg = {
            text: text,
            senderId: socket.id,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            node: nodeId
        };
        vault.chatStream.push(msg);
        if (vault.chatStream.length > 100) vault.chatStream.shift(); // Memory management
        
        io.emit('new-entry', msg);
        commitToDisk();
    });

    // 3. Document Sync (Word/Outlook Style)
    socket.on('update-draft', (content) => {
        if (!vault.activeDoc.isLocked) {
            vault.activeDoc.body = content;
            // Broadcast to all other nodes
            socket.broadcast.emit('sync-draft', content);
            
            // Debounced disk commit would be better, but direct works for reliability
            commitToDisk();
        }
    });

    // 4. The Global Seal (Immutable Lock Protocol)
    socket.on('trigger-lock', () => {
        if (vault.activeDoc.isLocked) return;

        vault.activeDoc.isLocked = true;
        
        // Generate Unique Global Fingerprint
        const timestamp = Date.now().toString(36).toUpperCase();
        const randomHex = Math.random().toString(16).slice(2, 8).toUpperCase();
        vault.activeDoc.fingerprint = `GLOBAL-FIRST-${timestamp}-${randomHex}`;

        console.log(chalk.red.bold(`🔒 RECORD SEALED: ${vault.activeDoc.fingerprint}`));
        
        // Notify all parties
        io.emit('vault-sealed', vault.activeDoc);
        
        // Final immutable save
        commitToDisk();
    });

    socket.on('disconnect', () => {
        console.log(chalk.yellow(`🔌 [NODE_${nodeId}] Link terminated.`));
    });
});

// --- ENGINE START ---
server.listen(PORT, () => {
    console.log(`
${chalk.bold.blue('--------------------------------------------------')}
🚀 ${chalk.bold('COMM-OS GLOBAL TERMINAL ENGINE')}
📍 LOCAL ACCESS: http://localhost:${PORT}
📁 STORAGE: ${VAULT_FILE}
${chalk.bold.blue('--------------------------------------------------')}
    `);
});
