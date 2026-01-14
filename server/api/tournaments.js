import express from 'express';
import { knex } from '../db.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// GET / - List my tournaments (organized or participating)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const organized = await knex('tournaments')
            .where('organizer_id', userId)
            .orderBy('created_at', 'desc');

        const participating = await knex('tournaments')
            .join('tournament_participants', 'tournaments.id', 'tournament_participants.tournament_id')
            .where('tournament_participants.user_id', userId)
            .select('tournaments.*')
            .orderBy('tournaments.created_at', 'desc');

        // Merge and dedupe
        const allTournaments = [...organized, ...participating].filter((t, index, self) =>
            index === self.findIndex((t2) => t2.id === t.id)
        );

        res.json(allTournaments);
    } catch (err) {
        console.error('[tournaments] list error:', err);
        res.status(500).json({ error: 'Failed to fetch tournaments' });
    }
});

// POST / - Create a new tournament
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { name, format, settings } = req.body;
        const userId = req.user.id;

        const newTournament = await knex.transaction(async trx => {
            const [tournament] = await trx('tournaments')
                .insert({
                    organizer_id: userId,
                    name: name || 'New Tournament',
                    format: format || 'swiss',
                    status: 'pending',
                    settings: settings || {}
                })
                .returning('*');

            // Automatically add the organizer as a participant
            await trx('tournament_participants').insert({
                tournament_id: tournament.id,
                user_id: userId,
                score: 0
            });

            return tournament;
        });

        res.status(201).json(newTournament);
    } catch (err) {
        console.error('[tournaments] create error:', err);
        res.status(500).json({ error: 'Failed to create tournament' });
    }
});

// GET /:id - Get details, participants, and standings
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const tournament = await knex('tournaments').where({ id }).first();

        if (!tournament) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        const participants = await knex('tournament_participants')
            .leftJoin('users', 'tournament_participants.user_id', 'users.id')
            .where({ tournament_id: id })
            .select(
                'tournament_participants.*',
                'users.username'
            )
            .orderBy('score', 'desc');

        const currentPairings = await knex('tournament_pairings')
            .where({ tournament_id: id, round_number: tournament.current_round });

        const allPairings = await knex('tournament_pairings')
            .where({ tournament_id: id })
            .orderBy('round_number', 'asc')
            .orderBy('table_number', 'asc');

        res.json({
            ...tournament,
            participants,
            currentPairings,
            allPairings
        });

    } catch (err) {
        console.error('[tournaments] get error:', err);
        res.status(500).json({ error: 'Failed to fetch tournament details' });
    }
});

// POST /:id/participants - Add a player (Admin/Organizer)
router.post('/:id/participants', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, guestName, deckId } = req.body; // Provide userId OR guestName

        // Validation: Check if tournament exists and is pending
        const tournament = await knex('tournaments').where({ id }).first();
        if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
        if (tournament.status !== 'pending') return res.status(400).json({ error: 'Cannot add players to active tournament' });

        // Logic to add
        const participantData = {
            tournament_id: id,
            score: 0
        };

        if (userId) {
            participantData.user_id = userId;
        } else if (guestName) {
            participantData.guest_name = guestName;
        } else {
            return res.status(400).json({ error: 'Must provide userId or guestName' });
        }

        if (deckId) {
            const deck = await knex('user_decks').where({ id: deckId }).first();
            if (deck) {
                participantData.deck_id = deckId;
                participantData.deck_snapshot = deck; // Snapshot the entire deck object
            }
        }

        const [participant] = await knex('tournament_participants')
            .insert(participantData)
            .returning('*');

        res.status(201).json(participant);
    } catch (err) {
        console.error('[tournaments] add participant error:', err);
        res.status(500).json({ error: 'Failed to add participant' });
    }
});

