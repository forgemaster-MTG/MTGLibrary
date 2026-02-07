import 'dotenv/config';
import { knex } from '../server/db.js';

async function run() {
    try {
        console.log('Inserting Release 1.0.2...');
        await knex('releases').insert({
            version: '1.0.2',
            notes: `
                <p><strong>Mobile Experience & Polish</strong></p>
                <ul>
                    <li><strong>Navigation:</strong> Fixed a "dead zone" on tablet widths where navigation was inaccessible.</li>
                    <li><strong>PWA Rotation:</strong> Unlocked screen orientation for the installed app (Landscape mode now supported).</li>
                    <li><strong>Vault Sharing:</strong> Fixed an issue where the share button was unresponsive on mobile devices.</li>
                    <li><strong>Decks Page:</strong> Renamed "My Strategies" to "My Decks" and improved mobile controls with a floating footer.</li>
                    <li><strong>UI Polish:</strong> improved mobile dashboard layout and widget spacing.</li>
                </ul>
            `,
            stats: {
                features: 3,
                bugs: 2
            },
            released_at: new Date()
        });
        console.log('Release 1.0.2 added successfully');
    } catch (err) {
        console.error('Error adding release:', err);
    } finally {
        await knex.destroy();
    }
}

run();
