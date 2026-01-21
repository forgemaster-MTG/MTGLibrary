
import { knex } from './db.js';

async function testLookup() {
    try {
        const setCode = '2X2';
        const collectorNumber = '224';

        console.log(`Looking up ${setCode} #${collectorNumber}...`);

        const cardMeta = await knex('cards')
            .whereRaw('lower(setcode) = ?', [setCode.toLowerCase()])
            .where({ number: collectorNumber })
            .first();

        if (!cardMeta) {
            console.log('Card not found!');
        } else {
            console.log('Card found:', cardMeta.id, cardMeta.name);
            console.log('Data present?', !!cardMeta.data);
            if (cardMeta.data) {
                console.log('Image URIs:', cardMeta.data.image_uris);
                console.log('Type Line:', cardMeta.data.type_line);
            }
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit();
    }
}

testLookup();