// POST /:id/drop - Drop a player
router.post('/:id/drop', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { participantId } = req.body;
        const userId = req.user.id;

        const tournament = await knex('tournaments').where({ id }).first();
        if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

        // Check permissions: Organizer or the player themselves
        const part = await knex('tournament_participants').where({ id: participantId }).first();
        if (!part) return res.status(404).json({ error: 'Participant not found' });

        if (tournament.organizer_id !== userId && part.user_id !== userId) {
            return res.status(403).json({ error: 'Not authorized to drop this player' });
        }

        await knex('tournament_participants')
            .where({ id: participantId })
            .update({ is_active: false });

        res.json({ success: true });
    } catch (err) {
        console.error('[tournaments] drop error:', err);
        res.status(500).json({ error: 'Failed to drop player' });
    }
});

// POST /:id/join - Self-signup
router.post('/:id/join', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { deckId } = req.body;
        const userId = req.user.id;

        const tournament = await knex('tournaments').where({ id }).first();
        if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
        if (tournament.status !== 'pending') return res.status(400).json({ error: 'Tournament is not open for joining' });

        // Check if already joined
        const existing = await knex('tournament_participants')
            .where({ tournament_id: id, user_id: userId })
            .first();

        if (existing) {
            return res.status(400).json({ error: 'You have already joined this tournament' });
        }

        const participantData = {
            tournament_id: id,
            user_id: userId,
            score: 0
        };

        if (deckId) {
            const deck = await knex('user_decks').where({ id: deckId }).first();
            // Validate ownership? Or just existence? Usually ownership or public.
            // For simplicity, checking existence.
            if (deck) {
                participantData.deck_id = deckId;
                participantData.deck_snapshot = deck;
            }
        }

        const [participant] = await knex('tournament_participants')
            .insert(participantData)
            .returning('*');

        res.status(201).json(participant);
    } catch (err) {
        console.error('[tournaments] join error:', err);
        res.status(500).json({ error: 'Failed to join tournament' });
    }
});

// POST /:id/start - Start tournament (Generate Round 1)
router.post('/:id/start', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const tournament = await knex('tournaments').where({ id }).first();

        if (tournament.status !== 'pending') {
            return res.status(400).json({ error: 'Tournament is not pending' });
        }

        const participants = await knex('tournament_participants').where({ tournament_id: id });
        if (participants.length < 2) {
            return res.status(400).json({ error: 'Need at least 2 players' });
        }

        // Filter out dropped players (just in case)
        // Check for is_active flag (which we just added via migration)
        const activeParticipants = participants.filter(p => p.is_active !== false); // default true

        if (activeParticipants.length < 2) {
            return res.status(400).json({ error: 'Need at least 2 active players to start' });
        }

        // Shuffle
        const shuffled = activeParticipants.sort(() => 0.5 - Math.random());
        const pairings = [];

        for (let i = 0; i < shuffled.length; i += 2) {
            if (i + 1 < shuffled.length) {
                pairings.push({
                    tournament_id: id,
                    round_number: 1,
                    player1_id: shuffled[i].id,
                    player2_id: shuffled[i + 1].id,
                    table_number: (i / 2) + 1
                });
            } else {
                // Bye
                pairings.push({
                    tournament_id: id,
                    round_number: 1,
                    player1_id: shuffled[i].id,
                    player2_id: null, // Bye
                    winner_id: shuffled[i].id, // Auto win
                    table_number: (i / 2) + 1
                });
            }
        }

        await knex.transaction(async trx => {
            await trx('tournaments').where({ id }).update({ status: 'active', current_round: 1 });
            await trx('tournament_pairings').insert(pairings);

            // If bye, verify we update score? Or do that at end of round? 
            // usually Bye is automatic point.
            // keeping it simple, admin can "verify" bye if needed, or we auto-calc later.
        });

        res.json({ success: true, round: 1, pairings });

    } catch (err) {
        console.error('[tournaments] start error:', err);
        res.status(500).json({ error: 'Failed to start tournament' });
    }
});

