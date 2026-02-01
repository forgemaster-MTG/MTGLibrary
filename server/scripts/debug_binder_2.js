import { knex } from '../db.js';

async function run() {
    try {
        console.log('--- Fetching Binder 2 ---');
        const binder = await knex('binders').where('id', 2).first();
        console.log('Binder:', binder);

        if (binder) {
            console.log('Binder User ID Type:', typeof binder.user_id);
            console.log('Binder User ID:', binder.user_id);
        }

        console.log('--- Fetching Users ---');
        const users = await knex('users').select('id', 'username', 'email').limit(5);
        console.log('Users:', users);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
