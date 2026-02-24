const { knex } = await import('../server/db.js');

const version = '1.0.5';
const notes = `
<h3>✨ The AI & UI Overhaul</h3>
<ul>
    <li><strong>Nano Banana Pro (Imagen 3.0):</strong> Upgraded image generation to the latest Imagen fleet. Optimized for high-quality 'Pro' and rapid 'Fast' generation modes.</li>
    <li><strong>Persona Details Redesign:</strong> Complete layout overhaul with cinematic top-banners and expanded modal width for a premium viewing experience.</li>
    <li><strong>Emerald Scrollbars:</strong> Integrated custom-styled emerald scrollbars across the Persona interface.</li>
    <li><strong>Pricing Optimization:</strong> Transitioned AI image costs to a managed Pricing Service with sustainable markup logic.</li>
    <li><strong>Admin Enhancements:</strong> Added direct PNG-to-Base64 upload support and streamlined management forms in the Persona Manager.</li>
</ul>
`;

const typeStats = {
    features: 5,
    bugs: 0,
    improvements: 2
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
