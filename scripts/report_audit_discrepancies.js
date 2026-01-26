import fs from 'fs';
import path from 'path';
import { knex } from '../server/db.js';
import admin from '../server/firebaseAdmin.js';

async function generateReport() {
    console.log('--- Audit Discrepancy Reporter ---');
    const report = {
        generated_at: new Date().toISOString(),
        users_checked: 0,
        discrepancies_found: 0,
        details: []
    };

    try {
        // 1. Find recent audit users (36 hours)
        const cutoff = knex.raw("NOW() - INTERVAL '36 HOURS'");
        const sessions = await knex('audit_sessions')
            .where('ended_at', '>=', cutoff)
            .where({ status: 'completed' })
            .select('user_id', 'id as session_id', 'ended_at');

        if (sessions.length === 0) {
            console.log('No recent audits found.');
            process.exit(0);
        }

        const userIds = [...new Set(sessions.map(s => s.user_id))];
        console.log(`Found ${sessions.length} sessions for ${userIds.length} users. Analyzing...`);

        // 2. Analyze each user
        for (const userId of userIds) {
            console.log(`Analyzing User ${userId}...`);
            const userDiff = await analyzeUser(userId);

            if (userDiff) {
                report.details.push(userDiff);
                if (userDiff.stats.total_discrepancies > 0) {
                    report.discrepancies_found += userDiff.stats.total_discrepancies;
                }
            }
            report.users_checked++;
        }

        // 3. Save Report
        const filename = `audit_discrepancies_${Date.now()}.json`;
        const outputPath = path.resolve(process.cwd(), filename);
        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

        console.log('\n------------------------------------------------');
        console.log(`Report Generated: ${filename}`);
        console.log(`Users Checked: ${report.users_checked}`);
        console.log(`Total Discrepancies: ${report.discrepancies_found}`);
        console.log('------------------------------------------------');

        process.exit(0);

    } catch (err) {
        console.error('Report generation failed:', err);
        process.exit(1);
    }
}

async function analyzeUser(userId) {
    try {
        const user = await knex('users').where({ id: userId }).first();
        if (!user || !user.firestore_id) {
            console.warn(`[User ${userId}] Skipped: No firestore_id.`);
            return null;
        }

        // A. Postgres Data (Source of Truth)
        const pgCards = await knex('user_cards').where({ user_id: userId });
        const pgMap = new Map();
        pgCards.forEach(c => pgMap.set(String(c.id), c));

        // B. Firestore Data
        const collectionRef = admin.firestore().collection('users').doc(user.firestore_id).collection('collection');
        const snapshot = await collectionRef.get();
        const fsMap = new Map();
        snapshot.docs.forEach(d => fsMap.set(d.id, d.data()));

        // C. Compare
        const discrepancies = {
            missing_in_firestore: [],
            extra_in_firestore: [],
            data_mismatch: []
        };

        // Check PG against FS
        for (const [id, pgCard] of pgMap) {
            if (!fsMap.has(id)) {
                discrepancies.missing_in_firestore.push({
                    id,
                    name: pgCard.card_name,
                    set: pgCard.set_code
                });
            } else {
                // Optional: Deep compare logic here if needed
                // For now, existence is the primary concern
                const fsCard = fsMap.get(id);
                // Example: Check quantity matches if logic allows, but user_cards are usually single rows per instance 
                // unless quantity column is used. The current schema seems to imply row-per-card or uses quantity?
                // Looking at `upload` logic earlier: `quantity` col exists.
                if (pgCard.quantity !== fsCard.quantity) {
                    discrepancies.data_mismatch.push({
                        id,
                        name: pgCard.card_name,
                        pg_qty: pgCard.quantity,
                        fs_qty: fsCard.quantity
                    });
                }
            }
        }

        // Check FS against PG (Orphans)
        for (const [id, fsCard] of fsMap) {
            if (!pgMap.has(id)) {
                discrepancies.extra_in_firestore.push({
                    id,
                    name: fsCard.card_name || fsCard.name,
                    set: fsCard.set_code || fsCard.set
                });
            }
        }

        return {
            user_id: userId,
            firestore_id: user.firestore_id,
            stats: {
                pg_count: pgCards.length,
                fs_count: snapshot.size,
                missing_in_fs: discrepancies.missing_in_firestore.length,
                extra_in_fs: discrepancies.extra_in_firestore.length,
                mismatches: discrepancies.data_mismatch.length,
                total_discrepancies:
                    discrepancies.missing_in_firestore.length +
                    discrepancies.extra_in_firestore.length +
                    discrepancies.data_mismatch.length
            },
            discrepancies
        };

    } catch (e) {
        console.error(`[User ${userId}] Error analyzing: ${e.message}`);
        return { user_id: userId, error: e.message, stats: { total_discrepancies: 0 } };
    }
}

generateReport();
