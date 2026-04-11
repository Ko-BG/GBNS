const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- HARDENED STORAGE ---
const VAULT_FILE = path.join(__dirname, 'vault_storage.json');

// Memory-state for high-speed sync
let vault = {
    documents: {
        "DOC-DEFAULT": { body: "Welcome to the secure draft space...", locked: false, sig: null }
    },
    chatStream: [],
    users: {} // Maps socket IDs to phone numbers
};

// --- DATA PERSISTENCE ---
if (fs.existsSync(VAULT_FILE)) {
    try {
        vault = JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8'));
        console.log(">> [VAULT] Recovery successful.");
    } catch (e) {
        console.error(">> [VAULT] New vault initialized.");
    }
}

const saveToVault = () => fs.writeFileSync(VAULT_FILE, JSON.stringify(vault, null, 2));

app.use(express.static(__dirname));

// --- REAL-TIME LOGIC ---
io.on('connection', (socket) => {
    console.log(`>> [NODE] Connection established: ${socket.id}`);

    // 1. GLOBAL AUTH (Phone-based identity)
    socket.on('auth-global', (phone) => {
        vault.users[socket.id] = phone;
        // Send existing chat history and status
        socket.emit('init-vault', vault);
        
        // System broadcast of new global node joining
        const systemMsg = { sender: "SYSTEM", text: `Node ${phone} joined the Global Terminal.`, time: new Date().toLocaleTimeString() };
        vault.chatStream.push(systemMsg);
        io.emit('new-entry', systemMsg);
    });

    // 2. CHAT LOGIC (WhatsApp/Telegram Stream)
    socket.on('message', (data) => {
        const msg = {
            sender: vault.users[socket.id] || "Unknown",
            text: data.text,
            time: new Date().toLocaleTimeString()
        };
        vault.chatStream.push(msg);
        io.emit('new-entry', msg);
        saveToVault();
    });

    // 3. DOCUMENT DRAFTING (Outlook/Word Style)
    socket.on('request-doc', (id) => {
        // If doc doesn't exist, create it on the fly
        if (!vault.documents[id]) {
            vault.documents[id] = { body: "", locked: false, sig: null };
        }
        socket.emit('sync-doc', { id, body: vault.documents[id].body });
    });

    socket.on('update-doc', (data) => {
        if (vault.documents[data.id] && !vault.documents[data.id].locked) {
            vault.documents[data.id].body = data.body;
            // Broadcast to all except sender to prevent cursor jump
            socket.broadcast.emit('sync-doc', data);
        }
    });

    // 4. iSignPDF LOGIC (Biometric Sealing)
    socket.on('seal-with-signature', (data) => {
        const doc = vault.documents[data.id];
        if (doc && !doc.locked) {
            doc.locked = true;
            doc.body = data.body;
            doc.sig = data.sig; // Stores the Base64 canvas data
            doc.signer = vault.users[socket.id];
            doc.timestamp = new Date().toISOString();

            console.log(`>> [SEAL] Document ${data.id} signed by ${doc.signer}`);
            
            // Broadcast the sealed state and the signature image
            io.emit('vault-sealed', { 
                id: data.id, 
                body: doc.body, 
                sig: doc.sig, 
                signer: doc.signer 
            });
            
            saveToVault();
        }
    });

    socket.on('disconnect', () => {
        delete vault.users[socket.id];
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`-----------------------------------------`);
    console.log(`Comm-OS ENGINE: http://localhost:${PORT}`);
    console.log(`Global Authenticator: ACTIVE`);
    console.log(`-----------------------------------------`);
});