// POST /:id/matches - Report Match Result
router.post('/:id/matches', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { matchId, winnerId, isDraw } = req.body;

        const tournament = await knex('tournaments').where({ id }).first();
        if (!tournament || tournament.status !== 'active') {
            return res.status(400).json({ error: 'Tournament not active' });
        }

        // 1. Get current pairing
        const pairing = await knex('tournament_pairings').where({ id: matchId }).first();
        if (!pairing) return res.status(404).json({ error: 'Match not found' });

        // 2. Prevent double reporting (simplification: if winner_id is already set, maybe allow overwrite? Assuming overwrite for correction)

        await knex.transaction(async trx => {
            // Revert previous score if overwriting
            if (pairing.winner_id || pairing.is_draw) {
                // Logic to revert points:
                // If draw: -1 to both
                // If winner: -3 to winner
                if (pairing.is_draw) {
                    await trx('tournament_participants').whereIn('id', [pairing.player1_id, pairing.player2_id]).decrement('score', 1).decrement('draws', 1);
                } else if (pairing.winner_id) {
                    await trx('tournament_participants').where('id', pairing.winner_id).decrement('score', 3).decrement('wins', 1);
                    // loser?
                    const loserId = pairing.winner_id === pairing.player1_id ? pairing.player2_id : pairing.player1_id;
                    if (loserId) await trx('tournament_participants').where('id', loserId).decrement('losses', 1);
                }
            }

            // 3. Update Pairing
            await trx('tournament_pairings').where({ id: matchId }).update({
                winner_id: isDraw ? null : winnerId,
                is_draw: !!isDraw
            });

            // 4. Update Scores
            if (isDraw) {
                // +1 to both
                await trx('tournament_participants').whereIn('id', [pairing.player1_id, pairing.player2_id]).increment('score', 1).increment('draws', 1);
            } else if (winnerId) {
                // +3 to winner
                await trx('tournament_participants').where('id', winnerId).increment('score', 3).increment('wins', 1);
                // +0 to loser
                const loserId = winnerId === pairing.player1_id ? pairing.player2_id : pairing.player1_id;
                if (loserId) await trx('tournament_participants').where('id', loserId).increment('losses', 1);
            }
        });

        res.json({ success: true });

    } catch (err) {
        console.error('[tournaments] match report error:', err);
        res.status(500).json({ error: 'Failed to report match' });
    }
});

// PUT /:id/pairings/:pairingId - Edit Pairing (Admin Override)
router.put('/:id/pairings/:pairingId', authMiddleware, async (req, res) => {
    try {
        const { id, pairingId } = req.params;
        const { player1Id, player2Id, winnerId, isDraw, tableNumber } = req.body;
        const userId = req.user.id;

        const tournament = await knex('tournaments').where({ id }).first();
        if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
        if (tournament.organizer_id !== userId) return res.status(403).json({ error: 'Only organizer can edit pairings' });

        // Update logic
        const updateData = {};
        if (player1Id !== undefined) updateData.player1_id = player1Id;
        if (player2Id !== undefined) updateData.player2_id = player2Id;
        if (winnerId !== undefined) updateData.winner_id = winnerId;
        if (isDraw !== undefined) updateData.is_draw = isDraw;
        if (tableNumber !== undefined) updateData.table_number = tableNumber;

        await knex('tournament_pairings')
            .where({ id: pairingId, tournament_id: id })
            .update(updateData);

        // Note: Changing players/winners here does NOT automatically recalculate previous round scores if changed retroactively.
        // This is a raw override.

        res.json({ success: true });
    } catch (err) {
        console.error('[tournaments] edit pairing error:', err);
        res.status(500).json({ error: 'Failed to update pairing' });
    }
});

