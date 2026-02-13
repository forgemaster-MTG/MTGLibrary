const { knex } = await import('../server/db.js');

const version = '1.0.4';
const notes = `
<h3>✨ Refined Activity & Onboarding</h3>
<ul>
    <li><strong>Throttled Activity Tracking:</strong> User activity is now tracked globally across all interactions, but throttled to every 5 minutes to optimize performance.</li>
    <li><strong>Clean Activity Slate:</strong> All user 'Last Active' timestamps have been reset to ensure accuracy moving forward.</li>
    <li><strong>Identity Forge:</strong> Added a new prompt for users with the 'Anonymous' username to help them claim a unique identity.</li>
    <li><strong>Admin Dashboard Mobile Boost:</strong> Overhauled the mobile view for User Management with better action accessibility and status indicators.</li>
    <li><strong>Custom Feature Badge:</strong> Added a visual indicator for users with manual feature overrides.</li>
</ul>
`;

const typeStats = {
    features: 3,
    bugs: 0
};

async function publish() {
    try {
        console.log(`Publishing release ${version}...`);
        const [id] = await knex('releases').insert({
            version,
            notes,
            stats: JSON.stringify(typeStats),
            released_at: knex.fn.now()
        }).returning('id');

        console.log(`Successfully published release ${id}!`);
        process.exit(0);
    } catch (err) {
        console.error('Failed to publish release:', err);
        process.exit(1);
    }
}

publish();
