import { knex } from '../db.js';

/**
 * Cleanup Duplicate Cards Script
 * 
 * Finds and merges duplicate cards in user_cards table.
 * Duplicates are identified by: user_id + scryfall_id + set_code + collector_number + finish
 * 
 * Usage:
 *   node scripts/cleanup-duplicates.js --dry-run   # Preview changes
 *   node scripts/cleanup-duplicates.js             # Apply changes
 */

const DRY_RUN = process.argv.includes('--dry-run');

async function findDuplicates() {
    console.log('\n=== Finding Duplicate Cards ===\n');

    // Find all groups of duplicate cards
    const duplicates = await knex('user_cards')
        .select(
            'user_id',
            'scryfall_id',
            'set_code',
            'collector_number',
            'finish',
            knex.raw('array_agg(id ORDER BY id) as ids'),
            knex.raw('array_agg(count) as counts'),
            knex.raw('array_agg(tags) as tag_arrays'),
            knex.raw('array_agg(deck_id) as deck_ids'),
            knex.raw('COUNT(*) as duplicate_count'),
            knex.raw('MIN(name) as name')
        )
        .whereNull('deck_id') // Only process binder cards
        .groupBy('user_id', 'scryfall_id', 'set_code', 'collector_number', 'finish')
        .having(knex.raw('COUNT(*)'), '>', 1);

    console.log(`Found ${duplicates.length} groups of duplicates\n`);

    return duplicates;
}

async function mergeDuplicates(duplicateGroups) {
    let totalMerged = 0;
    let totalDeleted = 0;

    console.log('\n=== Processing Duplicates ===\n');

    for (const group of duplicateGroups) {
        const ids = group.ids;
        const counts = group.counts;
        const tagArrays = group.tag_arrays;
        const keepId = ids[0]; // Keep the oldest (lowest ID)
        const deleteIds = ids.slice(1);

        // Calculate merged values
        const totalCount = counts.reduce((sum, c) => sum + (c || 1), 0);

        // Merge tags (deduplicate)
        const allTags = new Set();
        tagArrays.forEach(tagStr => {
            try {
                const tags = JSON.parse(tagStr || '[]');
                tags.forEach(tag => allTags.add(tag));
            } catch (e) {
                // Skip invalid JSON
            }
        });
        const mergedTags = Array.from(allTags);

        console.log(`\nMerging: ${group.name} (${group.set_code} #${group.collector_number})`);
        console.log(`  Finish: ${group.finish}`);
        console.log(`  User ID: ${group.user_id}`);
        console.log(`  ${ids.length} duplicates found`);
        console.log(`  Keep ID: ${keepId}`);
        console.log(`  Delete IDs: ${deleteIds.join(', ')}`);
        console.log(`  Total count: ${totalCount} (from ${counts.join(' + ')})`);
        console.log(`  Merged tags: ${mergedTags.length > 0 ? mergedTags.join(', ') : 'none'}`);

        if (!DRY_RUN) {
            try {
                await knex.transaction(async (trx) => {
                    // Update the kept record
                    await trx('user_cards')
                        .where({ id: keepId })
                        .update({
                            count: totalCount,
                            tags: JSON.stringify(mergedTags)
                        });

                    // Delete the duplicates
                    await trx('user_cards')
                        .whereIn('id', deleteIds)
                        .del();
                });

                totalMerged++;
                totalDeleted += deleteIds.length;
                console.log(`  ✓ Merged successfully`);
            } catch (err) {
                console.error(`  ✗ Error merging: ${err.message}`);
            }
        } else {
            console.log(`  [DRY RUN] Would merge this group`);
        }
    }

    return { totalMerged, totalDeleted };
}

async function main() {
    try {
        console.log('\n' + ('='.repeat(60)));
        console.log('  DUPLICATE CARD CLEANUP SCRIPT');
        console.log('  Mode: ' + (DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE (will modify database)'));
        console.log('='.repeat(60));

        const duplicateGroups = await findDuplicates();

        if (duplicateGroups.length === 0) {
            console.log('\n✓ No duplicates found! Database is clean.\n');
            process.exit(0);
        }

        const { totalMerged, totalDeleted } = await mergeDuplicates(duplicateGroups);

        console.log('\n' + ('='.repeat(60)));
        console.log('  SUMMARY');
        console.log('='.repeat(60));
        if (DRY_RUN) {
            console.log(`\n  ${duplicateGroups.length} groups would be merged`);
            console.log(`  ${duplicateGroups.reduce((sum, g) => sum + g.ids.length - 1, 0)} duplicate records would be deleted`);
            console.log('\n  Run without --dry-run to apply changes\n');
        } else {
            console.log(`\n  ✓ ${totalMerged} groups merged`);
            console.log(`  ✓ ${totalDeleted} duplicate records deleted\n`);
        }

        process.exit(0);
    } catch (err) {
        console.error('\n✗ Error:', err);
        process.exit(1);
    }
}

main();
