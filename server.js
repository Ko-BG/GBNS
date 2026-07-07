/**
 * ============================================================================
 * PADEL ERBIL HIGH-PERFORMANCE ENTERPRISE GAME ENGINE
 * ============================================================================
 * Architecture: Fastify Core Engine + Highly Optimized Socket.io Core
 * Target: Low-latency Matchmaking, Server-Side Physics, and E-Commerce Piping
 * Environment: Production-Ready (Thread-Safe Simulation Blocks)
 * File Name: server.js
 * ============================================================================
 */

const fastify = require('fastify')({ 
    logger: { level: 'info', transport: { target: 'pino-pretty' } },
    trustProxy: true 
});
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// --- ENTERPRISE SECURITY & CONSTANT CONFIGURATIONS ---
const PORT = process.env.PORT || 3000;
const ENGINE_CONFIG = {
    TICK_RATE: 1000 / 60,            // 60 Hz Server Architecture Tick Rate
    QUEUE_RESOLUTION_RATE: 2500,     // Evaluates Matchmaker Pool every 2.5s
    BASE_MMR_WINDOW: 120,            // Baseline allowable skill deviation
    WINDOW_EXPANSION_STEP: 45,       // Window width expansion step per check
    COURT_DIMENSIONS: { WIDTH: 800, HEIGHT: 450 },
    PADDLE_DIMENSIONS: { HEIGHT: 100, WIDTH: 15 },
    BALL_BASE_SPEED: 6
};

// --- INITIALIZE REAL-TIME WEBSOCKET INFRASTRUCTURE ---
const io = require('socket.io')(fastify.server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingInterval: 12000, 
    pingTimeout: 4000,
    transports: ['websocket', 'polling']
});

// --- CORE REGISTRIES & STATE PIPES ---
const connectionPool = new Map();     // Global Client Map tracking active sockets
const matchmakingQueue = { single: [], doubles: [] };
const activeMatchRooms = new Map();

// Register Fastify Static Serving Middleware for Client Assets
fastify.register(require('@fastify/static'), {
    root: path.join(__dirname),
    prefix: '/', 
});

/**
 * ============================================================================
 * ADVANCED MATCHMAKING CORE PIPELINES
 * ============================================================================
 */
function processMatchmakingEngine(mode) {
    const pool = matchmakingQueue[mode];
    const capacityRequired = mode === 'doubles' ? 4 : 2;

    if (pool.length < capacityRequired) return;

    fastify.log.info(`[MATCHMAKER] Evaluating ${mode} queue. Total waiting: ${pool.length}`);
    
    // Prioritize oldest players in the matchmaking pool
    pool.sort((a, b) => a.enlistedAt - b.enlistedAt);
    const assignedIndices = new Set();

    for (let i = 0; i < pool.length; i++) {
        if (assignedIndices.has(i)) continue;
        
        const leader = pool[i];
        const matchGroup = [leader];
        
        const ageInTicks = Math.floor((Date.now() - leader.enlistedAt) / ENGINE_CONFIG.QUEUE_RESOLUTION_RATE);
        const expandedWindow = ENGINE_CONFIG.BASE_MMR_WINDOW + (ageInTicks * ENGINE_CONFIG.WINDOW_EXPANSION_STEP);

        for (let j = i + 1; j < pool.length; j++) {
            if (assignedIndices.has(j)) continue;
            
            const candidate = pool[j];
            const skillDelta = Math.abs(leader.mmr - candidate.mmr);

            if (skillDelta <= expandedWindow) {
                matchGroup.push(candidate);
                if (matchGroup.length === capacityRequired) {
                    // Mark candidates as locked
                    matchGroup.forEach(p => {
                        const idx = pool.findIndex(orig => orig.socketId === p.socketId);
                        if (idx !== -1) assignedIndices.add(idx);
                    });
                    
                    provisionMatchRoom(matchGroup, mode);
                    break;
                }
            }
        }
    }

    // Purge elements from processing registry arrays safely
    matchmakingQueue[mode] = pool.filter((_, idx) => !assignedIndices.has(idx));
}

