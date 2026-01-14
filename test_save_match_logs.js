// Test script for match logs

async function testMatchLogging() {
    const API_URL = 'http://localhost:3006/api';

    // 1. Create a dummy match payload with logs
    // We need valid user IDs? Or use null for guests.
    // Let's use guest names to avoid needing real users.

    // Mock Players
    const players = [
        {
            guestName: 'Hero',
            placement: 1,
            life: 25,
            socketId: 'socket-hero-123', // Mock Socket ID
            deckId: null
        },
        {
            guestName: 'Villain',
            placement: 2,
            life: 0,
            socketId: 'socket-villain-456', // Mock Socket ID
            deckId: null
        }
    ];

    // Mock Logs (tied to socket IDs)
    const logs = [
        {
            timestamp: Date.now() - 10000,
            type: 'turn',
            turn: 1,
            activePlayerId: 'socket-hero-123'
        },
        {
            timestamp: Date.now() - 9000,
            type: 'life',
            playerId: 'socket-hero-123',
            change: -2,
            currentLife: 38,
            turn: 1
        },
        {
            timestamp: Date.now() - 8000,
            type: 'turn',
            turn: 2,
            activePlayerId: 'socket-villain-456'
        },
        {
            timestamp: Date.now() - 7000,
            type: 'life',
            playerId: 'socket-villain-456',
            change: -40, // Ouch
            currentLife: 0,
            turn: 2
        }
    ];

    const payload = {
        roomId: `test-room-${Date.now()}`,
        startedAt: new Date(Date.now() - 60000).toISOString(),
        endedAt: new Date().toISOString(),
        winnerId: null, // Guest winner
        players: players,
        logs: logs
    };

    console.log('Sending Payload:', JSON.stringify(payload, null, 2));

    try {
        const res = await fetch(`${API_URL}/matches`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        console.log('Save Response:', data);

        if (data.success) {
            console.log('Match Saved! Accessing Logs...');
            const matchId = data.matchId;

            // 2. Fetch Logs to verify
            const logsRes = await fetch(`${API_URL}/matches/${matchId}/logs`);
            const logsData = await logsRes.json();
            console.log(`Fetched ${logsData.length} logs for match ${matchId}`);
            console.log(logsData);

            if (logsData.length === 4) {
                console.log('SUCCESS: All logs retrieved.');
            } else {
                console.error('FAILURE: Log count mismatch.');
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

testMatchLogging();
