import express from 'express';
import { knex } from '../db.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/social/feed
 * Returns recent activity (matches) from friends.
 */
router.get('/feed', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Get List of Friend IDs
        const friendships = await knex('friendships')
            .where(function () {
                this.where({ user_id_1: userId, status: 'accepted' })
                    .orWhere({ user_id_2: userId, status: 'accepted' });
            })
            .select('user_id_1', 'user_id_2');

        const friendIds = friendships.map(f => f.user_id_1 === userId ? f.user_id_2 : f.user_id_1);

        // Add self to feed? Optional. Let's include self for now so the feed isn't empty.
        friendIds.push(userId);

        if (friendIds.length === 0) return res.json([]);

        // 2. Fetch recent matches involving these users
        // We join match_participants to filter by user_id
        const recentMatches = await knex('matches')
            .join('match_participants', 'matches.id', 'match_participants.match_id')
            .whereIn('match_participants.user_id', friendIds)
            .andWhere('matches.ended_at', '>', knex.raw("NOW() - INTERVAL '7 days'")) // Last 7 days
            .select(
                'matches.id',
                'matches.ended_at',
                'matches.winner_id',
                'match_participants.user_id',
                'match_participants.deck_id',
                'match_participants.placement'
            )
            .orderBy('matches.ended_at', 'desc')
            .limit(20);

        // Deduplicate matches (since multiple friends might be in the same match)
        // and enrich with user details.

        // Actually, the above query returns one row per participant.
        // We want unique MATCHES, but we want to know WHICH friend participated.
        // Pivot: Get unique Match IDs first.

        const uniqueMatchIds = [...new Set(recentMatches.map(m => m.id))];

        // Fetch full match details for these IDs
        // This is getting complex for a detailed feed. 
        // Simplified approach: Just list "X played a game with Y, Z"

        // Let's use the 'matches' table directly if we can filter by participant.
        // Knex doesn't have a simple "where exists" helper that is concise here.

        // Better query:
        const feedMatches = await knex('matches')
            .whereIn('id', uniqueMatchIds)
            .orderBy('ended_at', 'desc');

        // Fetch participants for these matches to display names
        const matchParticipants = await knex('match_participants')
            .join('users', 'match_participants.user_id', 'users.id')
            .whereIn('match_id', uniqueMatchIds)
            .select('match_participants.*', 'users.username'); // avatar_url does not exist

        // Retrieve Deck Names (optional, if we want "Played [Deck Name]")
        const deckIds = matchParticipants.map(p => p.deck_id).filter(id => id);
        const decks = await knex('user_decks').whereIn('id', deckIds).select('id', 'name', 'commander');
        const deckMap = decks.reduce((acc, d) => ({ ...acc, [d.id]: d }), {});

        // Assemble Feed Items
        const feed = feedMatches.map(match => {
            const participants = matchParticipants.filter(p => p.match_id === match.id);
            // Determine winner based on match winner_id or placement === 1
            const winner = participants.find(p => p.user_id === match.winner_id || p.placement === 1);

            return {
                id: match.id,
                date: match.ended_at,
                participants: participants.map(p => {
                    const isWinner = (match.winner_id && p.user_id === match.winner_id) || p.placement === 1;
                    return {
                        username: p.username,
                        userId: p.user_id,
                        outcome: isWinner ? 'win' : 'loss',
                        deck: deckMap[p.deck_id] ? deckMap[p.deck_id].name : 'Unknown Deck',
                        commander: deckMap[p.deck_id] ? deckMap[p.deck_id].commander : null
                    };
                }),
                winner: winner ? winner.username : 'Draw'
            };
        });

        res.json(feed);

    } catch (err) {
        console.error('[social] feed error details:', err);
        console.error('[social] feed error stack:', err.stack);
        res.status(500).json({ error: 'db error', details: err.message });
    }
});

/**
 * GET /api/social/leaderboard
 * Weekly leaderboard: Wins, Games Played, Damage Dealt (if tracked?)
 */
router.get('/leaderboard', authMiddleware, async (req, res) => {
    try {
        // Determine start of week (Sunday or Monday)
        // For simplicity, let's just do "Last 7 Days" rolling window, or distinct "This Week"
        // Rolling 7 days is easier.

        const stats = await knex('match_participants')
            .join('matches', 'match_participants.match_id', 'matches.id')
            .join('users', 'match_participants.user_id', 'users.id')
            .where('matches.ended_at', '>', knex.raw("NOW() - INTERVAL '7 days'"))
            .select('users.username', 'users.id as user_id')
            .count('matches.id as games_played')
            .sum({ wins: knex.raw("CASE WHEN matches.winner_id = match_participants.user_id THEN 1 ELSE 0 END") })
            .groupBy('users.id', 'users.username')
            .orderBy('wins', 'desc')
            .limit(10);

        res.json(stats);
    } catch (err) {
        console.error('[social] leaderboard error', err);
        res.status(500).json({ error: 'db error' });
    }
});

export default router;