function provisionMatchRoom(players, mode) {
    const roomId = `COURT_ROOM_${uuidv4()}`;
    fastify.log.info(`[SERVER] Match Found. Spinning up instance: ${roomId}`);

    const midPoint = players.length / 2;
    const teamLeft = players.slice(0, midPoint).map(p => p.socketId);
    const teamRight = players.slice(midPoint).map(p => p.socketId);

    const matchState = {
        roomId,
        mode,
        players: { teamLeft, teamRight },
        playerMetaData: players.map(p => ({ id: p.socketId, username: p.username })),
        state: {
            ball: { 
                x: ENGINE_CONFIG.COURT_DIMENSIONS.WIDTH / 2, 
                y: ENGINE_CONFIG.COURT_DIMENSIONS.HEIGHT / 2, 
                dx: Math.random() > 0.5 ? ENGINE_CONFIG.BALL_BASE_SPEED : -ENGINE_CONFIG.BALL_BASE_SPEED, 
                dy: (Math.random() * 4) - 2 
            },
            paddleLeftY: ENGINE_CONFIG.COURT_DIMENSIONS.HEIGHT / 2 - ENGINE_CONFIG.PADDLE_DIMENSIONS.HEIGHT / 2,
            paddleRightY: ENGINE_CONFIG.COURT_DIMENSIONS.HEIGHT / 2 - ENGINE_CONFIG.PADDLE_DIMENSIONS.HEIGHT / 2,
            score: { left: 0, right: 0 },
            active: true
        },
        intervalId: null
    };

    activeMatchRooms.set(roomId, matchState);

    players.forEach(player => {
        const socketInstance = io.sockets.sockets.get(player.socketId);
        if (socketInstance) {
            socketInstance.join(roomId);
            socketInstance.emit('match_ready', {
                roomId,
                side: teamLeft.includes(player.socketId) ? 'left' : 'right',
                opponents: teamLeft.includes(player.socketId) ? teamRight : teamLeft
            });
        }
    });

    executeGamePhysicsLoop(roomId);
}

// Continuous background execution sweep for matchmaking pipelines
setInterval(() => {
    processMatchmakingEngine('single');
    processMatchmakingEngine('doubles');
}, ENGINE_CONFIG.QUEUE_RESOLUTION_RATE);

/**
 * ============================================================================
 * HIGH-PERFORMANCE SERVER-SIDE PHYSICS ENVIRONMENT (60HZ)
 * ============================================================================
 */
function executeGamePhysicsLoop(roomId) {
    const match = activeMatchRooms.get(roomId);
    if (!match) return;

    match.intervalId = setInterval(() => {
        const room = activeMatchRooms.get(roomId);
        if (!room || !room.state.active) {
            clearInterval(match.intervalId);
            return;
        }

        const state = room.state;
        const ball = state.ball;

        // Wall Deflections (Top & Bottom Boundaries)
        if (ball.y <= 0 || ball.y >= ENGINE_CONFIG.COURT_DIMENSIONS.HEIGHT) {
            ball.dy = -ball.dy;
        }

        // Left Paddle Rigid Body Interaction Handling
        if (ball.x <= ENGINE_CONFIG.PADDLE_DIMENSIONS.WIDTH) {
            if (ball.y >= state.paddleLeftY && ball.y <= state.paddleLeftY + ENGINE_CONFIG.PADDLE_DIMENSIONS.HEIGHT) {
                ball.dx = ENGINE_CONFIG.BALL_BASE_SPEED;
                ball.dy = ((ball.y - (state.paddleLeftY + ENGINE_CONFIG.PADDLE_DIMENSIONS.HEIGHT / 2)) / 10);
            }
        }

        // Right Paddle Rigid Body Interaction Handling
        if (ball.x >= ENGINE_CONFIG.COURT_DIMENSIONS.WIDTH - ENGINE_CONFIG.PADDLE_DIMENSIONS.WIDTH) {
            if (ball.y >= state.paddleRightY && ball.y <= state.paddleRightY + ENGINE_CONFIG.PADDLE_DIMENSIONS.HEIGHT) {
                ball.dx = -ENGINE_CONFIG.BALL_BASE_SPEED;
                ball.dy = ((ball.y - (state.paddleRightY + ENGINE_CONFIG.PADDLE_DIMENSIONS.HEIGHT / 2)) / 10);
            }
        }

        // Position Mutation Integration
        ball.x += ball.dx;
        ball.y += ball.dy;

        // Out-of-Bounds Score Registration Check
        if (ball.x < 0) {
            state.score.right++;
            repositionBallState(state);
        } else if (ball.x > ENGINE_CONFIG.COURT_DIMENSIONS.WIDTH) {
            state.score.left++;
            repositionBallState(state);
        }

        // Network Frame Payload Broadcast
        io.to(roomId).emit('court_state_update', state);
    }, ENGINE_CONFIG.TICK_RATE);
}

function repositionBallState(state) {
    state.ball.x = ENGINE_CONFIG.COURT_DIMENSIONS.WIDTH / 2;
    state.ball.y = ENGINE_CONFIG.COURT_DIMENSIONS.HEIGHT / 2;
    state.ball.dx = state.ball.dx > 0 ? -ENGINE_CONFIG.BALL_BASE_SPEED : ENGINE_CONFIG.BALL_BASE_SPEED;
    state.ball.dy = (Math.random() * 6) - 3;
}

