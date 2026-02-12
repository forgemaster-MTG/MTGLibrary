import 'dotenv/config';

// Force localhost for local scripts if PGHOST is not set (fixes ENOTFOUND postgres)
if (!process.env.PGHOST) {
    process.env.PGHOST = 'localhost';
}

const { knex } = await import('../server/db.js');

async function run() {
    try {
        console.log('Inserting Release 1.0.3...');
        await knex('releases').insert({
            version: '1.0.3',
            notes: `
                <p><strong>Forge Lens Refined</strong></p>
                <ul>
                    <li><strong>Color Feed:</strong> Removed the grayscale filter from Forge Lens for a more natural scanning experience.</li>
                    <li><strong>Telephoto Support:</strong> Added ability to switch cameras, enabling use of telephoto lenses on supported devices (e.g., Samsung).</li>
                    <li><strong>Smarter Scanning:</strong> Improved handling of collector numbers with leading zeros (e.g., "005" now matches "5").</li>
                    <li><strong>Workflow Improvements:</strong> Details are now automatically cleared after adding cards to your collection.</li>
                </ul>
            `,
            stats: {
                features: 2,
                bugs: 2,
                improvements: 1
            },
            released_at: new Date()
        });
        console.log('Release 1.0.3 added successfully');
    } catch (err) {
        console.error('Error adding release:', err);
    } finally {
        await knex.destroy();
    }
}

run();
