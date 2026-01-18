
import { knex } from './server/db.js';

async function verifySchema() {
    try {
        const hasFirestoreId = await knex.schema.hasColumn('precons', 'firestore_id');
        const hasData = await knex.schema.hasColumn('precons', 'data');

        console.log('Has firestore_id:', hasFirestoreId);
        console.log('Has data:', hasData);

        if (hasFirestoreId && hasData) {
            console.log('VERIFICATION SUCCESS: generic columns added.');
        } else {
            console.error('VERIFICATION FAILED: missing columns.');
        }
    } catch (err) {
        console.error('Verification Error:', err);
    } finally {
        await knex.destroy();
    }
}

verifySchema();
