import express from 'express';
import { knex } from '../db.js';

const router = express.Router();

// GET /api/matches/user/:userId - Get match history with opponents
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        // 1. Get all match IDs where user participated
        const myMatches = await knex('match_participants')
            .where('user_id', userId)
            .select('match_id', 'placement', 'deck_id', 'life_remaining');

        if (myMatches.length === 0) {
            return res.json([]);
        }

        const matchIds = myMatches.map(m => m.match_id);

        // 2. Fetch match details with room_id
        const matches = await knex('matches')
            .whereIn('id', matchIds)
            .orderBy('ended_at', 'desc')
            .limit(50);

        // 3. Fetch all participants for these matches to link opponents
        const allParticipants = await knex('match_participants')
            .whereIn('match_id', matchIds)
            .leftJoin('users', 'users.id', 'match_participants.user_id')
            .leftJoin('user_decks', 'user_decks.id', 'match_participants.deck_id')
            .select(
                'match_participants.*',
                'users.username',
                'user_decks.name as deck_name',
                'user_decks.commander as deck_commander'
            );

        // 4. Combine data
        const history = matches.map(match => {
            const participants = allParticipants.filter(p => p.match_id === match.id);
            const myParticipant = participants.find(p => p.user_id == userId); // loose check for string/int

            // Filter opponents (everyone else)
            const opponents = participants.filter(p => p.user_id != userId).map(p => ({
                participant_id: p.id, // Needed for linking logs
                name: p.username || p.guest_name || 'Guest',
                deck_name: p.deck_name,
                commander: p.deck_commander,
                placement: p.placement
            }));

            // Get my deck details
            const myDeck = myParticipant ? {
                participant_id: myParticipant.id, // Needed for linking logs
                name: myParticipant.deck_name,
                commander: myParticipant.deck_commander
            } : null;

            return {
                match_id: match.id,
                started_at: match.started_at,
                ended_at: match.ended_at,
                duration_seconds: match.duration_seconds,
                winner_id: match.winner_id,
                my_participant_id: myDeck?.participant_id, // Explicit top level
                placement: myParticipant?.placement,
                deck_name: myDeck?.name,
                deck_commander: myDeck?.commander,
                opponents
            };
        });

        res.json(history);
    } catch (error) {
        console.error('Error fetching matches:', error);
        res.status(500).json({ error: 'Failed to fetch match history' });
    }
});

// POST /api/matches - Record a finished match
router.post('/', async (req, res) => {
    const { winnerId, startedAt, endedAt, players, roomId } = req.body;
    // players: [{ userId (opt), guestName (opt), deckId (opt), placement, life }]

    const trx = await knex.transaction();

    try {
        // 1. Check for existing match with this unique room_id
        if (roomId) {
            const existingMatch = await trx('matches').where({ room_id: roomId }).first();
            if (existingMatch) {
                await trx.commit();
                return res.json({ success: true, matchId: existingMatch.id, message: 'Match linked to existing record' });
            }
        }

        const durationSeconds = Math.floor((new Date(endedAt) - new Date(startedAt)) / 1000);

        const [match] = await trx('matches').insert({
            room_id: roomId || null, // Create new match linked to room
            winner_id: winnerId || null,
            started_at: startedAt,
            ended_at: endedAt,
            duration_seconds: durationSeconds,
            status: 'completed'
        }).returning('*');

        const participantsData = players.map(p => ({
            match_id: match.id,
            user_id: p.userId || null,
            deck_id: p.deckId || null, // Saved from game state
            guest_name: p.guestName || null,
            placement: p.placement,
            life_remaining: p.life || 0,
            _socketId: p._socketId // Temporary for log mapping, won't be saved to DB if not in schema? Wait, we need to be careful.
        }));

        // We need to know which participant ID corresponds to which socket ID to link logs
        // So we insert one by one or return all IDs. 
        // knex .insert().returning('*') returns array of inserted.
        // We'll trust the order if we pass array? No, unsafe. 
        // Better: Fetch created participants after insert? Or map manually.
        // Let's rely on returning('*') matching the insert array order or map by user_id/guest_name combination if possible. 
        // Actually, for this simple case, we can iterate.

        const participantMap = new Map(); // socketId -> participantUUID

        // Insert participants and build map
        // Note: We can't insert "_socketId" column as it doesn't exist.
        // So we strip it for insert, but keep reference.

        for (let i = 0; i < participantsData.length; i++) {
            const p = participantsData[i];
            const socketId = players[i].socketId; // We need socketId passed from frontend in `players` array!!

            const [insertedP] = await trx('match_participants').insert({
                match_id: match.id,
                user_id: p.user_id,
                deck_id: p.deck_id,
                guest_name: p.guest_name,
                placement: p.placement,
                life_remaining: p.life_remaining
            }).returning('id');

            if (socketId) {
                participantMap.set(socketId, insertedP.id);
            }
        }

        // Process Logs
        if (req.body.logs && Array.isArray(req.body.logs)) {
            const logRows = req.body.logs.map(log => ({
                match_id: match.id,
                actor_participant_id: participantMap.get(log.playerId) || null,
                action_type: log.type,
                value: log.change || 0,
                created_at: new Date(log.timestamp),
                metadata: {
                    turn: log.turn,
                    currentLife: log.currentLife,
                    activePlayerId: log.activePlayerId
                }
            }));

            if (logRows.length > 0) {
                await trx('match_logs').insert(logRows);
            }
        }

        await trx.commit();
        res.json({ success: true, matchId: match.id });
    } catch (error) {
        await trx.rollback();
        // If race condition caused duplicate key error on room_id, ignore it and return success
        if (error.code === '23505') { // Postgres unique violation
            return res.json({ success: true, message: 'Match already handled by another client' });
        }
        console.error('Error recording match:', error);
        res.status(500).json({ error: 'Failed to record match', details: error.message });
    }
});

// DELETE /api/matches/user/:userId - Clear all matches for a user
router.delete('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        // Find all matches where user participated
        const matches = await knex('match_participants')
            .where({ user_id: userId })
            .select('match_id');
        const matchIds = matches.map(m => m.match_id);

        if (matchIds.length > 0) {
            // Delete participants first (cascade logic manual)
            await knex('match_participants').whereIn('match_id', matchIds).del();
            // Delete matches
            await knex('matches').whereIn('id', matchIds).del();
        }

        res.json({ success: true, count: matchIds.length });
    } catch (error) {
        console.error('Error clearing history:', error);
        res.status(500).json({ error: 'Failed to clear history' });
    }
});

// DELETE /api/matches/:id - Delete a specific match
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Manual cascade deletion just in case
        await knex('match_participants').where({ match_id: id }).del();
        await knex('matches').where({ id }).del();

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting match:', error);
        res.status(500).json({ error: 'Failed to delete match' });
    }
});

// GET /api/matches/:id/logs - Get match logs for replay/charts
router.get('/:id/logs', async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch logs
        const logs = await knex('match_logs')
            .where('match_id', id)
            .orderBy('created_at', 'asc');

        // We also need participant mapping to know who did what
        // The logs use `actor_participant_id`. Currently we might need to map back to user/deck.
        // But for the Graph, we just need to know which "Player" it corresponds to in the participant list.

        res.json(logs);
    } catch (error) {
        console.error('Error fetching match logs:', error);
        res.status(500).json({ error: 'Failed to fetch match logs' });
    }
});

export default router;
