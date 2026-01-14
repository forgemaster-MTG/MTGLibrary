// In-memory store for game states (replace with Redis/DB for production)
// Map<roomId, { 
//   pin: string, 
//   hostId: string, 
//   players: Map<socketId, { name, life, commanderDamage, counters }> 
//   turnOrder: socketId[]
//   activePlayerIndex: number
// }>
const games = new Map();

export const setupGameHandler = (io, socket) => {

    // Helper to get room by PIN
    const getRoomByPin = (pin) => {
        for (const [roomId, game] of games.entries()) {
            if (game.pin === pin) return roomId;
        }
        return null;
    };

    // Helper to broadcast full game state
    const broadcastGameState = (roomId) => {
        const game = games.get(roomId);
        if (!game) return;

        io.to(roomId).emit('game-state-update', {
            players: Array.from(game.players.values()),
            activePlayerId: game.turnOrder[game.activePlayerIndex],
            turnCount: game.turnCount,
            firstPlayerId: game.firstPlayerIndex !== undefined ? game.turnOrder[game.firstPlayerIndex] : null
        });
    };

    // --- Host Events ---

    socket.on('host-game', ({ pin }, callback) => {
        // Generate a simpler room ID than the socket ID if needed, but socket.id works for host ownership
        const roomId = `game-${socket.id}`;

        games.set(roomId, {
            pin,
            hostId: socket.id,
            players: new Map(), // socketId -> playerState
            turnOrder: [],
            activePlayerIndex: 0,
            turnCount: 0,
            firstPlayerIndex: 0,
            startTime: Date.now(),
            logs: [] // Buffer for game logs
        });

        socket.join(roomId);
        console.log(`[Game] Created room ${roomId} with PIN ${pin}`);
        callback({ success: true, roomId });
    });

    // --- Player Events ---

    socket.on('join-game', ({ pin, name, userId, deckId }, callback) => {
        let roomId = getRoomByPin(pin);

        // LAZY CREATE: If pin starts with "pair-" and room doesn't exist, create it on the fly.
        // This supports tournament "Join Game" links where pin = pairingId
        if (!roomId && pin && pin.startsWith('pair-')) {
            roomId = pin; // Use the pairing ID as the room ID
            if (!games.has(roomId)) {
                // Auto-create room
                games.set(roomId, {
                    pin,
                    hostId: null, // No explicit host for auto-created rooms initially
                    players: new Map(),
                    turnOrder: [],
                    activePlayerIndex: 0,
                    turnCount: 0,
                    firstPlayerIndex: 0,
                    startTime: Date.now(),
                    logs: []
                });
                console.log(`[Game] Lazy-created tournament room ${roomId}`);
            }
        }

        if (!roomId) {
            return callback({ success: false, error: 'Invalid PIN' });
        }

        const game = games.get(roomId);

        // Initial Player State
        const playerState = {
            id: socket.id,
            userId: userId || null, // Store registered user ID if available
            name: name || `Player ${game.players.size + 1}`,
            deckId: deckId || null, // Added deckId
            life: 40,
            commanderDamage: {}, // { updatedByPlayerId: amount }
            counters: { poison: 0, energy: 0, experience: 0, commanderTax: 0 },
            isHost: socket.id === game.hostId
        };

        game.players.set(socket.id, playerState);
        game.turnOrder.push(socket.id);

        socket.join(roomId);

        // Notify everyone
        broadcastGameState(roomId);

        console.log(`[Game] ${name} (${socket.id}) joined ${roomId} with Deck ${deckId}`);
        callback({ success: true, roomId, playerId: socket.id });
    });

    socket.on('update-life', ({ roomId, change, absolute }, callback) => {
        const game = games.get(roomId);
        if (!game) return;

        const player = game.players.get(socket.id);
        if (!player) return;

        const oldLife = player.life;
        if (absolute !== undefined) {
            player.life = absolute;
        } else {
            player.life += change;
        }

        // Log the change
        game.logs.push({
            timestamp: Date.now(),
            type: 'life',
            playerId: socket.id,
            change: player.life - oldLife,
            currentLife: player.life,
            turn: game.turnCount || 0
        });

        broadcastGameState(roomId);
    });

    socket.on('update-counters', ({ roomId, type, change }, callback) => {
        const game = games.get(roomId);
        if (!game) return;

        const player = game.players.get(socket.id);
        if (!player) return;

        if (player.counters[type] !== undefined) {
            const oldValue = player.counters[type];
            player.counters[type] += change;

            // Log counter change
            game.logs.push({
                timestamp: Date.now(),
                type: 'counter',
                playerId: socket.id,
                counterType: type,
                change: change,
                newValue: player.counters[type],
                turn: game.turnCount || 0
            });

            broadcastGameState(roomId);
        }
    });

    socket.on('update-commander-damage', ({ roomId, targetId, change }, callback) => {
        const game = games.get(roomId);
        if (!game) return;

        const player = game.players.get(socket.id);
        if (!player) return;

        if (!player.commanderDamage[targetId]) player.commanderDamage[targetId] = 0;
        const oldValue = player.commanderDamage[targetId];
        player.commanderDamage[targetId] += change;

        // Log commander damage change
        game.logs.push({
            timestamp: Date.now(),
            type: 'commander_damage',
            sourceId: targetId, // The commander dealing damage (targetId in this context is the opponent dealing it?) 
            // Wait, the event is 'update-commander-damage' from the player receiving it?
            // Let's check GameRoom.jsx: handleCmdDamageChange(targetId, value)
            // targetId is the opponent ID. 
            // So 'player' is ME (the one tracking damage received).
            // targetId is the SOURCE of the damage (Opponent).
            targetId: socket.id, // I am receiving the damage
            change: change,
            newValue: player.commanderDamage[targetId],
            turn: game.turnCount || 0
        });

        broadcastGameState(roomId);
    });

    socket.on('start-game', ({ roomId, firstPlayerId }) => {
        const game = games.get(roomId);
        if (!game) return;

        // Find index of selected first player
        const firstIndex = game.turnOrder.indexOf(firstPlayerId);
        if (firstIndex !== -1) {
            game.activePlayerIndex = firstIndex;
            game.firstPlayerIndex = firstIndex;
            game.turnCount = 1;

            // Log game start / turn 1
            game.logs.push({
                timestamp: Date.now(),
                type: 'turn',
                turn: 1,
                activePlayerId: firstPlayerId
            });

            broadcastGameState(roomId);
        }
    });

    socket.on('pass-turn', ({ roomId }) => {
        const game = games.get(roomId);
        if (!game) return;

        // Simple turn cycling
        const nextIndex = (game.activePlayerIndex + 1) % game.turnOrder.length;
        game.activePlayerIndex = nextIndex;

        // If we wrapped back to the first player, increment turn count (Round)
        if (nextIndex === game.firstPlayerIndex) {
            game.turnCount = (game.turnCount || 1) + 1;
        }

        // Log turn change
        game.logs.push({
            timestamp: Date.now(),
            type: 'turn',
            turn: game.turnCount,
            activePlayerId: game.turnOrder[game.activePlayerIndex]
        });

        broadcastGameState(roomId);
    });

    socket.on('add-log-note', ({ roomId, note, emoji }) => {
        const game = games.get(roomId);
        if (!game) return;

        game.logs.push({
            timestamp: Date.now(),
            type: 'note',
            playerId: socket.id,
            note: note,
            emoji: emoji || '📝',
            turn: game.turnCount || 0
        });

        // Optional: Broadcast explicitly if we want real-time chat bubbles later
        // For now, state update is enough if logs were part of state (they aren't fully, but we could add them)
        // Actually, log isn't in 'game-state-update' payload currently. 
        // But for "Table Talk" to be useful, maybe we should emit a specific event or include recent logs?
        // Let's just keep it simple: it saves to history. 
        // If we want it visible now, we might need to emit it.
        io.to(roomId).emit('game-log-entry', {
            roomId,
            entry: game.logs[game.logs.length - 1]
        });
    });

    socket.on('end-game', ({ roomId }) => {
        const game = games.get(roomId);
        if (!game) return;

        io.to(roomId).emit('game-over', {
            finalState: {
                players: Array.from(game.players.values()),
                durationSeconds: Math.floor((Date.now() - game.startTime) / 1000),
                startedAt: new Date(game.startTime).toISOString(),
                endedAt: new Date().toISOString(),
                logs: game.logs // Send logs to frontend
            }
        });
    });

    // --- Cleanup ---
    socket.on('disconnect', () => {
        for (const [roomId, game] of games.entries()) {
            if (game.players.has(socket.id)) {
                console.log(`[Game] Player ${socket.id} disconnected from ${roomId}`);
            }
        }
    });
};
