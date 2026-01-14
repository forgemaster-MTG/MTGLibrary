import express from 'express';
import { knex } from '../db.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/matches/stats/me
 * Returns personal stats: Total Games, Wins, Win Rate, Recent Trend
 */
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // Total Games
        const totalGames = await knex('match_participants')
            .where('user_id', userId)
            .count('id as count')
            .first();

        const count = parseInt(totalGames.count, 10);

        if (count === 0) {
            return res.json({
                total_games: 0,
                wins: 0,
                win_rate: 0,
                most_played_deck: null
            });
        }

        // Wins
        const wins = await knex('match_participants')
            .join('matches', 'match_participants.match_id', 'matches.id')
            .where('match_participants.user_id', userId)
            .andWhere(knex.raw('matches.winner_id = match_participants.user_id'))
            .count('match_participants.id as count')
            .first();

        const winCount = parseInt(wins.count, 10);

        // Most Played Deck
        const topDeck = await knex('match_participants')
            .where('user_id', userId)
            .select('deck_id')
            .count('deck_id as Count')
            .groupBy('deck_id')
            .orderBy('Count', 'desc')
            .first();

        let deckName = 'N/A';
        if (topDeck && topDeck.deck_id) {
            const d = await knex('user_decks').where('id', topDeck.deck_id).first();
            if (d) deckName = d.name;
        }

        res.json({
            total_games: count,
            wins: winCount,
            win_rate: count > 0 ? Math.round((winCount / count) * 100) : 0,
            most_played_deck: deckName
        });

    } catch (err) {
        console.error('[match_stats] me error', err);
        res.status(500).json({ error: 'db error' });
    }
});

export default router;