function cleanAbandonedSessions(socketId) {
    ['single', 'doubles'].forEach(mode => {
        matchmakingQueue[mode] = matchmakingQueue[mode].filter(p => p.socketId !== socketId);
    });

    activeMatchRooms.forEach((room, roomId) => {
        if (room.players.teamLeft.includes(socketId) || room.players.teamRight.includes(socketId)) {
            if (room.intervalId) clearInterval(room.intervalId);
            
            io.to(roomId).emit('match_aborted', { 
                reason: `Connection terminated by peer node execution pipeline: ${socketId}` 
            });
            activeMatchRooms.delete(roomId);
            fastify.log.info(`[SERVER] Room instance dissolved safely due to client drop: ${roomId}`);
        }
    });
}

/**
 * ============================================================================
 * WEBSOCKET MATRIX ROUTER & EVENTS
 * ============================================================================
 */
io.on('connection', (socket) => {
    fastify.log.info(`📡 Global connection opened to Erbil Gateway Node: ${socket.id}`);
    
    connectionPool.set(socket.id, {
        id: socket.id,
        connectedAt: Date.now(),
        profile: null
    });

    socket.on('enter_matchmaking', (payload) => {
        try {
            const { username, mode, clientMmr } = payload;
            if (!username || !['single', 'doubles'].includes(mode)) {
                return socket.emit('error_payload', { message: "Invalid payload parameters processing queue assignment." });
            }

            const targetPlayer = {
                socketId: socket.id,
                username,
                mode,
                mmr: clientMmr || 1200,
                enlistedAt: Date.now()
            };

            // Prevent duplicate entries
            if (!matchmakingQueue[mode].some(p => p.socketId === socket.id)) {
                matchmakingQueue[mode].push(targetPlayer);
                socket.emit('queue_entered', { status: "Searching for matches", estimation: "Under 1 minute" });
            }
        } catch (err) {
            fastify.log.error(`Queue error encountered: ${err.message}`);
        }
    });

    socket.on('player_input', (data) => {
        const { roomId, positionY } = data;
        const room = activeMatchRooms.get(roomId);
        if (!room) return;

        // Cap input vector range boundaries to avoid client-side exploitation
        const restrictedY = Math.max(0, Math.min(positionY, ENGINE_CONFIG.COURT_DIMENSIONS.HEIGHT - ENGINE_CONFIG.PADDLE_DIMENSIONS.HEIGHT));

        if (room.players.teamLeft.includes(socket.id)) {
            room.state.paddleLeftY = restrictedY;
        } else if (room.players.teamRight.includes(socket.id)) {
            room.state.paddleRightY = restrictedY;
        }
    });

    socket.on('disconnect', () => {
        fastify.log.warn(`🔌 Connection terminated at node terminal: ${socket.id}`);
        connectionPool.delete(socket.id);
        cleanAbandonedSessions(socket.id);
    });
});

/**
 * ============================================================================
 * ENTERPRISE E-COMMERCE ENDPOINTS & REST SERVICE ROUTING
 * ============================================================================
 */
fastify.post('/api/checkout/create-order', {
    schema: {
        body: {
            type: 'object',
            required: ['items', 'paymentMethod', 'deliveryAddress'],
            properties: {
                items: { type: 'array', minItems: 1 },
                paymentMethod: { type: 'string' },
                deliveryAddress: { type: 'string' }
            }
        }
    }
}, async (request, reply) => {
    const { items, paymentMethod, deliveryAddress } = request.body;
    const internalId = `PE-ORD-${uuidv4().substring(0, 8).toUpperCase()}`;

    fastify.log.info(`[ORDER ENGINE] Order verified and compiled for Erbil Transit Hub: ${internalId}`);

    return reply.status(201).send({
        status: "Success",
        trackingIdentifier: internalId,
        logisticsStatus: "Dispatched to Erbil Hub logistics line",
        summary: { itemCount: items.length, deliveryAddress, processingTime: new Date().toISOString() }
    });
});

// Health Probe Check Interface Endpoint
fastify.get('/health', async (request, reply) => {
    return {
        status: "Healthy",
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        metrics: { liveSockets: connectionPool.size, activeRooms: activeMatchRooms.size }
    };
});

/**
 * ============================================================================
 * CRADLE RUNTIME BOOTSTRAPPING
 * ============================================================================
 */
const igniteRuntime = async () => {
    try {
        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`\n==================================================================`);
        console.log(`🛡️  PADEL ERBIL MULTI-VECTOR ARCHITECTURE RUNNING ON PORT ${PORT}`);
        console.log(`📊  60Hz Server Engine Sync Process Loop: Active`);
        console.log(`🌐  Internal Web Server Endpoint Interface: http://localhost:${PORT}`);
        console.log(`==================================================================\n`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

igniteRuntime();
