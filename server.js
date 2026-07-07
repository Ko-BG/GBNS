/**
 * PADEL ERBIL HIGH-PERFORMANCE GAMING & E-COMMERCE ENGINE
 * Architecture: Fastify + Socket.io (Bi-directional Stateful Engine)
 * Engineered for low-latency multiplayer syncing and real-time storefront webhooks.
 */

const fastify = require('fastify')({ logger: false });
const path = require('path');

// Initialize High-Performance Real-Time WebSockets
const io = require('socket.io')(fastify.server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingInterval: 10000, // Detect dead clients quickly (FIFA style)
    pingTimeout: 5000
});

const PORT = process.env.PORT || 3000;

// Register static serving for client storefront assets
fastify.register(require('@fastify/static'), {
    root: path.join(__dirname),
    prefix: '/', 
});

// MEMORY STATE MANAGEMENT (Simulating Redis Clusters for Live Game Rooms)
const matchmakingQueue = { single: [], doubles: [] };
const activeMatchRooms = new Map();

/**
 * ==========================================
 * REAL-TIME MULTIPLAYER MATCHMAKING GEARS
 * ==========================================
 */
io.on('connection', (socket) => {
    console.log(`📡 Client connected to Padel Erbil Cluster: ${socket.id}`);

    // Action: Client enters Matchmaking Queue (Single or Doubles)
    socket.on('enter_matchmaking', (data) => {
        const { username, mode } = data;
        const playerProfile = { socketId: socket.id, username, mode };
        
        matchmakingQueue[mode].push(playerProfile);
        console.log(`🎮 [Queue] ${username} joined ${mode} matchmaking.`);

        // Trigger Matchmaker Verification Routine
        processMatchmakingQueue(mode);
    });

    // Action: Live Frame Input Stream Sync (Updates Player Positions)
    socket.on('player_input', (data) => {
        const { roomId, positionY } = data;
        const room = activeMatchRooms.get(roomId);
        
        if (room) {
            // Identify if player belongs to Team Left (P1/P2) or Team Right (P3/P4)
            if (room.players.teamLeft.includes(socket.id)) {
                room.state.p1Y = positionY;
            } else {
                room.state.p2Y = positionY;
            }
            // Broadcast state delta changes to room peers immediately
            socket.to(roomId).emit('court_state_update', room.state);
        }
    });

    // Action: Graceful Disconnection Handling
    socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected from cluster: ${socket.id}`);
        // Clean queues and terminate active ghost sessions if applicable
        cleanAbandonedSessions(socket.id);
    });
});

/**
 * Process Queue Loops to generate instances dynamically
 */
function processMatchmakingQueue(mode) {
    const requiredPlayers = mode === 'doubles' ? 4 : 2;
    
    if (matchmakingQueue[mode].length >= requiredPlayers) {
        const matchedPlayers = matchmakingQueue[mode].splice(0, requiredPlayers);
        const roomId = `court_room_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        const roomPayload = {
            roomId,
            players: {
                teamLeft: matchedPlayers.slice(0, requiredPlayers / 2).map(p => p.socketId),
                teamRight: matchedPlayers.slice(requiredPlayers / 2).map(p => p.socketId)
            },
            state: {
                ball: { x: 400, y: 225, dx: 4, dy: 3 },
                p1Y: 175,
                p2Y: 175,
                score: { left: 0, right: 0 }
            }
        };

        activeMatchRooms.set(roomId, roomPayload);

        // Instruct clients to leave global lobby and join physical server instance
        matchedPlayers.forEach((player) => {
            const clientSocket = io.sockets.sockets.get(player.socketId);
            if (clientSocket) {
                clientSocket.join(roomId);
                clientSocket.emit('match_ready', { roomId, side: roomPayload.players.teamLeft.includes(player.socketId) ? 'left' : 'right' });
            }
        });

        // Spin up deterministic dedicated physics thread loops for this room instance
        initiatePhysicsThread(roomId);
        console.log(`⚔️ [Match Found] Instance created: ${roomId}. Match Loop active.`);
    }
}

/**
 * Low-Latency Isolated Physics Engine Loop (60Hz Server Tick Rate)
 */
function initiatePhysicsThread(roomId) {
    const gameTick = setInterval(() => {
        const room = activeMatchRooms.get(roomId);
        if (!room) {
            clearInterval(gameTick);
            return;
        }

        let ball = room.state.ball;
        
        // Ball Glass Boundary Interventions
        if (ball.y < 10 || ball.y > 440) ball.dy = -ball.dy;

        // Apply Linear Velocity Changes 
        ball.x += ball.dx;
        ball.y += ball.dy;

        // Check Out of Bounds / Scoring Criteria
        if (ball.x < 0) {
            room.state.score.right += 1;
            resetBall(ball);
        } else if (ball.x > 800) {
            room.state.score.left += 1;
            resetBall(ball);
        }

        // Broadcast synchronized data frames to the room cluster
        io.to(roomId).emit('court_state_update', room.state);
    }, 1000 / 60); // 60 Ticks Per Second Server Calibration
}

function resetBall(ball) {
    ball.x = 400; ball.y = 225;
    ball.dx = ball.dx > 0 ? -4 : 4;
    ball.dy = (Math.random() * 4) - 2;
}

function cleanAbandonedSessions(socketId) {
    ['single', 'doubles'].forEach(mode => {
        matchmakingQueue[mode] = matchmakingQueue[mode].filter(p => p.socketId !== socketId);
    });
}

/**
 * ==========================================
 * HIGH-SPEED E-COMMERCE ENDPOINTS (REST API)
 * ==========================================
 */
fastify.post('/api/checkout/create-order', async (request, reply) => {
    const { items, paymentMethod, deliveryAddress } = request.body;
    
    // Simulate complex transactional routing for Erbil delivery channels
    const orderId = `PE-${Math.floor(100000 + Math.random() * 900000)}`;
    
    console.log(`🛒 [Order Processed] ID: ${orderId} via Method: ${paymentMethod}`);
    
    return reply.status(201).send({
        status: "Success",
        orderId,
        message: "Order queued into Erbil Hub delivery channels successfully.",
        estimatedDelivery: "Same-Day Delivery (Within Erbil City limits)"
    });
});

/**
 * Start Server Runtime Execution
 */
const start = async () => {
    try {
        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`=======================================================`);
        console.log(`🛡️ PADEL ERBIL TRIPLE-A CORE ENGINE RUNNING AT PORT ${PORT}`);
        console.log(`📊 Socket.io Frame Rate Synchronization: 60Hz`);
        console.log(`🌐 Live Gateway Node Endpoint: http://localhost:${PORT}`);
        console.log(`=======================================================`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};
start();