// POST /:id/next-round - Generate Next Round Pairings
router.post('/:id/next-round', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const tournament = await knex('tournaments').where({ id }).first();

        if (!tournament || tournament.status !== 'active') {
            return res.status(400).json({ error: 'Tournament not active' });
        }

        // 1. Check if all matches in current round are finished
        const currentMatches = await knex('tournament_pairings')
            .where({ tournament_id: id, round_number: tournament.current_round });

        const unfinished = currentMatches.some(m => !m.winner_id && !m.is_draw && m.player2_id !== null); // Ignore Byes (player2_id is null, winner set instantly usually, but just in case)

        if (unfinished) {
            return res.status(400).json({ error: 'Current round incomplete' });
        }

        // 2. Determine Participants for Next Round
        let participants;
        const settings = tournament.settings || {};
        const isElimination = tournament.format === 'elimination' || settings.mode === 'elimination';

        // CHECK TARGET POINTS (Swiss)
        if (!isElimination && settings.target_points) {
            const result = await knex('tournament_participants')
                .where({ tournament_id: id })
                .max('score as maxScore')
                .first();

            if (result && result.maxScore >= settings.target_points) {
                await knex('tournaments').where({ id }).update({ status: 'completed' });
                return res.json({ success: true, completed: true });
            }
        }

        // CHECK ROUND LIMIT
        if (settings.total_rounds && tournament.current_round >= settings.total_rounds) {
            await knex('tournaments').where({ id }).update({ status: 'completed' });
            return res.json({ success: true, completed: true });
        }

        if (isElimination) {
            // For Elimination, only take WINNERS from the previous round
            const previousRoundPairings = await knex('tournament_pairings')
                .where({ tournament_id: id, round_number: tournament.current_round });

            const winnerIds = previousRoundPairings.map(p => p.winner_id).filter(Boolean);

            if (winnerIds.length === 0) {
                return res.status(400).json({ error: 'No winners found to advance.' });
            }

            if (winnerIds.length === 1) {
                await knex('tournaments').where({ id }).update({ status: 'completed' });
                return res.json({ success: true, completed: true });
            }

            participants = await knex('tournament_participants')
                .whereIn('id', winnerIds)
                .orderBy('score', 'desc');
        } else {
            // Swiss / Standard
            participants = await knex('tournament_participants')
                .where({ tournament_id: id })
                .orderBy('score', 'desc');
        }

        // Filter dropped players
        const activeParticipants = participants.filter(p => p.is_active !== false);

        // 3. Generate Pairings
        const nextRound = tournament.current_round + 1;
        const pairings = [];
        const pool = [...activeParticipants];

        let table = 1;
        while (pool.length > 0) {
            const p1 = pool.shift();

            if (pool.length > 0) {
                const p2 = pool.shift();
                pairings.push({
                    tournament_id: id,
                    round_number: nextRound,
                    player1_id: p1.id,
                    player2_id: p2.id,
                    table_number: table++
                });
            } else {
                // Bye
                pairings.push({
                    tournament_id: id,
                    round_number: nextRound,
                    player1_id: p1.id,
                    player2_id: null,
                    winner_id: p1.id, // Auto win
                    table_number: table++
                });

                // If elimination, bye means they advance implicitly.
                // We add points to keep score tracking consistent.
                p1.score += 3;
                p1.wins += 1;
            }
        }

        await knex.transaction(async trx => {
            // Update tournament round
            await trx('tournaments').where({ id }).update({ current_round: nextRound });

            // Insert pairings
            await trx('tournament_pairings').insert(pairings.map(p => ({
                tournament_id: p.tournament_id,
                round_number: p.round_number,
                player1_id: p.player1_id,
                player2_id: p.player2_id,
                winner_id: p.winner_id || null,
                table_number: p.table_number
            })));

            // Update Bye scores if any
            const byes = pairings.filter(p => p.player2_id === null);
            for (const bye of byes) {
                await trx('tournament_participants').where({ id: bye.player1_id }).increment('score', 3).increment('wins', 1);
            }
        });

        res.json({ success: true, round: nextRound });

    } catch (err) {
        console.error('[tournaments] next round error:', err);
        res.status(500).json({ error: 'Failed to generate next round' });
    }
});

// DELETE /:id - Delete a tournament
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const tournament = await knex('tournaments').where({ id }).first();
        if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

        if (tournament.organizer_id !== userId) {
            return res.status(403).json({ error: 'Only the organizer can delete this tournament' });
        }

        await knex('tournaments').where({ id }).del();
        res.json({ success: true });
    } catch (err) {
        console.error('[tournaments] delete error:', err);
        res.status(500).json({ error: 'Failed to delete tournament' });
    }
});

export default router;
